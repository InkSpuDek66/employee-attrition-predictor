"""ตาราง employees ตรงกับ IBM dataset และส่วนที่ใช้ PostgreSQL จริง (ข้ามถ้าไม่มี DB เช่นใน CI)"""

import io
import os
import re

import pandas as pd
import pytest
from fastapi.testclient import TestClient

import batch_score
import calibration
import conftest
import model_store as ms
import db
from main import app

client = TestClient(app)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
NEW_ID = 990001  # ไม่ชนกับ IBM (สูงสุด 2068)

SCHEMA = os.path.join(ms.ROOT, "docker", "postgres", "init", "02-app-schema.sql")


def test_every_ibm_column_maps_to_employees_table():
    sql = open(SCHEMA, encoding="utf-8").read()
    table = re.search(r"CREATE TABLE IF NOT EXISTS employees \((.*?)\n\);", sql, re.S).group(1)
    columns = set(re.findall(r"^\s{4}([a-z_]+)\s", table, re.M))
    ibm = set(ms.load_raw_data(os.path.join(ms.ROOT, "data", "raw", ms.RAW_FILENAME)).columns) - db.SKIP_COLUMNS
    assert {db.db_column(c) for c in ibm} <= columns
    assert db.db_column("YearsWithCurrManager") == "years_with_curr_manager" and db.db_column("EmployeeNumber") == "employee_id"


@pytest.fixture
def real_db(monkeypatch):
    if not conftest.REAL_DATABASE_URL:
        pytest.skip("ไม่ได้ตั้ง DATABASE_URL")
    monkeypatch.setenv("DATABASE_URL", conftest.REAL_DATABASE_URL)
    try:
        db.connect().close()
    except Exception:  # noqa: BLE001
        pytest.skip("ต่อ PostgreSQL ไม่ได้ (docker compose up -d postgres)")
    monkeypatch.setitem(conftest.TEST_USER, "tenant_id", db.DEMO_TENANT)
    monkeypatch.setattr(batch_score, "_score_once", lambda: None)  # ไม่ให้ test รัน batch เต็ม (ช้า + เพิ่มแถวใน DB จริง)
    ms.raw_employees.cache_clear(), ms.employee_features.cache_clear()
    yield
    ms.raw_employees.cache_clear(), ms.employee_features.cache_clear()


def test_calibration_saved_in_db_latest_wins(real_db):
    try:
        calibration.save(db.DEMO_TENANT, "platt", {"coef": 1.0, "intercept": 0.0}, 60, 0.2, {})
        second = calibration.save(db.DEMO_TENANT, "platt", {"coef": 2.0, "intercept": -1.0}, 70, 0.3, {"brier_after": 0.1})
        got = calibration.load(db.DEMO_TENANT)
        assert got["params"] == {"coef": 2.0, "intercept": -1.0} and got["n_samples"] == 70
        assert got["calibrated_at"][:19] == second["calibrated_at"][:19]
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM tenant_calibrations WHERE tenant_id = %s AND n_samples IN (60, 70)", (db.DEMO_TENANT,))


def test_import_saves_new_employee_in_baht(real_db):
    template = pd.read_excel(io.BytesIO(client.get("/employees/template", params={"n_examples": 1}).content), sheet_name="พนักงาน")
    template.loc[0, "รหัสพนักงาน"] = NEW_ID
    template.loc[0, "เงินเดือน (บาท)"] = 70_000
    buf = io.BytesIO()
    template.to_excel(buf, index=False)
    try:
        r = client.post("/employees/import", files={"file": ("e.xlsx", buf.getvalue(), XLSX)})
        assert r.status_code == 200, r.text
        assert r.json()["saved"] is True and "เพิ่มใหม่ 1" in r.json()["note"] and r.json()["saved_ids"] == [NEW_ID]
        assert ms.employee_record(NEW_ID)["MonthlyIncome"] == 2000  # 70,000 บาท / 35
        assert client.get(f"/shap/{NEW_ID}").status_code == 200
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = %s AND employee_id = %s", (db.DEMO_TENANT, NEW_ID))


def test_import_needs_db(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    r = client.post("/employees/import", files={"file": ("e.csv", b"x", "text/csv")})
    assert r.status_code == 503


def test_import_db_check_rejects_whole_file_without_logging_row(real_db, caplog):
    template = pd.read_excel(io.BytesIO(client.get("/employees/template", params={"n_examples": 1}).content), sheet_name="พนักงาน")
    template.loc[0, "รหัสพนักงาน"] = NEW_ID
    template.loc[0, "อายุ"] = 90  # schemas.py รับได้ถึง 100 แต่ตารางรับ 15–80
    buf = io.BytesIO()
    template.to_excel(buf, index=False)
    r = client.post("/employees/import", files={"file": ("e.xlsx", buf.getvalue(), XLSX)})
    assert r.status_code == 422 and ms.employee_record(NEW_ID) is None
    assert "employees_age_check" in caplog.text and str(NEW_ID) not in caplog.text  # log แค่ชื่อ constraint


def test_calibration_history_and_reset_in_db(real_db):
    with db.connect() as conn:  # เก็บของจริงที่อาจมีอยู่ไว้ คืนค่าหลัง test
        before = conn.execute("SELECT count(*) FROM tenant_calibrations WHERE tenant_id = %s", (db.DEMO_TENANT,)).fetchone()[0]
    if before:
        pytest.skip("บริษัทตัวอย่างมีผลปรับเทียบจริงอยู่ ไม่ลบทิ้งใน test")
    calibration.save(db.DEMO_TENANT, "platt", {"coef": 1.0, "intercept": 0.0}, 60, 0.2, {})
    calibration.save(db.DEMO_TENANT, "isotonic", {"x": [0, 1], "y": [0, 1]}, 80, 0.25, {})
    assert [h["method"] for h in calibration.history(db.DEMO_TENANT)] == ["isotonic", "platt"]
    assert calibration.reset(db.DEMO_TENANT) == 2
    assert calibration.history(db.DEMO_TENANT) == [] and calibration.load(db.DEMO_TENANT) is None


def test_background_refresh_runs_again_instead_of_overlapping(monkeypatch):
    calls = []

    def fake_score():
        calls.append(1)
        if len(calls) == 1:  # มี request ใหม่เข้ามาระหว่างรอบแรก: ไม่รันซ้อน แต่ต้องรันต่ออีกรอบ
            batch_score.refresh_in_background()

    monkeypatch.setattr(db, "url", lambda: "postgresql://fake")
    monkeypatch.setattr(batch_score, "_score_once", fake_score)
    batch_score.refresh_in_background()
    assert len(calls) == 2
    monkeypatch.setattr(db, "url", lambda: "")
    batch_score.refresh_in_background()  # ไม่มี DB = ไม่ทำอะไร
    assert len(calls) == 2
