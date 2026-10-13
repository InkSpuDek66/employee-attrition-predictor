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
    # แถวที่ไม่ผ่านแสดงค่าทั้งแถวแบบเดียวกับแถวที่ผ่าน พร้อมบอกช่องที่ผิด
    bad = {r["row"]: r for r in body["invalid_preview"]}
    assert set(bad) == {2, 3, 4} and bad[2]["values"]["ทำงานล่วงเวลา (OT)"] == "บางวัน" and "ทำงานล่วงเวลา (OT)" in bad[2]["errors"]
    assert bad[3]["values"]["พอใจในงานที่ทำ"] == 9  # คอลัมน์ที่ผิดถูกเพิ่มเข้ามาแม้ไม่อยู่ในชุดตัวอย่าง
    assert bad[3]["values"]["ทำงานล่วงเวลา (OT)"] in ("ทำ", "ไม่ทำ")  # คอลัมน์ที่แถวอื่นผิด ก็มีค่าจริงของแถวนี้ด้วย
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
    # DE-17: ระบบเติมค่าแบบสำรวจให้ทั้ง 3 คน (ขาดทั้งคอลัมน์) ต้องบอกจำนวนและเตือนว่าความเสี่ยงอาจต่ำกว่าจริง
    assert body["survey_imputed"] == 3 and "3 คน" in body["warnings"][0] and "ต่ำกว่าจริง" in body["warnings"][0]
    full = _upload(_template()).json()
    assert full["survey_imputed"] == 0 and full["warnings"] == []
    df.loc[2, "ระดับตำแหน่ง"] = "หัวหน้าทีม"  # คำที่ไม่รู้จัก ต้องแจ้ง
    assert any(e["column"] == "ระดับตำแหน่ง" for e in _upload(df).json()["errors"])


def test_business_travel_new_name_and_old_name_both_accepted():
    df = _template()
    assert set(df["เดินทางไปทำงานนอกสถานที่"]) <= {"ไม่ต้องไป", "นานๆ ครั้ง", "บ่อย"}
    old = df.rename(columns={"เดินทางไปทำงานนอกสถานที่": "การเดินทางไปทำงาน"})  # ไฟล์ที่กรอกก่อนเปลี่ยนชื่อ
    old["การเดินทางไปทำงาน"] = "ไม่เดินทาง"
    body = _upload(old).json()
    assert body["n_valid"] == 3 and body["missing_columns"] == [] and body["unknown_columns"] == []



def test_office_days_column_optional():
    df = _template()
    assert "เข้าออฟฟิศ (วัน/สัปดาห์)" in df.columns
    assert _upload(df.drop(columns=["เข้าออฟฟิศ (วัน/สัปดาห์)"])).json()["missing_columns"] == []
    df.loc[0, "เข้าออฟฟิศ (วัน/สัปดาห์)"] = 9
    assert any(e["column"] == "เข้าออฟฟิศ (วัน/สัปดาห์)" for e in _upload(df).json()["errors"])


def test_numbers_with_commas_and_cross_column_checks():
    """UX-16: "45,000" แบบที่ Excel จัดรูปแบบต้องผ่าน · UX-04/DE-10: ค่าที่ขัดกันเองบอกแถว + คอลัมน์ · เพดานเงินเดือนเป็นบาท"""
    df = _template().astype(object)
    df.loc[0, "เงินเดือน (บาท)"] = "45,000"
    df.loc[1, "อายุ"] = 85  # เกิน CHECK ของ DB (15–80) ต้องไม่ผ่านตั้งแต่ขั้นตรวจ
    df.loc[2, "ตั้งแต่เลื่อนตำแหน่งล่าสุด (ปี)"] = int(df.loc[2, "อยู่บริษัทนี้ (ปี)"]) + 5
    body = _upload(df, "employees.csv").json()
    got = {(e["row"], e["column"]): e["message"] for e in body["errors"]}
    assert not any(row == 2 for row, _ in got), got  # แถว 2 (เงินเดือนมีจุลภาค) ผ่าน
    assert "ไม่เกิน 80" in got[(3, "อายุ")]
    assert "เมื่อเทียบกับจำนวนปีที่อยู่บริษัทนี้" in got[(4, "ตั้งแต่เลื่อนตำแหน่งล่าสุด (ปี)")]
    rich = _template()
    rich.loc[0, "เงินเดือน (บาท)"] = 4_500_000  # ฐานเงินเดือน CEO บริษัทใหญ่ยังรับ
    rich.loc[1, "เงินเดือน (บาท)"] = 45_000_000  # พิมพ์ศูนย์เกิน
    got = {(e["row"], e["column"]): e["message"] for e in _upload(rich).json()["errors"]}
    assert list(got) == [(3, "เงินเดือน (บาท)")] and "5,000,000 บาท" in got[(3, "เงินเดือน (บาท)")]


def test_name_column_optional_shown_in_preview():
    df = _template()
    assert df.columns[1] == "ชื่อ-นามสกุล" and df["ชื่อ-นามสกุล"].str.contains("ตัวอย่าง").all()
    body = _upload(df).json()
    assert body["n_valid"] == 3 and body["unknown_columns"] == [] and body["preview"][0]["ชื่อ-นามสกุล"] == df.loc[0, "ชื่อ-นามสกุล"]
    no_name = _upload(df.drop(columns=["ชื่อ-นามสกุล"])).json()  # ไฟล์เดิมที่ไม่มีคอลัมน์ชื่อ ยังผ่าน
    assert no_name["n_valid"] == 3 and no_name["missing_columns"] == [] and "ชื่อ-นามสกุล" not in no_name["preview"][0]
    df.loc[0, "ชื่อ-นามสกุล"] = "ก" * 101
    assert any(e["column"] == "ชื่อ-นามสกุล" and "100" in e["message"] for e in _upload(df).json()["errors"])


def test_gender_optional_not_used_by_model():
    df = _template()
    df.loc[0, "เพศ"] = None  # เว้นว่าง 1 คน
    body = _upload(df).json()
    assert body["n_valid"] == 3 and body["errors"] == []
    no_col = _upload(df.drop(columns=["เพศ"])).json()  # ไม่มีทั้งคอลัมน์
    assert no_col["n_valid"] == 3 and no_col["missing_columns"] == []


def test_real_department_and_title_with_model_groups():
    df = _template()
    assert {"แผนก", "กลุ่มแผนก (ให้โมเดล)", "ตำแหน่งงาน", "กลุ่มตำแหน่ง (ให้โมเดล)"} <= set(df.columns)
    assert _upload(df).json()["n_valid"] == 3  # แถวตัวอย่าง: ชื่อไทย + กลุ่มของโมเดล
    no_group = df.drop(columns=["กลุ่มแผนก (ให้โมเดล)", "กลุ่มตำแหน่ง (ให้โมเดล)"])
    no_group["แผนก"] = "ฝ่ายขาย"  # ชื่อไทยของกลุ่ม Sales = เติมกลุ่มให้เอง
    no_group["ตำแหน่งงาน"] = "Manager"
    body = _upload(no_group).json()
    assert body["n_valid"] == 3 and body["missing_columns"] == []
    no_group.loc[0, "แผนก"] = "ฝ่ายการเงิน"  # ไม่ใช่กลุ่มที่โมเดลรู้จัก และไม่ได้กรอกกลุ่ม = ต้องแจ้ง
    errors = _upload(no_group).json()["errors"]
    assert len(errors) == 1 and errors[0]["column"] == "กลุ่มแผนก (ให้โมเดล)" and "ฝ่ายการเงิน" in errors[0]["message"]
    old = df.drop(columns=["แผนก", "ตำแหน่งงาน"]).rename(columns={"กลุ่มแผนก (ให้โมเดล)": "Department", "กลุ่มตำแหน่ง (ให้โมเดล)": "JobRole"})
    assert _upload(old).json()["n_valid"] == 3  # ไฟล์ที่ใช้หัวคอลัมน์แบบ IBM ยังใช้ได้
