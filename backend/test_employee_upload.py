"""test ของ /employees/template และ /employees/validate (นำเข้าพนักงานจาก Excel/CSV ขั้นตรวจไฟล์)"""

import io

import pandas as pd
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _template() -> pd.DataFrame:
    r = client.get("/employees/template", params={"n_examples": 3})
    assert r.status_code == 200 and r.headers["content-type"] == XLSX
    return pd.read_excel(io.BytesIO(r.content), sheet_name="พนักงาน")


def _upload(df: pd.DataFrame, name="employees.xlsx"):
    buf = io.BytesIO()
    if name.endswith(".csv"):
        buf.write(df.to_csv(index=False).encode("utf-8-sig"))
    else:
        df.to_excel(buf, index=False)
    return client.post("/employees/validate", files={"file": (name, buf.getvalue(), XLSX)})


def test_template_rows_are_valid_in_xlsx_and_csv():
    df = _template()
    assert len(df) == 3 and "เงินเดือน (บาท)" in df.columns and df["ทำงานล่วงเวลา (OT)"].isin(["ทำ", "ไม่ทำ"]).all()
    for name in ("employees.xlsx", "employees.csv"):
        body = _upload(df, name).json()
        assert body["n_valid"] == 3 and body["errors"] == [] and body["missing_columns"] == [] and body["saved"] is False


def test_bad_values_reported_in_thai_with_excel_row_numbers():
    df = _template()
    df.loc[0, "ทำงานล่วงเวลา (OT)"] = "บางวัน"
    df.loc[1, "พอใจในงานที่ทำ"] = 9
    df.loc[2, "รหัสพนักงาน"] = df.loc[0, "รหัสพนักงาน"]
    body = _upload(df).json()
    got = {(e["row"], e["column"]) for e in body["errors"]}
    assert (2, "ทำงานล่วงเวลา (OT)") in got and (3, "พอใจในงานที่ทำ") in got and (4, "รหัสพนักงาน") in got
    assert body["n_valid"] == 0 and body["n_invalid"] == 3
    assert any("ไม่เกิน 4" in e["message"] for e in body["errors"])
    assert any("ทำ / ไม่ทำ" in e["message"] for e in body["errors"])  # ตัวเลือกเป็นภาษาไทยตามไฟล์ตัวอย่าง


def test_missing_and_unknown_columns():
    df = _template().drop(columns=["อายุ"]).assign(หมายเหตุ="x")
    body = _upload(df).json()
    assert body["missing_columns"] == ["อายุ"] and body["unknown_columns"] == ["หมายเหตุ"]
    assert all(e["column"] != "อายุ" for e in body["errors"])  # คอลัมน์ที่ขาดบอกครั้งเดียว ไม่ซ้ำทุกแถว


def test_rejects_wrong_file_type_and_broken_file():
    assert client.post("/employees/validate", files={"file": ("a.pdf", b"x", "application/pdf")}).status_code == 422
    assert client.post("/employees/validate", files={"file": ("a.xlsx", b"not excel", XLSX)}).status_code == 422


def test_survey_fields_optional_and_job_level_words():
    df = _template()
    assert set(df["ระดับตำแหน่ง"]) <= {"จูเนียร์", "พนักงานระดับกลาง", "ซีเนียร์", "ผู้จัดการแผนก", "ผู้จัดการใหญ่"}
    df.loc[0, "พอใจในงานที่ทำ"] = None  # เว้นว่าง 1 ช่อง
    df = df.drop(columns=["สมดุลงานกับชีวิต", "ความทุ่มเทให้กับงาน"])  # ไม่มีทั้งคอลัมน์
    df.loc[1, "ระดับตำแหน่ง"] = "4"  # ตัวเลขยังใช้ได้
    body = _upload(df).json()
    assert body["n_valid"] == 3 and body["errors"] == [] and body["missing_columns"] == []
    df.loc[2, "ระดับตำแหน่ง"] = "หัวหน้าทีม"  # คำที่ไม่รู้จัก ต้องแจ้ง
    assert any(e["column"] == "ระดับตำแหน่ง" for e in _upload(df).json()["errors"])


def test_business_travel_new_name_and_old_name_both_accepted():
    df = _template()
    assert set(df["เดินทางไปทำงานนอกสถานที่"]) <= {"ไม่ต้องไป", "นานๆ ครั้ง", "บ่อย"}
    old = df.rename(columns={"เดินทางไปทำงานนอกสถานที่": "การเดินทางไปทำงาน"})  # ไฟล์ที่กรอกก่อนเปลี่ยนชื่อ
    old["การเดินทางไปทำงาน"] = "ไม่เดินทาง"
    body = _upload(old).json()
    assert body["n_valid"] == 3 and body["missing_columns"] == [] and body["unknown_columns"] == []
