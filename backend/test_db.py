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
from routers import employee_upload as eu

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
    monkeypatch.setattr(batch_score, "_score_once", lambda tenant: None)  # ไม่ให้ test รัน batch เต็ม (ช้า + เพิ่มแถวใน DB จริง)
    ms.clear_cache()
    yield
    ms.clear_cache()


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
    template.loc[0, "เข้าออฟฟิศ (วัน/สัปดาห์)"] = 2
    buf = io.BytesIO()
    template.to_excel(buf, index=False)
    try:
        r = client.post("/employees/import", files={"file": ("e.xlsx", buf.getvalue(), XLSX)})
        assert r.status_code == 200, r.text
        assert r.json()["saved"] is True and "เพิ่มใหม่ 1" in r.json()["note"] and r.json()["saved_ids"] == [NEW_ID]
        assert ms.employee_record(NEW_ID)["MonthlyIncome"] == 2000  # 70,000 บาท / 35
        assert ms.employee_record(NEW_ID)["OfficeDaysPerWeek"] == 2  # เก็บและอ่านกลับจาก DB
        assert client.get(f"/shap/{NEW_ID}").status_code == 200
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = %s AND employee_id = %s", (db.DEMO_TENANT, NEW_ID))


def test_import_name_is_shown_but_never_reaches_the_model(real_db):
    template = pd.read_excel(io.BytesIO(client.get("/employees/template", params={"n_examples": 1}).content), sheet_name="พนักงาน")
    template.loc[0, "รหัสพนักงาน"] = NEW_ID
    template.loc[0, "ชื่อ-นามสกุล"] = "ทดสอบ ระบบ"

    def upload(df):
        buf = io.BytesIO()
        df.to_excel(buf, index=False)
        return client.post("/employees/import", files={"file": ("e.xlsx", buf.getvalue(), XLSX)})

    try:
        r = upload(template)
        assert r.status_code == 200, r.text
        assert r.json()["saved_names"] == {str(NEW_ID): "ทดสอบ ระบบ"}
        assert db.employee_names(db.DEMO_TENANT, [NEW_ID]) == {NEW_ID: "ทดสอบ ระบบ"}
        assert db.FULL_NAME not in ms.raw_employees().columns and db.FULL_NAME not in ms.employee_record(NEW_ID)  # ไม่เข้าโมเดล
        assert client.get(f"/shap/{NEW_ID}").json()["name"] == "ทดสอบ ระบบ"
        assert upload(template.drop(columns=["ชื่อ-นามสกุล"])).status_code == 200  # อัปเดตด้วยไฟล์ที่ไม่มีคอลัมน์ชื่อ
        assert db.employee_names(db.DEMO_TENANT, [NEW_ID]) == {NEW_ID: "ทดสอบ ระบบ"}  # ชื่อเดิมไม่หาย
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = %s AND employee_id = %s", (db.DEMO_TENANT, NEW_ID))


def test_new_company_sees_only_its_own_employees_with_real_departments(real_db, monkeypatch):
    """บริษัทใหม่นำเข้าพนักงานของตัวเอง: ไม่เห็น IBM และภาพรวมแยกแผนกตามชื่อจริงของบริษัท ไม่ใช่กลุ่มของโมเดล"""
    template = pd.read_excel(io.BytesIO(client.get("/employees/template", params={"n_examples": 3}).content), sheet_name="พนักงาน")
    template["รหัสพนักงาน"] = [1, 2, 3]  # รหัสเดียวกับ IBM ได้ เพราะคนละบริษัท
    template["แผนก"] = ["ฝ่ายการเงิน", "ฝ่ายการเงิน", "ฝ่ายไอที"]
    template["กลุ่มแผนก (ให้โมเดล)"] = ["Sales", "Sales", "Research & Development"]
    template["ตำแหน่งงาน"] = "นักบัญชี"
    template["กลุ่มตำแหน่ง (ให้โมเดล)"] = ["Sales Executive", "Sales Executive", "Research Scientist"]
    buf = io.BytesIO()
    template.to_excel(buf, index=False)
    monkeypatch.setitem(conftest.TEST_USER, "tenant_id", "newco_demo")
    ibm_first = ms.employee_record(1, db.DEMO_TENANT)
    try:
        r = client.post("/employees/import", files={"file": ("e.xlsx", buf.getvalue(), XLSX)})
        assert r.status_code == 200, r.text
        assert client.get("/company-summary").json()["n_employees"] == 3
        assert {d["department"] for d in client.get("/company-summary/departments").json()["departments"]} == {"ฝ่ายการเงิน", "ฝ่ายไอที"}
        assert client.get("/company-summary", params={"department": "ฝ่ายการเงิน"}).json()["n_employees"] == 2
        top = client.get("/company-summary/top-employees").json()["employees"]
        assert {e["department"] for e in top} == {"ฝ่ายการเงิน", "ฝ่ายไอที"} and {e["job_role"] for e in top} == {"นักบัญชี"}
        shap = client.get("/shap/3").json()
        assert shap["department"] == "ฝ่ายไอที" and shap["job_role"] == "นักบัญชี"
        assert ms.employee_record(1, db.DEMO_TENANT) == ibm_first  # พนักงาน #1 ของ IBM ไม่ถูกเขียนทับ
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = 'newco_demo'")


def test_full_roster_import_marks_missing_as_left_and_they_can_come_back(real_db, monkeypatch):
    """ไม่ออกรหัสให้เอง (รหัส = รหัสพนักงานของบริษัท) และ "ถือว่าลาออกแล้ว" = คนที่ไม่อยู่ในไฟล์ถูกบันทึกว่าออก ไม่ลบ"""
    template = pd.read_excel(io.BytesIO(client.get("/employees/template", params={"n_examples": 4}).content), sheet_name="พนักงาน")
    monkeypatch.setitem(conftest.TEST_USER, "tenant_id", "newco_demo")

    def send(path, ids, full_roster):
        df = template.head(len(ids)).assign(**{"รหัสพนักงาน": ids})
        buf = io.BytesIO()
        df.to_excel(buf, index=False)
        # ยืนยันการเปลี่ยนแปลกไว้ก่อน (test นี้สลับข้อมูลระหว่างรหัส) เรื่องคำเตือนดู test ถัดไป
        data = {"full_roster": str(full_roster).lower(), "confirm_changes": "true"}
        return client.post(path, files={"file": ("e.xlsx", buf.getvalue(), XLSX)}, data=data)

    try:
        assert send("/employees/import", [1, 2, 3], False).status_code == 200
        plan = send("/employees/validate", [2, 3, 4], True).json()  # บอกก่อนบันทึก
        assert (plan["n_new"], plan["n_update"], plan["n_leaving"]) == (1, 2, 1)
        assert send("/employees/validate", [2, 3, 4], False).json()["n_leaving"] is None
        r = send("/employees/import", [2, 3, 4], True).json()
        assert "บันทึกว่าออกแล้ว 1 คน" in r["note"] and r["n_leaving"] == 1
        assert client.get("/company-summary").json()["n_employees"] == 3 and client.get("/shap/1").status_code == 404
        with db.connect() as conn:  # ไม่ลบ เก็บไว้พร้อมวันที่ออก
            assert conn.execute("SELECT left_at IS NOT NULL FROM employees WHERE tenant_id = 'newco_demo' AND employee_id = 1").fetchone() == (True,)
        warned = send("/employees/validate", [4], True).json()  # เกินครึ่งจะถูกบันทึกว่าออก = น่าจะเลือกไฟล์ผิด
        assert warned["n_leaving"] == 2 and any("จะถูกบันทึกว่าออกแล้ว" in w for w in warned["warnings"])
        assert send("/employees/import", [1], False).status_code == 200  # กลับมา (นำเข้าแบบเพิ่ม/อัปเดต)
        assert client.get("/company-summary").json()["n_employees"] == 4 and client.get("/shap/1").status_code == 200
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = 'newco_demo'")


def test_same_id_with_odd_changes_needs_confirmation(real_db, monkeypatch):
    """รหัสเดิมแต่ชื่อเปลี่ยน / อายุหรืออายุงานลดลง / เคยออกแล้ว = เตือนก่อนบันทึก และบันทึกได้เมื่อยืนยันเท่านั้น"""
    template = pd.read_excel(io.BytesIO(client.get("/employees/template", params={"n_examples": 1}).content), sheet_name="พนักงาน")
    monkeypatch.setitem(conftest.TEST_USER, "tenant_id", "newco_demo")

    def send(path, **change):
        confirm = change.pop("_confirm", None)
        df = template.assign(**{"รหัสพนักงาน": 7, **change})
        buf = io.BytesIO()
        df.to_excel(buf, index=False)
        return client.post(path, files={"file": ("e.xlsx", buf.getvalue(), XLSX)}, data={"confirm_changes": confirm or "false"})

    age = int(template.loc[0, "อายุ"])
    try:
        assert send("/employees/import", **{"ชื่อ-นามสกุล": "สมชาย ใจดี"}).status_code == 200
        same = send("/employees/validate", **{"ชื่อ-นามสกุล": "สมชาย ใจดี", "อายุ": age + 1})  # คนเดิม อายุเพิ่ม = ปกติ
        assert same.json()["changes_to_check"] == []
        odd = send("/employees/validate", **{"ชื่อ-นามสกุล": "สมหญิง รักดี", "อายุ": age - 5}).json()["changes_to_check"]
        assert len(odd) == 1 and odd[0]["employee_id"] == 7
        assert any("สมชาย ใจดี" in r for r in odd[0]["reasons"]) and any("อายุ ลดลง" in r for r in odd[0]["reasons"])
        assert send("/employees/import", **{"ชื่อ-นามสกุล": "สมหญิง รักดี"}).status_code == 409  # ไม่ยืนยัน = ไม่บันทึก
        assert db.employee_names("newco_demo", [7]) == {7: "สมชาย ใจดี"}
        assert send("/employees/import", **{"ชื่อ-นามสกุล": "สมหญิง รักดี", "_confirm": "true"}).status_code == 200
        assert db.employee_names("newco_demo", [7]) == {7: "สมหญิง รักดี"}
        with db.connect() as conn:
            conn.execute("UPDATE employees SET left_at = current_date WHERE tenant_id = 'newco_demo' AND employee_id = 7")
        back = send("/employees/validate", **{"ชื่อ-นามสกุล": "สมหญิง รักดี"}).json()["changes_to_check"]
        assert back and "เคยบันทึกว่าออกแล้ว" in back[0]["reasons"][0]
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = 'newco_demo'")


def test_import_needs_db(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    r = client.post("/employees/import", files={"file": ("e.csv", b"x", "text/csv")})
    assert r.status_code == 503


def _one_new_employee() -> bytes:
    template = pd.read_excel(io.BytesIO(client.get("/employees/template", params={"n_examples": 1}).content), sheet_name="พนักงาน")
    template.loc[0, "รหัสพนักงาน"] = NEW_ID
    buf = io.BytesIO()
    template.to_excel(buf, index=False)
    return buf.getvalue()


def test_import_db_check_rejects_whole_file_without_logging_row(real_db, caplog, monkeypatch):
    """ด่านสุดท้าย: schemas.py ตรวจช่วงเดียวกับ CHECK แล้ว (test_schemas.py) จึงจำลองค่าที่หลุดขั้นตรวจด้วยการแก้แถวหลังตรวจ"""
    real = eu.to_model_units
    monkeypatch.setattr(eu, "to_model_units", lambda rows: real(rows).assign(Age=90))  # ตารางรับ 15–80
    r = client.post("/employees/import", files={"file": ("e.xlsx", _one_new_employee(), XLSX)})
    assert r.status_code == 422 and ms.employee_record(NEW_ID) is None
    assert "employees_age_check" in caplog.text and str(NEW_ID) not in caplog.text  # log แค่ชื่อ constraint


def test_import_on_outdated_schema_says_what_to_do(monkeypatch):
    """QA-06: DB ที่ยังไม่ได้รัน 02-app-schema.sql ซ้ำหลัง pull เคยได้ 500 ต้องได้ 503 พร้อมบอกวิธีแก้"""

    class FakeConn:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def execute(self, *args):
            return []

    def outdated(*args):
        raise db.SchemaOutdated("UndefinedColumn")

    file = _one_new_employee()  # สร้างไฟล์ก่อนสลับไป DB ปลอม (ไฟล์ตัวอย่างอ่านข้อมูลพนักงาน)
    monkeypatch.setattr(db, "url", lambda: "postgresql://fake")
    monkeypatch.setattr(db, "connect", FakeConn)
    monkeypatch.setattr(db, "upsert_employees", outdated)
    r = client.post("/employees/import", files={"file": ("e.xlsx", file, XLSX)})
    assert r.status_code == 503 and "run_guide" in r.json()["detail"]


def test_employee_deleted_by_sql_is_gone_without_restart(real_db, monkeypatch):
    """DE-15: ลบพนักงานด้วย SQL (เช่นตามคำขอ PDPA) แล้ว backend ที่เปิดอยู่ต้องเห็นทันที ไม่ต้อง restart"""
    monkeypatch.setattr(ms, "DATA_CHECK_SECONDS", 0)
    try:
        assert client.post("/employees/import", files={"file": ("e.xlsx", _one_new_employee(), XLSX)}).status_code == 200
        assert client.get(f"/shap/{NEW_ID}").status_code == 200
    finally:
        with db.connect() as conn:
            conn.execute("DELETE FROM employees WHERE tenant_id = %s AND employee_id = %s", (db.DEMO_TENANT, NEW_ID))
    assert client.get(f"/shap/{NEW_ID}").status_code == 404


def test_batch_keeps_full_shap_only_for_latest_run(real_db):
    """DE-16: รอบเก่าเหลือ SHAP_KEEP_OLD ปัจจัยต่อคน รอบล่าสุดครบทุกฟีเจอร์ รันใน transaction เดียวแล้ว rollback (ไม่แตะข้อมูลจริง)"""
    n_features = ms.employee_features().shape[1]
    with db.connect() as conn:
        try:
            n = batch_score.run(conn)
            # now() คงที่ทั้ง transaction: ย้อนรอบแรกไป 1 วันให้กลายเป็น "รอบเก่า" ก่อนรันรอบสอง
            conn.execute(
                "UPDATE attrition_predictions SET scored_at = scored_at - interval '1 day' WHERE tenant_id = %s AND scored_at = now()",
                (db.DEMO_TENANT,),
            )
            batch_score.run(conn)
            counts = dict(
                conn.execute(
                    "SELECT p.scored_at = now(), count(*) FROM shap_explanations s JOIN attrition_predictions p USING (prediction_id) "
                    "WHERE p.tenant_id = %s AND p.scored_at IN (now(), now() - interval '1 day') GROUP BY 1",
                    (db.DEMO_TENANT,),
                ).fetchall()
            )
            assert counts[True] == n * n_features
            assert counts[False] == n * batch_score.SHAP_KEEP_OLD
        finally:
            conn.rollback()


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

    def fake_score(tenant):
        calls.append(tenant)
        if len(calls) == 1:  # มี request ใหม่เข้ามาระหว่างรอบแรก: ไม่รันซ้อน แต่ต้องรันต่ออีกรอบ
            batch_score.refresh_in_background()

    monkeypatch.setattr(db, "url", lambda: "postgresql://fake")
    monkeypatch.setattr(batch_score, "_score_once", fake_score)
    batch_score.refresh_in_background()
    assert len(calls) == 2
    monkeypatch.setattr(db, "url", lambda: "")
    batch_score.refresh_in_background()  # ไม่มี DB = ไม่ทำอะไร
    assert len(calls) == 2


def test_demo_calibration_file_is_synthetic_not_ibm():
    """ไฟล์ทดลองปรับเทียบเป็นพนักงานจำลอง ไม่ใช่คนใน IBM ที่โมเดลเคยเห็นตอนเทรน และผ่านการตรวจไฟล์ของหน้าปรับเทียบเอง"""
    demo = client.get("/recalibrate/template", params={"demo": True})
    df = pd.read_excel(io.BytesIO(demo.content), sheet_name="พนักงาน")
    assert len(df) == 300 and df["ลาออกแล้วหรือยัง"].isin(["ลาออก", "ยังอยู่"]).all()
    assert list(df["รหัสพนักงาน"]) == list(range(1, 301))  # เรียงต่อกันไม่มีช่องว่าง
    assert df["ชื่อ-นามสกุล"].notna().all() and df["ชื่อ-นามสกุล"].nunique() > 200  # ชื่อจำลอง ไม่ซ้ำกันเกือบทั้งหมด
    assert 0.05 < (df["ลาออกแล้วหรือยัง"] == "ลาออก").mean() < 0.3  # อัตราลาออกสมเหตุสมผล
    again = pd.read_excel(io.BytesIO(client.get("/recalibrate/template", params={"demo": True}).content), sheet_name="พนักงาน")
    assert again.equals(df)  # ไฟล์เดิมทุกครั้ง (ผ่านการตรวจไฟล์ + ปรับเทียบได้: test_api.test_recalibrate_from_excel_then_history_and_reset)
