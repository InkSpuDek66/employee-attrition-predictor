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
import re
import zipfile
from typing import Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

import auth
import model_store as ms
from schemas import INCOME_IN_THB, EmployeeInput
import batch_score
import business_rules  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)
import db  # noqa: E402

router = APIRouter(tags=["employees"])
log = logging.getLogger(__name__)
SCHEMA_OUTDATED = "ฐานข้อมูลยังเป็นโครงสร้างรุ่นเก่า บันทึกไม่ได้ ให้ผู้ดูแลระบบอัปเดตตามหัวข้อ \"หลัง pull\" ใน docs/run_guide.md แล้วลองใหม่"

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 10_000
MAX_ERRORS = 200  # ส่งกลับไม่เกินนี้ ที่เหลือบอกแค่จำนวน
THB_PER_USD = business_rules.THB_PER_USD
MAX_UNZIPPED = 60 * 1024 * 1024  # .xlsx คือ zip: 10,000 แถวจริงแตกออกมาไม่ถึง 20 MB เกินนี้ = zip bomb

# (ฟิลด์ของโมเดล, หัวคอลัมน์ภาษาไทยใน template, คำอธิบาย/ตัวเลือก)
COLUMNS = [
    ("EmployeeNumber", "รหัสพนักงาน", "ตัวเลข ไม่ซ้ำกัน"),
    ("Age", "อายุ", "ปี"),
    ("Gender", "เพศ", "ชาย / หญิง · ไม่บังคับ ระบบไม่นำไปคำนวณ ใช้ตรวจความเป็นธรรมของโมเดลเท่านั้น"),
    ("MaritalStatus", "สถานภาพสมรส", "โสด / สมรส / หย่า"),
    ("Education", "ระดับการศึกษา", "1 ต่ำกว่า ป.ตรี, 2 อนุปริญญา, 3 ป.ตรี, 4 ป.โท, 5 ป.เอก"),
    ("EducationField", "สาขาที่เรียน", "Life Sciences / Medical / Marketing / Technical Degree / Human Resources / Other"),
    ("Department", "กลุ่มแผนก (ให้โมเดล)", "ฝ่ายขาย / ฝ่ายวิจัยและพัฒนา / ฝ่ายบุคคล (หรือ Sales / Research & Development / Human Resources) · เว้นว่างได้ถ้าช่อง \"แผนก\" เป็นชื่อเดียวกับกลุ่ม"),
    ("JobRole", "กลุ่มตำแหน่ง (ให้โมเดล)", "ดูชีต \"ตัวเลือก\" · เว้นว่างได้ถ้าช่อง \"ตำแหน่งงาน\" เป็นชื่อเดียวกับกลุ่ม"),
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
    ("OfficeDaysPerWeek", "เข้าออฟฟิศ (วัน/สัปดาห์)", "0–5 (0 = WFH ทั้งหมด) · จากนโยบายการทำงานหรือระบบลงเวลา"),
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
# ชื่อ-นามสกุล: ไม่บังคับ ใช้แสดงผลในหน้าเว็บเท่านั้น ไม่ส่งเข้าโมเดล (ตัดออกก่อนตรวจด้วย EmployeeInput)
# ไม่อยู่ใน COLUMNS เพราะ COLUMNS = ฟิลด์ของโมเดล (ไฟล์ปรับเทียบ / แถวตัวอย่างจาก IBM ใช้ร่วมกัน) ไฟล์นำเข้าใช้ TEMPLATE_COLUMNS
NAME = (db.FULL_NAME, "ชื่อ-นามสกุล", "ไม่บังคับ · ใช้แสดงผลเท่านั้น ระบบไม่นำไปคำนวณความเสี่ยง")
NAME_MAX = 100  # ตรงกับ CHECK ของคอลัมน์ full_name / department_name / job_title
# แผนก/ตำแหน่งจริงของบริษัท: แสดงผลและแยกแผนกในหน้าภาพรวม ส่วนการคำนวณใช้ "กลุ่ม" ของโมเดล (3 แผนก/9 ตำแหน่งของ IBM)
# ชื่อจริงตรงกับกลุ่มอยู่แล้ว (เช่น "Sales" หรือ "ฝ่ายขาย") = ไม่ต้องกรอกช่องกลุ่ม ไฟล์รุ่นก่อนที่มีแค่ "แผนก" แบบ IBM จึงยังใช้ได้
DEPT_NAME = (db.DEPARTMENT_NAME, "แผนก", "ชื่อแผนกจริงของบริษัท ใช้แสดงผลและแยกแผนกในหน้าภาพรวม")
JOB_TITLE = (db.JOB_TITLE, "ตำแหน่งงาน", "ชื่อตำแหน่งจริงของบริษัท ใช้แสดงผล")
DISPLAY = [NAME, DEPT_NAME, JOB_TITLE]  # ช่องที่ใช้แสดงผลเท่านั้น ไม่ส่งเข้าโมเดล
GROUP_OF = {db.DEPARTMENT_NAME: "Department", db.JOB_TITLE: "JobRole"}  # ชื่อจริง -> ช่องกลุ่มของโมเดลที่คู่กัน
_BEFORE = {"Department": DEPT_NAME, "JobRole": JOB_TITLE}  # ใน template ชื่อจริงอยู่หน้าช่องกลุ่ม
TEMPLATE_COLUMNS = []
for _col in COLUMNS:
    TEMPLATE_COLUMNS += [_col, NAME] if _col[0] == "EmployeeNumber" else [_BEFORE[_col[0]], _col] if _col[0] in _BEFORE else [_col]
EXAMPLE_NAMES = ["สมชาย (ตัวอย่าง)", "สมหญิง (ตัวอย่าง)"]
# ชื่อแผนก/ตำแหน่งภาษาไทยในแถวตัวอย่างของ template (บริษัทจริงใช้ชื่อของตัวเอง)
EXAMPLE_DEPARTMENTS = {"Sales": "ฝ่ายขาย", "Research & Development": "ฝ่ายวิจัยและพัฒนา", "Human Resources": "ฝ่ายบุคคล"}
EXAMPLE_TITLES = {
    "Sales Executive": "เจ้าหน้าที่ขาย",
    "Research Scientist": "นักวิจัย",
    "Laboratory Technician": "นักเทคนิคห้องปฏิบัติการ",
    "Manufacturing Director": "ผู้อำนวยการฝ่ายผลิต",
    "Healthcare Representative": "ผู้แทนฝ่ายสุขภาพ",
    "Manager": "ผู้จัดการ",
    "Sales Representative": "พนักงานขาย",
    "Research Director": "ผู้อำนวยการฝ่ายวิจัย",
    "Human Resources": "เจ้าหน้าที่ฝ่ายบุคคล",
}
# ผลจริงว่าลาออกหรือยัง ใช้เฉพาะไฟล์ปรับเทียบ (/recalibrate/upload) ไฟล์นำเข้าปกติมีก็ได้ไม่มีก็ได้ (ไม่ได้บันทึก)
LABEL = ("Attrition", "ลาออกแล้วหรือยัง", "ลาออก / ยังอยู่")
# ช่องจากแบบสำรวจความผูกพัน/ความพึงพอใจ (engagement survey, pulse survey) และการประเมินของหัวหน้า
# หลายบริษัทไม่มีข้อมูลนี้ทุกคน: เว้นว่างหรือไม่มีคอลัมน์ได้ ระบบใส่ 3 ให้เอง (ค่ากลางของ IBM dataset ทั้ง 5 ช่อง)
# ponytail: ค่ากลางทำให้คะแนนส่วนนี้ "เป็นกลาง" ไม่ได้สะท้อนตัวคนจริง ถ้าบริษัทมีแบบสำรวจควรกรอกค่าจริง
SURVEY_FIELDS = ("JobSatisfaction", "EnvironmentSatisfaction", "RelationshipSatisfaction", "JobInvolvement", "WorkLifeBalance")
SURVEY_DEFAULT = 3
# DE-17: ทดสอบให้คะแนนพนักงาน IBM ทั้ง 1,470 คนแบบเติม 3 ทุกช่อง คนเสี่ยงสูงลดจาก 185 เหลือ 105 คน จึงต้องเตือนทุกครั้งที่เติม
SURVEY_WARNING = (
    "พนักงาน {n:,} คนไม่มีข้อมูลแบบสำรวจบางช่อง ระบบใส่ค่า 3 (พอใจ/ดี) ให้ ความเสี่ยงของคนกลุ่มนี้อาจต่ำกว่าจริง"
    " (ทดลองกับข้อมูล IBM: ถ้าไม่มีแบบสำรวจเลย จำนวนคนเสี่ยงสูงลดจาก 185 เหลือ 105 คน) ถ้ามีผลแบบสำรวจ ควรกรอกค่าจริง"
)
# ช่องที่เว้นว่าง/ไม่มีคอลัมน์ได้ -> ค่าที่ใส่ให้ (วันเข้าออฟฟิศ: ไม่มีข้อมูล = เข้าทุกวันเหมือน IBM)
OPTIONAL_DEFAULTS = {**{f: SURVEY_DEFAULT for f in SURVEY_FIELDS}, "OfficeDaysPerWeek": 5}
# ช่องที่เว้นว่าง/ไม่มีคอลัมน์ได้ และไม่ใส่ค่าแทน (บันทึกเป็นว่าง): เพศ ไม่ใช้คำนวณตั้งแต่โมเดล v2
NULLABLE = {"Gender"}
# ระดับตำแหน่งเป็นคำ (ตรงกับ JOB_LEVELS ใน frontend/src/featureLabels.js) ค่าที่ส่งเข้าโมเดลยังเป็น 1–5
JOB_LEVELS = {1: "จูเนียร์", 2: "พนักงานระดับกลาง", 3: "ซีเนียร์", 4: "ผู้จัดการแผนก", 5: "ผู้จัดการใหญ่"}
THAI = {f: th for f, th, _ in COLUMNS + [LABEL, *DISPLAY]}
HINT = {f: hint for f, _, hint in COLUMNS + [LABEL, *DISPLAY]}
# รับได้ทั้งหัวคอลัมน์ไทยและชื่อคอลัมน์ IBM (ไฟล์ที่ export จากระบบเดิม)
HEADER_TO_FIELD = (
    {th: f for f, th, _ in COLUMNS + [LABEL, *DISPLAY]}
    | {f: f for f, _, _ in COLUMNS + [LABEL, *DISPLAY]}
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
    "Department": {th: en for en, th in EXAMPLE_DEPARTMENTS.items()} | {"วิจัยและพัฒนา": "Research & Development", "ทรัพยากรบุคคล": "Human Resources"},
}
DEPARTMENTS = set(EmployeeInput.model_fields["Department"].annotation.__args__)
JOB_ROLES = set(EmployeeInput.model_fields["JobRole"].annotation.__args__)


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
    survey_imputed: int = 0  # แถวที่ผ่านแต่ระบบเติมค่าแบบสำรวจให้อย่างน้อย 1 ช่อง (DE-17)
    warnings: list[str] = []  # เรื่องที่ไม่ทำให้ไฟล์ไม่ผ่าน แต่ผู้ใช้ควรรู้ก่อนบันทึก
    saved: bool = False
    saved_ids: list[int] = []  # รหัสพนักงานที่เพิ่งบันทึก (ไม่เกิน 20 คนแรก) ให้หน้าเว็บกดไปดูได้
    saved_names: dict[int, str] = {}  # ชื่อของคนใน saved_ids (เฉพาะคนที่กรอกชื่อ)
    # บอกก่อนบันทึก (ต้องต่อ DB): รหัสใหม่ / รหัสที่มีอยู่แล้ว (รวมคนที่เคยออกแล้วกลับมา) / คนที่จะถูกบันทึกว่าออกแล้ว
    n_new: Optional[int] = None
    n_update: Optional[int] = None
    n_leaving: Optional[int] = None  # มีเมื่อเลือก "ไฟล์นี้คือพนักงานทั้งหมดตอนนี้" (full_roster)
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


THOUSANDS = re.compile(r"-?\d{1,3}(,\d{3})+(\.\d+)?")


def _clean(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        value = value.strip()
        if THOUSANDS.fullmatch(value):  # "45,000" ตามที่ Excel จัดรูปแบบ (UX-16)
            value = value.replace(",", "")
        return value or None
    return value


def to_model_units(rows: pd.DataFrame) -> pd.DataFrame:
    """เงินเดือนบาท -> หน่วยของโมเดล (USD จำนวนเต็ม) ก่อนบันทึก/ให้คะแนน"""
    rows = rows.copy()
    rows["MonthlyIncome"] = (rows["MonthlyIncome"].astype(float) / THB_PER_USD).round().clip(lower=1).astype(int)
    return rows


def _check(file: UploadFile, label: bool = False):
    """ตรวจไฟล์ คืน (แถวที่ถูกต้องเป็นชื่อคอลัมน์ IBM เงินเดือนยังเป็นบาท, ผลตรวจ)
    label=True: ต้องมีคอลัมน์ "ลาออกแล้วหรือยัง" ทุกแถว (ไฟล์ปรับเทียบ) และใส่ Attrition = Yes/No ในแถวที่คืน
    ฟังก์ชันธรรมดา (ไม่ใช่ async) ให้ endpoint ที่เรียกเป็น def ซึ่ง FastAPI รันใน threadpool
    งานตรวจ 10,000 แถวจึงไม่บล็อก event loop จน request อื่นค้าง (SEC-15)"""
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "ไฟล์ใหญ่เกิน 5 MB")
    df = _read(file, data)
    if len(df) > MAX_ROWS:
        raise HTTPException(422, f"มี {len(df):,} แถว เกิน {MAX_ROWS:,} แถว แบ่งไฟล์ก่อนอัปโหลด")

    headers = [str(c).strip() for c in df.columns]
    df.columns = headers
    mapped = {h: HEADER_TO_FIELD[h] for h in headers if h in HEADER_TO_FIELD}
    present = set(mapped.values())
    present |= {group for real, group in GROUP_OF.items() if real in present}  # มีชื่อจริง = เติมกลุ่มจากชื่อได้ (ทีละแถว)
    missing = [THAI[f] for f, _, _ in COLUMNS + ([LABEL] if label else []) if f not in present and f not in OPTIONAL_DEFAULTS and f not in NULLABLE]
    unknown = [h for h in headers if h not in HEADER_TO_FIELD and not h.startswith("Unnamed")]

    errors: list[RowError] = []
    seen_ids: dict = {}
    preview, valid, n_valid, n_imputed = [], [], 0, 0
    for i, raw in enumerate(df.to_dict("records")):
        excel_row = i + 2
        row = {mapped[h]: _clean(v) for h, v in raw.items() if h in mapped}
        if all(v is None for v in row.values()):
            continue  # แถวว่างท้ายไฟล์
        shown = dict(row)  # ค่าตามที่ผู้ใช้กรอก (ภาษาไทย) ไว้โชว์ในตัวอย่าง ก่อนแปลงเป็นค่าของโมเดล
        imputed = any(row.get(f) is None for f in SURVEY_FIELDS)
        for field, default in OPTIONAL_DEFAULTS.items():  # ไม่มีข้อมูล = ใช้ค่าเริ่มต้น ไม่แจ้งเป็นข้อผิดพลาด
            if row.get(field) is None:
                row[field] = default
        for field, table in THAI_VALUES.items():
            if isinstance(row.get(field), str):
                row[field] = table.get(row[field], row[field])
        row_errors = []

        attrition = row.pop("Attrition", None)  # ไม่ใช่ฟีเจอร์ของโมเดล แยกออกก่อนตรวจ
        # ชื่อ / แผนกจริง / ตำแหน่งจริง ไม่ใช่ฟีเจอร์ แยกออกก่อนตรวจ (ไฟล์ปรับเทียบมีคอลัมน์เหล่านี้ได้ ไม่บันทึก)
        shown_as = {f: None if row.get(f) is None else str(row[f]) for f, _, _ in DISPLAY}
        row = {k: v for k, v in row.items() if k not in shown_as}
        for f, th, _ in DISPLAY:
            if shown_as[f] is not None and len(shown_as[f]) > NAME_MAX:
                row_errors.append(RowError(row=excel_row, column=th, message=f"ยาวเกิน {NAME_MAX} ตัวอักษร"))
        reported = set()  # ช่องที่แจ้งเองแล้ว ไม่ให้ pydantic แจ้งซ้ำ
        for real, group in GROUP_OF.items():  # ไม่กรอกกลุ่ม = ใช้ชื่อจริงถ้าตรงกับกลุ่มของโมเดล
            if row.get(group) is None and shown_as[real] is not None:
                guess = THAI_VALUES.get(group, {}).get(shown_as[real], shown_as[real])
                if guess in (DEPARTMENTS if group == "Department" else JOB_ROLES):
                    row[group] = guess
                else:
                    reported.add(group)
                    options = HINT[group].split(" · ")[0]
                    row_errors.append(RowError(row=excel_row, column=THAI[group], message=(
                        f"{THAI[real]} “{shown_as[real]}” ไม่ใช่กลุ่มที่โมเดลรู้จัก กรอกช่อง “{THAI[group]}” ด้วย: {options}")))
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
            checked = EmployeeInput.model_validate({k: v for k, v in row.items() if v is not None}, context=INCOME_IN_THB)
        except ValidationError as e:
            for err in e.errors():
                field = str(err["loc"][0]) if err["loc"] else ""
                if field in reported:
                    continue
                if field in present or err["type"] != "missing":  # คอลัมน์ที่ขาดทั้งคอลัมน์ บอกครั้งเดียวด้านบน
                    row_errors.append(RowError(row=excel_row, column=THAI.get(field, field), message=_message(err, field)))

        if row_errors:
            errors.extend(row_errors)
        else:
            n_valid += 1
            n_imputed += imputed
            if checked:  # None = ผ่านแต่ขาดทั้งคอลัมน์ (บอกใน missing_columns) บันทึกไม่ได้
                valid.append(
                    checked.model_dump()  # ค่าที่แปลงชนิดแล้ว ("41" -> 41)
                    | {"EmployeeNumber": emp_id}
                    | ({"Attrition": attrition} if label else {})
                    # มีคอลัมน์นั้นเท่านั้นถึงบันทึก: ไฟล์ที่ไม่มีคอลัมน์ชื่อ/แผนกจริง อัปเดตแล้วค่าเดิมใน DB ไม่หาย
                    | ({f: shown_as[f] for f, _, _ in DISPLAY if f in mapped.values()} if not label else {})
                )
            if len(preview) < 5:
                preview.append(
                    {THAI["EmployeeNumber"]: str(emp_id)}
                    | {th: shown_as[f] for f, th, _ in DISPLAY if f in mapped.values()}  # ไม่มีคอลัมน์ = ไม่โชว์คอลัมน์ว่าง
                    | {THAI[f]: row.get(f) if shown.get(f) is None else shown.get(f) for f, _, _ in COLUMNS[1:9]}  # กลุ่มที่เติมเอง = โชว์ชื่อกลุ่ม
                )

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
        survey_imputed=n_imputed,
        warnings=[SURVEY_WARNING.format(n=n_imputed)] if n_imputed else [],
    )


# full_roster: เลือกเกินครึ่งของพนักงานปัจจุบันจะถูกบันทึกว่าออก = น่าจะเลือกไฟล์ผิด (เช่น ไฟล์แผนกเดียว) เตือนก่อนบันทึก
LEAVING_WARN = (
    "พนักงาน {n:,} จาก {total:,} คนไม่อยู่ในไฟล์นี้ จะถูกบันทึกว่าออกแล้ว"
    " ถ้าไฟล์นี้มีแค่บางแผนก ให้เอาเครื่องหมาย \"ไฟล์นี้คือพนักงานทั้งหมดตอนนี้\" ออก"
)


def _with_plan(result: ValidateResponse, valid: list, tenant: str, full_roster: bool) -> ValidateResponse:
    """เติมจำนวนที่จะเพิ่ม/อัปเดต/บันทึกว่าออก ให้เห็นก่อนกดบันทึก (ไม่ต่อ DB = ไม่เติม)"""
    if not db.url() or not valid:
        return result
    active, left = db.current_ids(tenant)
    ids = {r["EmployeeNumber"] for r in valid}
    plan = {"n_new": len(ids - active - left), "n_update": len(ids & (active | left))}
    warnings = list(result.warnings)
    if full_roster:
        plan["n_leaving"] = len(active - ids)
        if active and plan["n_leaving"] > len(active) / 2:
            warnings.append(LEAVING_WARN.format(n=plan["n_leaving"], total=len(active)))
    return result.model_copy(update=plan | {"warnings": warnings})


@router.post("/employees/validate", response_model=ValidateResponse)
def validate_upload(
    file: UploadFile = File(...),
    full_roster: bool = Form(False),
    user: dict = Depends(auth.current_user),
    _=Depends(auth.LIMITS["validate"].per_user),
):
    valid, result = _check(file)
    return _with_plan(result, valid, user["tenant_id"], full_roster)


@router.post("/employees/import", response_model=ValidateResponse)
def import_employees(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    full_roster: bool = Form(False),  # ไฟล์นี้คือพนักงานทั้งหมดตอนนี้: คนที่ไม่อยู่ในไฟล์ = บันทึกว่าออกแล้ว (ไม่ลบ)
    user: dict = Depends(auth.require_admin),
    _=Depends(auth.LIMITS["import"].per_user),
):
    """บันทึกทั้งไฟล์ (ทุกแถวต้องถูกต้อง) รหัสพนักงานที่มีอยู่แล้ว = อัปเดตเป็นข้อมูลใหม่ ระบบไม่ออกรหัสให้เอง
    (รหัส = รหัสพนักงานของบริษัท นำเข้าไฟล์เดือนใหม่แล้วคนเดิมไม่ซ้ำเป็นสองคน)"""
    if not db.url():
        raise HTTPException(503, "ระบบยังไม่ได้ต่อฐานข้อมูล บันทึกไม่ได้ (ผู้ดูแลต้องตั้ง DATABASE_URL)")
    valid, result = _check(file)
    if result.missing_columns or result.n_invalid or not valid:
        raise HTTPException(422, "ไฟล์ยังมีคอลัมน์ที่ขาดหรือแถวที่ผิด กด \"ตรวจไฟล์\" แล้วแก้ให้ครบก่อนบันทึก")
    rows = to_model_units(pd.DataFrame(valid))
    n_leaving = None
    try:
        with db.connect() as conn:  # transaction เดียว: บันทึกไม่ผ่าน = ไม่มีใครถูกบันทึกว่าออก
            existing = {r[0] for r in conn.execute("SELECT employee_id FROM employees WHERE tenant_id = %s", (user["tenant_id"],))}
            db.upsert_employees(conn, rows, user["tenant_id"], "upload")
            if full_roster:
                n_leaving = db.mark_left(conn, user["tenant_id"], rows["EmployeeNumber"])
    except db.IntegrityError as e:  # ด่านสุดท้าย: schemas.py ตรวจช่วงเดียวกับ CHECK แล้ว (test_schemas.py) ทั้งไฟล์ไม่ถูกบันทึก
        log.warning("employees/import: ฐานข้อมูลไม่รับ constraint=%s", e)  # ชื่อ constraint เท่านั้น ไม่มีข้อมูลพนักงาน
        raise HTTPException(422, "มีค่าบางแถวเกินช่วงที่ฐานข้อมูลรับ (เช่น อายุ 15–80 ปี) ยังไม่ได้บันทึกอะไร ตรวจไฟล์แล้วลองใหม่")
    except db.SchemaOutdated as e:  # QA-06: DB สร้างก่อนมีคอลัมน์ใหม่ ยังไม่ได้รัน 02-app-schema.sql ซ้ำ
        log.error("employees/import: schema ของฐานข้อมูลเก่ากว่าโค้ด (%s) ให้รัน docker/postgres/init/02-app-schema.sql ซ้ำ", e)
        raise HTTPException(503, SCHEMA_OUTDATED)
    ms.clear_cache()  # ให้ทุกหน้าเห็นพนักงานที่เพิ่ง import ทันที (ไม่ต้องรอรอบตรวจของ model_store)
    background.add_task(batch_score.refresh_in_background, user["tenant_id"])  # คำนวณสรุปใหม่หลังตอบกลับ ให้ /company-summary กลับมาใช้ cache
    n_updated = len(existing & set(rows["EmployeeNumber"]))
    first = rows.head(20)
    names = dict(zip(first["EmployeeNumber"], first[NAME[0]])) if NAME[0] in rows else {}
    return result.model_copy(
        update={
            "saved": True,
            "note": f"บันทึกแล้ว: เพิ่มใหม่ {len(rows) - n_updated:,} คน อัปเดต {n_updated:,} คน"
            + (f" บันทึกว่าออกแล้ว {n_leaving:,} คน" if n_leaving is not None else ""),
            "n_new": len(rows) - n_updated,
            "n_update": n_updated,
            "n_leaving": n_leaving,
            "saved_ids": [int(i) for i in first["EmployeeNumber"]],
            "saved_names": {int(i): n for i, n in names.items() if isinstance(n, str)},
        }
    )


def _example_rows(n: int = 2, label: bool = False) -> list[dict]:
    """แถวตัวอย่างจาก IBM dataset (แปลงค่าเป็นภาษาไทย เงินเดือน × 35 เป็นบาท ให้ดูเป็นตัวอย่างเท่านั้น)
    label=True (ไฟล์ปรับเทียบ): เอาเฉพาะคนที่รู้ผลจริงแล้ว พนักงานที่นำเข้าเองยังไม่มีผลลาออก ใส่ไปจะทำให้ไฟล์ไม่ผ่าน"""
    raw = ms.reference_employees()  # แถวตัวอย่างจาก IBM เสมอ ไม่ใช่พนักงานของบริษัทผู้ใช้
    return template_rows((raw[raw["Attrition"].isin(["Yes", "No"])] if label else raw).head(n), label)


def template_rows(raw: pd.DataFrame, label: bool = False) -> list[dict]:
    """ข้อมูลแบบ IBM (หน่วยของโมเดล) -> แถวในไฟล์ Excel (หัวคอลัมน์/ค่าภาษาไทย เงินเดือน × 35 เป็นบาท)"""
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
            v = rec.get(field)
            out[th] = round(v * THB_PER_USD / 100) * 100 if field == "MonthlyIncome" else back.get(field, {}).get(v, v)
        rows.append(out)
    return rows


@router.get("/employees/template")
def download_template(n_examples: Optional[int] = 2):
    """ไฟล์ Excel ตัวอย่าง: ชีต "พนักงาน" (หัวคอลัมน์ + แถวตัวอย่าง) และชีต "คำอธิบาย" """
    rows = [
        r
        | {NAME[1]: EXAMPLE_NAMES[i % len(EXAMPLE_NAMES)]}
        | {DEPT_NAME[1]: EXAMPLE_DEPARTMENTS[r[THAI["Department"]]], JOB_TITLE[1]: EXAMPLE_TITLES[r[THAI["JobRole"]]]}
        for i, r in enumerate(_example_rows(max(0, min(n_examples or 0, 5))))
    ]
    return template_response(rows, TEMPLATE_COLUMNS, "employee_template.xlsx")


def _required(field: str) -> str:
    if field in SURVEY_FIELDS:
        return "ไม่บังคับ (ว่าง = พอใจ/ดี)"
    if field in OPTIONAL_DEFAULTS:
        return "ไม่บังคับ (ว่าง = 5 วัน)"
    if field in GROUP_OF.values():
        return "ไม่บังคับ ถ้าชื่อจริงตรงกับกลุ่ม"
    if field in GROUP_OF:
        return "ไม่บังคับ (ว่าง = ใช้ชื่อกลุ่ม)"
    return "ไม่บังคับ" if field == NAME[0] or field in NULLABLE else "ต้อง"


def template_response(rows: list[dict], columns: list, filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as xw:
        pd.DataFrame(rows, columns=[th for _, th, _ in columns]).to_excel(xw, sheet_name="พนักงาน", index=False)
        pd.DataFrame(
            [{"คอลัมน์": th, "ต้องกรอก": _required(f), "ค่าที่รับ": hint} for f, th, hint in columns]
        ).to_excel(
            xw, sheet_name="คำอธิบาย", index=False
        )
        roles = EmployeeInput.model_fields["JobRole"].annotation.__args__
        pd.DataFrame(
            {
                "กลุ่มตำแหน่ง (ให้โมเดล)": pd.Series(roles),
                "กลุ่มแผนก (ให้โมเดล)": pd.Series([f"{th} ({en})" for en, th in EXAMPLE_DEPARTMENTS.items()]),
            }
        ).to_excel(xw, sheet_name="ตัวเลือก", index=False)
        for ws in xw.book.worksheets:
            for col in ws.columns:
                ws.column_dimensions[col[0].column_letter].width = max(12, min(40, max(len(str(c.value or "")) for c in col) + 2))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
