"""Pydantic schema ของข้อมูลพนักงาน 1 คน (รูปแบบเดียวกับ CSV ของ IBM ไม่รวมคอลัมน์ noise และ Attrition)

ใช้ร่วมกันใน /predict, /whatif และไฟล์นำเข้า ค่าหมวดหมู่จำกัดด้วย Literal เพื่อให้ตอบ 422 ทันทีถ้าส่งค่าที่โมเดลไม่รู้จัก
ช่วงค่าต้องไม่หลวมกว่า CHECK ของตาราง employees (test_schemas.py เทียบให้) ไม่งั้นไฟล์ผ่านขั้นตรวจแต่บันทึกไม่ได้ (DE-10)
"""

from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator
from pydantic_core import PydanticCustomError

import calibration
import business_rules  # noqa: E402  (อยู่ใน src/ ซึ่ง calibration -> model_store เพิ่มเข้า sys.path แล้ว)

Likert4 = Annotated[int, Field(ge=1, le=4)]

MAX_DISTANCE_KM = 100  # UX-04: IBM สูงสุด 29 เกินร้อยกิโลต่อวันแทบเป็นไปไม่ได้ (เคยรับ 5,000 กม.)
# ไฟล์นำเข้ากรอกเงินเดือนเป็นบาท ส่วน /predict, /whatif ใช้หน่วยของโมเดล (DE-01) ส่ง context นี้ตอนตรวจไฟล์
INCOME_IN_THB = {"income_unit": "THB"}


def _too_high(limit: int, what: str):
    # template ของ pydantic แทนค่าแบบ {key} ตรงๆ (ไม่รองรับ format spec) ตัวเลขจึงจัดรูปแบบก่อนส่ง
    return PydanticCustomError("cross_field", "ต้องไม่เกิน {limit} ปี เมื่อเทียบกับ{what}", {"limit": limit, "what": what})


class EmployeeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    Age: int = Field(ge=15, le=80)  # ตรงกับ CHECK ของตาราง employees
    BusinessTravel: Literal["Non-Travel", "Travel_Rarely", "Travel_Frequently"]
    DailyRate: int = Field(gt=0)
    Department: Literal["Sales", "Research & Development", "Human Resources"]
    DistanceFromHome: int = Field(ge=0, le=MAX_DISTANCE_KM)
    Education: int = Field(ge=1, le=5)
    EducationField: Literal["Life Sciences", "Medical", "Marketing", "Technical Degree", "Other", "Human Resources"]
    EnvironmentSatisfaction: Likert4
    Gender: Literal["Female", "Male"]
    HourlyRate: int = Field(gt=0)
    JobInvolvement: Likert4
    JobLevel: int = Field(ge=1, le=5)
    JobRole: Literal[
        "Sales Executive",
        "Research Scientist",
        "Laboratory Technician",
        "Manufacturing Director",
        "Healthcare Representative",
        "Manager",
        "Sales Representative",
        "Research Director",
        "Human Resources",
    ]
    JobSatisfaction: Likert4
    MaritalStatus: Literal["Single", "Married", "Divorced"]
    MonthlyIncome: int = Field(gt=0)  # เพดานดู _income_cap
    MonthlyRate: int = Field(gt=0)
    NumCompaniesWorked: int = Field(ge=0)
    OverTime: Literal["Yes", "No"]
    PercentSalaryHike: int = Field(ge=0, le=100)
    PerformanceRating: Likert4
    RelationshipSatisfaction: Likert4
    StockOptionLevel: int = Field(ge=0, le=3)
    TotalWorkingYears: int = Field(ge=0)
    TrainingTimesLastYear: int = Field(ge=0)
    WorkLifeBalance: Likert4
    YearsAtCompany: int = Field(ge=0)
    YearsInCurrentRole: int = Field(ge=0)
    YearsSinceLastPromotion: int = Field(ge=0)
    YearsWithCurrManager: int = Field(ge=0)
    # วันเข้าออฟฟิศต่อสัปดาห์ (WFH) ไม่บังคับ ค่าเริ่มต้น 5 = เข้าทุกวันเหมือนข้อมูล IBM ใช้ปรับระยะทางก่อนให้คะแนน (model_store.commute_adjusted)
    OfficeDaysPerWeek: int = Field(5, ge=0, le=5)

    # UX-04/DE-10: ค่าที่ขัดกันเองระหว่างช่อง (ข้อมูล IBM ทั้ง 1,470 คนผ่านทุกข้อ)
    # ใช้ field_validator ที่อ่านช่องก่อนหน้าจาก info.data แทน model_validator เพื่อให้ error ผูกกับคอลัมน์
    # ไฟล์นำเข้าจึงบอกได้ว่าแถวไหน คอลัมน์ไหน ช่องที่ตรวจไม่ผ่านไปก่อนจะไม่อยู่ใน info.data จึงข้ามข้อนั้น
    @field_validator("MonthlyIncome")
    @classmethod
    def _income_cap(cls, v: int, info: ValidationInfo) -> int:
        thb = (info.context or {}).get("income_unit") == "THB"
        cap = business_rules.MAX_MONTHLY_INCOME_THB if thb else business_rules.MAX_MONTHLY_INCOME_THB // business_rules.THB_PER_USD
        if v > cap:
            raise PydanticCustomError("cross_field", "ต้องไม่เกิน {cap} {unit}ต่อเดือน", {"cap": f"{cap:,}", "unit": "บาท" if thb else "ดอลลาร์"})
        return v

    @field_validator("TotalWorkingYears")
    @classmethod
    def _working_years_fit_age(cls, v: int, info: ValidationInfo) -> int:
        # กฎหมายแรงงานห้ามจ้างอายุต่ำกว่า 15 ปี เผื่อ 1 ปีให้การปัดเศษอายุ/อายุงานเป็นจำนวนเต็ม
        age = info.data.get("Age")
        if age is not None and v > age - 14:
            raise _too_high(max(age - 14, 0), f"อายุ {age} ปี")
        return v

    @field_validator("YearsAtCompany")
    @classmethod
    def _company_years_fit_career(cls, v: int, info: ValidationInfo) -> int:
        if "TotalWorkingYears" in info.data and v > info.data["TotalWorkingYears"]:
            raise _too_high(info.data["TotalWorkingYears"], "อายุงานรวม")
        return v

    @field_validator("YearsInCurrentRole", "YearsSinceLastPromotion", "YearsWithCurrManager")
    @classmethod
    def _within_company_years(cls, v: int, info: ValidationInfo) -> int:
        if "YearsAtCompany" in info.data and v > info.data["YearsAtCompany"]:
            raise _too_high(info.data["YearsAtCompany"], "จำนวนปีที่อยู่บริษัทนี้")
        return v


class EmployeeRef(BaseModel):
    """ระบุพนักงานด้วย employee_id (มีในระบบแล้ว) หรือส่งข้อมูลทั้งก้อนมาใน employee อย่างใดอย่างหนึ่ง"""

    employee_id: Optional[int] = None
    employee: Optional[EmployeeInput] = None
    # ไม่ต้องส่ง: คะแนนปรับเทียบใช้บริษัทจาก token (DE-11) ส่งบริษัทอื่นได้ 403 จาก auth.same_tenant
    tenant_id: Optional[str] = Field(None, pattern=calibration.TENANT_ID_PATTERN)


class Score(BaseModel):
    risk_score: float
    calibrated_risk_score: Optional[float] = None
    risk_band: Literal["High", "Medium", "Low"]  # README 6.1 คิดจาก calibrated_risk_score ถ้ามี
    risk_band_th: str
