"""นำเข้าข้อมูลพนักงานจากไฟล์ Excel/CSV ของบริษัท

GET  /employees/template  ไฟล์ Excel ตัวอย่าง หัวคอลัมน์ภาษาไทย + ชีตคำอธิบาย
POST /employees/validate  ตรวจไฟล์ที่อัปโหลด บอกคอลัมน์ที่ขาด/แถวที่ผิดเป็นภาษาไทย (ยังไม่บันทึก)
POST /employees/import    ตรวจแล้วบันทึกลงตาราง employees (เฉพาะผู้ดูแลระบบ ต้องตั้ง DATABASE_URL และไฟล์ต้องไม่มีแถวผิด)

ตรวจด้วย schemas.EmployeeInput ตัวเดียวกับ /predict, /whatif จึงตรงกับที่โมเดลรับได้จริง
ห้ามใช้กับข้อมูลพนักงานจริง: login ตอนนี้เป็นบัญชีทดลอง (auth.py) และ MLflow ของทีมเป็นสาธารณะ
เงินเดือนรับเป็นบาท แปลงเป็นหน่วยโมเดล (USD) ตอนบันทึก ด้วย business_rules.THB_PER_USD (DE-01)
"""

import io
import logging
import zipfile
from typing import Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

import auth
import model_store as ms
from schemas import EmployeeInput
import batch_score
import business_rules  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)
import db  # noqa: E402

router = APIRouter(tags=["employees"])
log = logging.getLogger(__name__)

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 10_000
MAX_ERRORS = 200  # ส่งกลับไม่เกินนี้ ที่เหลือบอกแค่จำนวน
THB_PER_USD = business_rules.THB_PER_USD
MAX_UNZIPPED = 60 * 1024 * 1024  # .xlsx คือ zip: 10,000 แถวจริงแตกออกมาไม่ถึง 20 MB เกินนี้ = zip bomb

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
    ("JobLevel", "ระดับตำแหน่ง", "จูเนียร์ / พนักงานระดับกลาง / ซีเนียร์ / ผู้จัดการแผนก / ผู้จัดการใหญ่ (หรือ 1–5)"),
    ("MonthlyIncome", "เงินเดือน (บาท)", "บาทต่อเดือน"),
    ("PercentSalaryHike", "เงินเดือนขึ้นล่าสุด (%)", "0–100"),
    ("StockOptionLevel", "สิทธิ์ซื้อหุ้นพนักงาน", "0 ไม่มี, 1–3"),
    ("OverTime", "ทำงานล่วงเวลา (OT)", "ทำ / ไม่ทำ"),
    ("BusinessTravel", "เดินทางไปทำงานนอกสถานที่", "ไม่ต้องไป / นานๆ ครั้ง / บ่อย (ไปหาลูกค้า/สาขาอื่น ไม่ใช่การเดินทางไปออฟฟิศทุกวัน)"),
    ("DistanceFromHome", "ระยะทางจากบ้าน (กม.)", "ตัวเลขจำนวนเต็ม"),
    ("JobSatisfaction", "พอใจในงานที่ทำ", "1 ต่ำ – 4 สูงมาก · จากแบบสำรวจพนักงาน"),
    ("EnvironmentSatisfaction", "พอใจสภาพแวดล้อมที่ทำงาน", "1 ต่ำ – 4 สูงมาก · จากแบบสำรวจพนักงาน"),
    ("RelationshipSatisfaction", "พอใจความสัมพันธ์กับเพื่อนร่วมงาน", "1 ต่ำ – 4 สูงมาก · จากแบบสำรวจพนักงาน"),
    ("JobInvolvement", "ความทุ่มเทให้กับงาน", "1 ต่ำ – 4 สูงมาก · จากการประเมินของหัวหน้า"),
    ("WorkLifeBalance", "สมดุลงานกับชีวิต", "1 แย่ – 4 ดีมาก · จากแบบสำรวจพนักงาน"),
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
# ผลจริงว่าลาออกหรือยัง ใช้เฉพาะไฟล์ปรับเทียบ (/recalibrate/upload) ไฟล์นำเข้าปกติมีก็ได้ไม่มีก็ได้ (ไม่ได้บันทึก)
LABEL = ("Attrition", "ลาออกแล้วหรือยัง", "ลาออก / ยังอยู่")
# ช่องจากแบบสำรวจความผูกพัน/ความพึงพอใจ (engagement survey, pulse survey) และการประเมินของหัวหน้า
# หลายบริษัทไม่มีข้อมูลนี้ทุกคน: เว้นว่างหรือไม่มีคอลัมน์ได้ ระบบใส่ 3 ให้เอง (ค่ากลางของ IBM dataset ทั้ง 5 ช่อง)
# ponytail: ค่ากลางทำให้คะแนนส่วนนี้ "เป็นกลาง" ไม่ได้สะท้อนตัวคนจริง ถ้าบริษัทมีแบบสำรวจควรกรอกค่าจริง
SURVEY_FIELDS = ("JobSatisfaction", "EnvironmentSatisfaction", "RelationshipSatisfaction", "JobInvolvement", "WorkLifeBalance")
SURVEY_DEFAULT = 3
# ระดับตำแหน่งเป็นคำ (ตรงกับ JOB_LEVELS ใน frontend/src/featureLabels.js) ค่าที่ส่งเข้าโมเดลยังเป็น 1–5
JOB_LEVELS = {1: "จูเนียร์", 2: "พนักงานระดับกลาง", 3: "ซีเนียร์", 4: "ผู้จัดการแผนก", 5: "ผู้จัดการใหญ่"}
THAI = {f: th for f, th, _ in COLUMNS + [LABEL]}
HINT = {f: hint for f, _, hint in COLUMNS + [LABEL]}
# รับได้ทั้งหัวคอลัมน์ไทยและชื่อคอลัมน์ IBM (ไฟล์ที่ export จากระบบเดิม)
HEADER_TO_FIELD = (
    {th: f for f, th, _ in COLUMNS + [LABEL]}
    | {f: f for f, _, _ in COLUMNS + [LABEL]}
    | {"การเดินทางไปทำงาน": "BusinessTravel"}  # หัวคอลัมน์ชื่อเดิม ไฟล์ที่กรอกไว้ก่อนเปลี่ยนชื่อยังใช้ได้
)

# ค่าภาษาไทย -> ค่าที่โมเดลรู้จัก (รับค่าภาษาอังกฤษแบบ IBM ได้ด้วย)
THAI_VALUES = {
    "Gender": {"ชาย": "Male", "หญิง": "Female"},
    "MaritalStatus": {"โสด": "Single", "สมรส": "Married", "แต่งงาน": "Married", "หย่า": "Divorced"},
    "OverTime": {"ทำ": "Yes", "ไม่ทำ": "No", "ใช่": "Yes", "ไม่ใช่": "No"},
    "BusinessTravel": {"ไม่ต้องไป": "Non-Travel", "ไม่เดินทาง": "Non-Travel", "นานๆ ครั้ง": "Travel_Rarely", "นานๆครั้ง": "Travel_Rarely", "บ่อย": "Travel_Frequently"},
    "Attrition": {"ลาออก": "Yes", "ลาออกแล้ว": "Yes", "ยังอยู่": "No", "ยังทำงานอยู่": "No"},
    "JobLevel": {name: level for level, name in JOB_LEVELS.items()},
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
    saved_ids: list[int] = []  # รหัสพนักงานที่เพิ่งบันทึก (ไม่เกิน 20 คนแรก) ให้หน้าเว็บกดไปดูได้
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
            with zipfile.ZipFile(io.BytesIO(data)) as z:  # เช็กขนาดหลังแตกก่อน parse (กันไฟล์เล็กที่แตกเป็น GB)
                if sum(i.file_size for i in z.infolist()) > MAX_UNZIPPED:
                    raise HTTPException(413, "ไฟล์ Excel ใหญ่ผิดปกติเมื่อแตกออก แบ่งไฟล์หรือบันทึกเป็น CSV แล้วลองใหม่")
            return pd.read_excel(io.BytesIO(data), dtype=object, engine="openpyxl")
    except HTTPException:
        raise
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


def to_model_units(rows: pd.DataFrame) -> pd.DataFrame:
    """เงินเดือนบาท -> หน่วยของโมเดล (USD จำนวนเต็ม) ก่อนบันทึก/ให้คะแนน"""
    rows = rows.copy()
    rows["MonthlyIncome"] = (rows["MonthlyIncome"].astype(float) / THB_PER_USD).round().clip(lower=1).astype(int)
    return rows


async def _check(file: UploadFile, label: bool = False):
    """ตรวจไฟล์ คืน (แถวที่ถูกต้องเป็นชื่อคอลัมน์ IBM เงินเดือนยังเป็นบาท, ผลตรวจ)
    label=True: ต้องมีคอลัมน์ "ลาออกแล้วหรือยัง" ทุกแถว (ไฟล์ปรับเทียบ) และใส่ Attrition = Yes/No ในแถวที่คืน"""
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
    missing = [THAI[f] for f, _, _ in COLUMNS + ([LABEL] if label else []) if f not in present and f not in SURVEY_FIELDS]
    unknown = [h for h in headers if h not in HEADER_TO_FIELD and not h.startswith("Unnamed")]

    errors: list[RowError] = []
    seen_ids: dict = {}
    preview, valid, n_valid = [], [], 0
    for i, raw in enumerate(df.to_dict("records")):
        excel_row = i + 2
        row = {mapped[h]: _clean(v) for h, v in raw.items() if h in mapped}
        if all(v is None for v in row.values()):
            continue  # แถวว่างท้ายไฟล์
        shown = dict(row)  # ค่าตามที่ผู้ใช้กรอก (ภาษาไทย) ไว้โชว์ในตัวอย่าง ก่อนแปลงเป็นค่าของโมเดล
        for field in SURVEY_FIELDS:  # ไม่มีข้อมูลแบบสำรวจ = ใช้ค่ากลาง ไม่แจ้งเป็นข้อผิดพลาด
            if row.get(field) is None:
                row[field] = SURVEY_DEFAULT
        for field, table in THAI_VALUES.items():
            if isinstance(row.get(field), str):
                row[field] = table.get(row[field], row[field])
        row_errors = []

        attrition = row.pop("Attrition", None)  # ไม่ใช่ฟีเจอร์ของโมเดล แยกออกก่อนตรวจ
        if label and "Attrition" in present and attrition not in ("Yes", "No"):
            row_errors.append(RowError(row=excel_row, column=LABEL[1], message="ว่างอยู่ ต้องกรอก" if attrition is None else f"ค่าไม่ถูกต้อง ต้องเป็น: {LABEL[2]}"))

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

        checked = None
        try:
            checked = EmployeeInput(**{k: v for k, v in row.items() if v is not None})
        except ValidationError as e:
            for err in e.errors():
                field = str(err["loc"][0]) if err["loc"] else ""
                if field in present or err["type"] != "missing":  # คอลัมน์ที่ขาดทั้งคอลัมน์ บอกครั้งเดียวด้านบน
                    row_errors.append(RowError(row=excel_row, column=THAI.get(field, field), message=_message(err, field)))

        if row_errors:
            errors.extend(row_errors)
        else:
            n_valid += 1
            if checked:  # None = ผ่านแต่ขาดทั้งคอลัมน์ (บอกใน missing_columns) บันทึกไม่ได้
                valid.append(checked.model_dump() | {"EmployeeNumber": emp_id} | ({"Attrition": attrition} if label else {}))  # ค่าที่แปลงชนิดแล้ว ("41" -> 41)
            if len(preview) < 5:
                preview.append({THAI["EmployeeNumber"]: str(emp_id)} | {THAI[f]: shown.get(f) for f, _, _ in COLUMNS[1:9]})

    n_rows = n_valid + len({e.row for e in errors})
    return valid, ValidateResponse(
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


@router.post("/employees/validate", response_model=ValidateResponse)
async def validate_upload(file: UploadFile = File(...)):
    return (await _check(file))[1]


@router.post("/employees/import", response_model=ValidateResponse)
async def import_employees(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(auth.require_admin),
    _=Depends(auth.LIMITS["import"].per_user),
):
    """บันทึกทั้งไฟล์ (ทุกแถวต้องถูกต้อง) รหัสพนักงานที่มีอยู่แล้ว = อัปเดตเป็นข้อมูลใหม่"""
    if not db.url():
        raise HTTPException(503, "ระบบยังไม่ได้ต่อฐานข้อมูล บันทึกไม่ได้ (ผู้ดูแลต้องตั้ง DATABASE_URL)")
    valid, result = await _check(file)
    if result.missing_columns or result.n_invalid or not valid:
        raise HTTPException(422, "ไฟล์ยังมีคอลัมน์ที่ขาดหรือแถวที่ผิด กด \"ตรวจไฟล์\" แล้วแก้ให้ครบก่อนบันทึก")
    rows = to_model_units(pd.DataFrame(valid))
    try:
        with db.connect() as conn:
            existing = {r[0] for r in conn.execute("SELECT employee_id FROM employees WHERE tenant_id = %s", (user["tenant_id"],))}
            db.upsert_employees(conn, rows, user["tenant_id"], "upload")
    except db.IntegrityError as e:  # CHECK ของตารางเข้มกว่า schemas.py บางข้อ (เช่น อายุ 15–80) ทั้งไฟล์ไม่ถูกบันทึก
        log.warning("employees/import: ฐานข้อมูลไม่รับ constraint=%s", e)  # ชื่อ constraint เท่านั้น ไม่มีข้อมูลพนักงาน
        raise HTTPException(422, "มีค่าบางแถวเกินช่วงที่ฐานข้อมูลรับ (เช่น อายุ 15–80 ปี) ยังไม่ได้บันทึกอะไร ตรวจไฟล์แล้วลองใหม่")
    ms.raw_employees.cache_clear()  # ให้ทุกหน้าเห็นพนักงานที่เพิ่ง import
    ms.employee_features.cache_clear()
    background.add_task(batch_score.refresh_in_background)  # คำนวณสรุปใหม่หลังตอบกลับ ให้ /company-summary กลับมาใช้ cache
    n_updated = len(existing & set(rows["EmployeeNumber"]))
    return result.model_copy(
        update={
            "saved": True,
            "note": f"บันทึกแล้ว: เพิ่มใหม่ {len(rows) - n_updated:,} คน อัปเดต {n_updated:,} คน",
            "saved_ids": [int(i) for i in rows["EmployeeNumber"].head(20)],
        }
    )


def _example_rows(n: int = 2, label: bool = False) -> list[dict]:
    """แถวตัวอย่างจาก IBM dataset (แปลงค่าเป็นภาษาไทย เงินเดือน × 35 เป็นบาท ให้ดูเป็นตัวอย่างเท่านั้น)
    label=True (ไฟล์ปรับเทียบ): เอาเฉพาะคนที่รู้ผลจริงแล้ว พนักงานที่นำเข้าเองยังไม่มีผลลาออก ใส่ไปจะทำให้ไฟล์ไม่ผ่าน"""
    raw = ms.raw_employees()
    raw = (raw[raw["Attrition"].isin(["Yes", "No"])] if label else raw).head(n)
    back = {
        "Attrition": {"Yes": "ลาออก", "No": "ยังอยู่"},
        "JobLevel": JOB_LEVELS,
        "Gender": {"Male": "ชาย", "Female": "หญิง"},
        "MaritalStatus": {"Single": "โสด", "Married": "สมรส", "Divorced": "หย่า"},
        "OverTime": {"Yes": "ทำ", "No": "ไม่ทำ"},
        "BusinessTravel": {"Non-Travel": "ไม่ต้องไป", "Travel_Rarely": "นานๆ ครั้ง", "Travel_Frequently": "บ่อย"},
    }
    rows = []
    for rec in raw.to_dict("records"):
        out = {}
        for field, th, _ in COLUMNS + ([LABEL] if label else []):
            v = rec[field]
            out[th] = round(v * THB_PER_USD / 100) * 100 if field == "MonthlyIncome" else back.get(field, {}).get(v, v)
        rows.append(out)
    return rows


@router.get("/employees/template")
def download_template(n_examples: Optional[int] = 2):
    """ไฟล์ Excel ตัวอย่าง: ชีต "พนักงาน" (หัวคอลัมน์ + แถวตัวอย่าง) และชีต "คำอธิบาย" """
    return template_response(_example_rows(max(0, min(n_examples or 0, 5))), COLUMNS, "employee_template.xlsx")


def template_response(rows: list[dict], columns: list, filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        pd.DataFrame(rows, columns=[th for _, th, _ in columns]).to_excel(xw, sheet_name="พนักงาน", index=False)
        pd.DataFrame(
            [{"คอลัมน์": th, "ต้องกรอก": "ไม่บังคับ (ว่าง = พอใจ/ดี)" if f in SURVEY_FIELDS else "ต้อง", "ค่าที่รับ": hint} for f, th, hint in columns]
        ).to_excel(
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
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
