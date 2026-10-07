"""ตาราง employees ตรงกับ IBM dataset และส่วนที่ใช้ PostgreSQL จริง (ข้ามถ้าไม่มี DB เช่นใน CI)"""

import io
import os
import re

import pandas as pd
import pytest
from fastapi.testclient import TestClient

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
        assert r.json()["saved"] is True and "เพิ่มใหม่ 1" in r.json()["note"]
        assert ms.employee_record(NEW_ID)["MonthlyIncome"] == 2000  # 70,000 บาท / 35
        assert client.get(f"/shap/{NEW_ID}").status_code == 200
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = %s AND employee_id = %s", (db.DEMO_TENANT, NEW_ID))


def test_import_needs_db(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    r = client.post("/employees/import", files={"file": ("e.csv", b"x", "text/csv")})
    assert r.status_code == 503
