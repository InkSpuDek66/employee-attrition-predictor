"""นำเข้าข้อมูลพนักงานจากไฟล์ Excel/CSV ของบริษัท (ขั้นตรวจไฟล์ ยังไม่บันทึก)

GET  /employees/template  ไฟล์ Excel ตัวอย่าง หัวคอลัมน์ภาษาไทย + ชีตคำอธิบาย
POST /employees/validate  ตรวจไฟล์ที่อัปโหลด บอกคอลัมน์ที่ขาด/แถวที่ผิดเป็นภาษาไทย

ตรวจด้วย schemas.EmployeeInput ตัวเดียวกับ /predict, /whatif จึงตรงกับที่โมเดลรับได้จริง
ponytail: ยังไม่บันทึกลง database (รอ backend ต่อ DB ตาม DE-04) และยังไม่มี login (SEC-01/02)
ห้ามใช้กับข้อมูลพนักงานจริงจนกว่าจะมีทั้งสองอย่าง เงินเดือนรับเป็นบาท การแปลงเป็นหน่วยโมเดลทำตอนบันทึก (DE-01)
"""

import io
from typing import Optional

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

import model_store as ms
from schemas import EmployeeInput

router = APIRouter(tags=["employees"])

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 10_000
MAX_ERRORS = 200  # ส่งกลับไม่เกินนี้ ที่เหลือบอกแค่จำนวน

# (ฟิลด์ของโมเดล, หัวคอลัมน์ภาษาไทยใน template, คำอธิบาย/ตัวเลือก)
COLUMNS = [
    ("EmployeeNumber", "รหัสพนักงาน", "ตัวเลข ไม่ซ้ำกัน"),
    ("Age", "อายุ", "ปี"),
    ("Gender", "เพศ", "ชาย / หญิง"),
    ("MaritalStatus", "สถานภาพสมรส", "โสด / สมรส / หย่า"),
    ("Education", "ระดับการศึกษา", "1 ต่ำกว่า ป.ตรี, 2 อนุปริญญา, 3 ป.ตรี, 4 ป.โท, 5 ป.เอก"),
    ("EducationField", "สาขาที่เรียน", "Life Sciences / Medical / Marketing / Technical Degree / Human Resources / Other"),
    ("Department", "แผนก", "Sales / Research & Development / Human Resources"),
    ("JobRole", "ตำแหน่งงาน", "ดูชีต \"ตัวเลือก\""),
    ("JobLevel", "ระดับตำแหน่ง", "1–5"),
    ("MonthlyIncome", "เงินเดือน (บาท)", "บาทต่อเดือน"),
    ("PercentSalaryHike", "เงินเดือนขึ้นล่าสุด (%)", "0–100"),
    ("StockOptionLevel", "สิทธิ์ซื้อหุ้นพนักงาน", "0 ไม่มี, 1–3"),
    ("OverTime", "ทำงานล่วงเวลา (OT)", "ทำ / ไม่ทำ"),
    ("BusinessTravel", "การเดินทางไปทำงาน", "ไม่เดินทาง / นานๆ ครั้ง / บ่อย"),
    ("DistanceFromHome", "ระยะทางจากบ้าน (กม.)", "ตัวเลขจำนวนเต็ม"),
    ("JobSatisfaction", "พอใจในงานที่ทำ", "1 ต่ำ – 4 สูงมาก"),
    ("EnvironmentSatisfaction", "พอใจสภาพแวดล้อมที่ทำงาน", "1 ต่ำ – 4 สูงมาก"),
    ("RelationshipSatisfaction", "พอใจความสัมพันธ์กับเพื่อนร่วมงาน", "1 ต่ำ – 4 สูงมาก"),
    ("JobInvolvement", "ความทุ่มเทให้กับงาน", "1 ต่ำ – 4 สูงมาก"),
    ("WorkLifeBalance", "สมดุลงานกับชีวิต", "1 แย่ – 4 ดีมาก"),
    ("PerformanceRating", "ผลประเมินการทำงาน", "1–4"),
    ("TrainingTimesLastYear", "จำนวนครั้งที่อบรมปีที่ผ่านมา", "ครั้ง"),
    ("NumCompaniesWorked", "จำนวนบริษัทที่เคยทำงาน", "บริษัท"),
    ("TotalWorkingYears", "อายุงานรวม (ปี)", "ปี"),
    ("YearsAtCompany", "อยู่บริษัทนี้ (ปี)", "ปี"),
    ("YearsInCurrentRole", "อยู่ตำแหน่งปัจจุบัน (ปี)", "ปี"),
    ("YearsSinceLastPromotion", "ตั้งแต่เลื่อนตำแหน่งล่าสุด (ปี)", "ปี"),
    ("YearsWithCurrManager", "อยู่กับหัวหน้าคนปัจจุบัน (ปี)", "ปี"),
    ("DailyRate", "อัตราค่าจ้างรายวัน", "ตามข้อมูล IBM (โมเดลต้องใช้)"),
    ("HourlyRate", "อัตราค่าจ้างรายชั่วโมง", "ตามข้อมูล IBM (โมเดลต้องใช้)"),
    ("MonthlyRate", "อัตราค่าจ้างรายเดือน", "ตามข้อมูล IBM (โมเดลต้องใช้)"),
]
THAI = {f: th for f, th, _ in COLUMNS}
HINT = {f: hint for f, _, hint in COLUMNS}
# รับได้ทั้งหัวคอลัมน์ไทยและชื่อคอลัมน์ IBM (ไฟล์ที่ export จากระบบเดิม)
HEADER_TO_FIELD = {th: f for f, th, _ in COLUMNS} | {f: f for f, _, _ in COLUMNS}

# ค่าภาษาไทย -> ค่าที่โมเดลรู้จัก (รับค่าภาษาอังกฤษแบบ IBM ได้ด้วย)
THAI_VALUES = {
    "Gender": {"ชาย": "Male", "หญิง": "Female"},
    "MaritalStatus": {"โสด": "Single", "สมรส": "Married", "แต่งงาน": "Married", "หย่า": "Divorced"},
    "OverTime": {"ทำ": "Yes", "ไม่ทำ": "No", "ใช่": "Yes", "ไม่ใช่": "No"},
    "BusinessTravel": {"ไม่เดินทาง": "Non-Travel", "นานๆ ครั้ง": "Travel_Rarely", "นานๆครั้ง": "Travel_Rarely", "บ่อย": "Travel_Frequently"},
}


class RowError(BaseModel):
    row: int  # เลขแถวตามที่เห็นใน Excel (หัวคอลัมน์ = แถว 1)
    column: str
    message: str


class ValidateResponse(BaseModel):
    filename: str
    n_rows: int
    n_valid: int
    n_invalid: int
    missing_columns: list[str]
    unknown_columns: list[str]
    errors: list[RowError]
    errors_truncated: int
    preview: list[dict]
    saved: bool = False
    note: str = "ตรวจไฟล์อย่างเดียว ยังไม่ได้บันทึกเข้าระบบ"


def _message(err: dict, field: str) -> str:
    """ข้อความ error ของ pydantic -> ภาษาไทยที่ HR เข้าใจ (ตัวเลือกใช้คำเดียวกับในไฟล์ตัวอย่าง ไม่ใช่ค่าภายในของโมเดล)"""
    kind, ctx = err["type"], err.get("ctx", {})
    if kind == "missing":
        return "ว่างอยู่ ต้องกรอก"
    if kind == "literal_error":
        return f"ค่าไม่ถูกต้อง ต้องเป็น: {HINT.get(field) or ctx.get('expected', '')}"
    if kind in ("int_parsing", "int_from_float", "int_type"):
        return "ต้องเป็นตัวเลขจำนวนเต็ม"
    if kind in ("greater_than_equal", "greater_than"):
        return f"ต้องไม่น้อยกว่า {ctx.get('ge', ctx.get('gt'))}"
    if kind in ("less_than_equal", "less_than"):
        return f"ต้องไม่เกิน {ctx.get('le', ctx.get('lt'))}"
    return err["msg"]


def _read(upload: UploadFile, data: bytes) -> pd.DataFrame:
    name = (upload.filename or "").lower()
    try:
        if name.endswith(".csv"):
            return pd.read_csv(io.BytesIO(data), dtype=object, encoding="utf-8-sig")
        if name.endswith(".xlsx"):
            return pd.read_excel(io.BytesIO(data), dtype=object, engine="openpyxl")
    except Exception:  # noqa: BLE001  ไฟล์เสีย/ผิดรูปแบบ อะไรก็ตอบเป็นข้อความเดียวกัน
        raise HTTPException(422, "อ่านไฟล์ไม่ได้ ตรวจว่าเป็นไฟล์ Excel (.xlsx) หรือ CSV ที่ไม่เสีย")
    raise HTTPException(422, "รองรับเฉพาะไฟล์ .xlsx หรือ .csv")


def _clean(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


@router.post("/employees/validate", response_model=ValidateResponse)
async def validate_upload(file: UploadFile = File(...)):
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "ไฟล์ใหญ่เกิน 5 MB")
    df = _read(file, data)
    if len(df) > MAX_ROWS:
        raise HTTPException(422, f"มี {len(df):,} แถว เกิน {MAX_ROWS:,} แถว แบ่งไฟล์ก่อนอัปโหลด")

    headers = [str(c).strip() for c in df.columns]
    df.columns = headers
    mapped = {h: HEADER_TO_FIELD[h] for h in headers if h in HEADER_TO_FIELD}
    present = set(mapped.values())
    missing = [THAI[f] for f, _, _ in COLUMNS if f not in present]
    unknown = [h for h in headers if h not in HEADER_TO_FIELD and not h.startswith("Unnamed")]

    errors: list[RowError] = []
    seen_ids: dict = {}
    preview, n_valid = [], 0
    for i, raw in enumerate(df.to_dict("records")):
        excel_row = i + 2
        row = {mapped[h]: _clean(v) for h, v in raw.items() if h in mapped}
        if all(v is None for v in row.values()):
            continue  # แถวว่างท้ายไฟล์
        for field, table in THAI_VALUES.items():
            if isinstance(row.get(field), str):
                row[field] = table.get(row[field], row[field])
        row_errors = []

        emp_id = row.pop("EmployeeNumber", None)
        try:
            emp_id = int(float(emp_id))
            if emp_id <= 0:
                raise ValueError
            if emp_id in seen_ids:
                row_errors.append(RowError(row=excel_row, column=THAI["EmployeeNumber"], message=f"ซ้ำกับแถว {seen_ids[emp_id]}"))
            seen_ids.setdefault(emp_id, excel_row)
        except (TypeError, ValueError):
            row_errors.append(RowError(row=excel_row, column=THAI["EmployeeNumber"], message="ต้องเป็นตัวเลขจำนวนเต็มบวก"))

        try:
            EmployeeInput(**{k: v for k, v in row.items() if v is not None})
        except ValidationError as e:
            for err in e.errors():
                field = str(err["loc"][0]) if err["loc"] else ""
                if field in present or err["type"] != "missing":  # คอลัมน์ที่ขาดทั้งคอลัมน์ บอกครั้งเดียวด้านบน
                    row_errors.append(RowError(row=excel_row, column=THAI.get(field, field), message=_message(err, field)))

        if row_errors:
            errors.extend(row_errors)
        else:
            n_valid += 1
            if len(preview) < 5:
                preview.append({THAI["EmployeeNumber"]: emp_id} | {THAI[f]: row.get(f) for f, _, _ in COLUMNS[1:9]})

    n_rows = n_valid + len({e.row for e in errors})
    return ValidateResponse(
        filename=file.filename or "",
        n_rows=n_rows,
        n_valid=n_valid,
        n_invalid=n_rows - n_valid,
        missing_columns=missing,
        unknown_columns=unknown,
        errors=errors[:MAX_ERRORS],
        errors_truncated=max(0, len(errors) - MAX_ERRORS),
        preview=preview,
    )


def _example_rows(n: int = 2) -> list[dict]:
    """แถวตัวอย่างจาก IBM dataset (แปลงค่าเป็นภาษาไทย เงินเดือน × 35 เป็นบาท ให้ดูเป็นตัวอย่างเท่านั้น)"""
    raw = ms.raw_employees().head(n)
    back = {
        "Gender": {"Male": "ชาย", "Female": "หญิง"},
        "MaritalStatus": {"Single": "โสด", "Married": "สมรส", "Divorced": "หย่า"},
        "OverTime": {"Yes": "ทำ", "No": "ไม่ทำ"},
        "BusinessTravel": {"Non-Travel": "ไม่เดินทาง", "Travel_Rarely": "นานๆ ครั้ง", "Travel_Frequently": "บ่อย"},
    }
    rows = []
    for rec in raw.to_dict("records"):
        out = {}
        for field, th, _ in COLUMNS:
            v = rec[field]
            out[th] = round(v * 35 / 100) * 100 if field == "MonthlyIncome" else back.get(field, {}).get(v, v)
        rows.append(out)
    return rows


@router.get("/employees/template")
def download_template(n_examples: Optional[int] = 2):
    """ไฟล์ Excel ตัวอย่าง: ชีต "พนักงาน" (หัวคอลัมน์ + แถวตัวอย่าง) และชีต "คำอธิบาย" """
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        pd.DataFrame(_example_rows(max(0, min(n_examples or 0, 5))), columns=[th for _, th, _ in COLUMNS]).to_excel(
            xw, sheet_name="พนักงาน", index=False
        )
        pd.DataFrame([{"คอลัมน์": th, "ต้องกรอก": "ต้อง", "ค่าที่รับ": hint} for _, th, hint in COLUMNS]).to_excel(
            xw, sheet_name="คำอธิบาย", index=False
        )
        roles = EmployeeInput.model_fields["JobRole"].annotation.__args__
        pd.DataFrame({"ตำแหน่งงาน (JobRole)": list(roles)}).to_excel(xw, sheet_name="ตัวเลือก", index=False)
        for ws in xw.book.worksheets:
            for col in ws.columns:
                ws.column_dimensions[col[0].column_letter].width = max(12, min(40, max(len(str(c.value or "")) for c in col) + 2))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=employee_template.xlsx"},
    )
