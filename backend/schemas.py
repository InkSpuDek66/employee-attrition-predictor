"""Pydantic schema ของข้อมูลพนักงาน 1 คน (รูปแบบเดียวกับ CSV ของ IBM ไม่รวมคอลัมน์ noise และ Attrition)

ใช้ร่วมกันใน /predict และ /whatif ค่าหมวดหมู่จำกัดด้วย Literal เพื่อให้ตอบ 422 ทันทีถ้าส่งค่าที่โมเดลไม่รู้จัก
"""

from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

import calibration

Likert4 = Annotated[int, Field(ge=1, le=4)]


class EmployeeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    Age: int = Field(ge=15, le=100)
    BusinessTravel: Literal["Non-Travel", "Travel_Rarely", "Travel_Frequently"]
    DailyRate: int = Field(ge=0)
    Department: Literal["Sales", "Research & Development", "Human Resources"]
    DistanceFromHome: int = Field(ge=0)
    Education: int = Field(ge=1, le=5)
    EducationField: Literal["Life Sciences", "Medical", "Marketing", "Technical Degree", "Other", "Human Resources"]
    EnvironmentSatisfaction: Likert4
    Gender: Literal["Female", "Male"]
    HourlyRate: int = Field(ge=0)
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
    MonthlyIncome: int = Field(gt=0)
    MonthlyRate: int = Field(ge=0)
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


class EmployeeRef(BaseModel):
    """ระบุพนักงานด้วย employee_id (มีในระบบแล้ว) หรือส่งข้อมูลทั้งก้อนมาใน employee อย่างใดอย่างหนึ่ง"""

    employee_id: Optional[int] = None
    employee: Optional[EmployeeInput] = None
    tenant_id: Optional[str] = Field(None, pattern=calibration.TENANT_ID_PATTERN)


class Score(BaseModel):
    risk_score: float
    calibrated_risk_score: Optional[float] = None
    risk_band: Literal["High", "Medium", "Low"]  # README 6.1 คิดจาก calibrated_risk_score ถ้ามี
    risk_band_th: str
