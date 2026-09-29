"""GET /company-summary ตาม README 6.6

ponytail: ใช้ mean |SHAP| จาก src/shap_explain.py + ตารางคำแนะนำชั่วคราว
แทนที่ด้วย company summary module ของ Saphondanai + Nanthamon เมื่อเสร็จ (แก้แค่ในฟังก์ชันนี้ response คงเดิม)
ยังไม่ได้ cache ลง company_risk_summary และยังไม่รวม financial impact
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import model_store as ms
from shap_explain import mean_abs_shap

router = APIRouter(tags=["explain"])

# ถ้อยคำเชิงทิศทางตาม README 6.6 (SHAP ไม่ใช่เหตุและผล)
RECOMMENDATIONS = {
    "OverTime": "ทบทวนนโยบาย OT / ภาระงาน น่าจะช่วยลดความเสี่ยง",
    "OverTimeXDistance": "ทบทวนนโยบาย OT โดยเฉพาะพนักงานที่บ้านไกล น่าจะช่วยลดความเสี่ยง",
    "WorkLifeBalance": "พิจารณาสวัสดิการ/ความยืดหยุ่นเวลาทำงาน",
    "MonthlyIncome": "ทบทวนโครงสร้างเงินเดือนเทียบตลาด",
    "StockOptionLevel": "พิจารณาสิทธิ์ซื้อหุ้น/สวัสดิการระยะยาวสำหรับพนักงานกลุ่มเสี่ยง",
    "AvgSatisfaction": "สำรวจความพึงพอใจเชิงลึกรายทีม",
    "JobSatisfaction": "สำรวจความพึงพอใจในงานรายทีม",
    "EnvironmentSatisfaction": "ทบทวนสภาพแวดล้อมการทำงาน",
    "YearsWithCurrManager": "ดูแลช่วงเปลี่ยนหัวหน้าเป็นพิเศษ",
}


class Factor(BaseModel):
    feature: str
    mean_abs_shap: float
    recommendation: Optional[str] = None


class CompanySummary(BaseModel):
    department: Optional[str]
    n_employees: int
    mean_risk_score: float
    top_factors: list[Factor]
    note: str = "SHAP บอกความสัมพันธ์กับโมเดล ไม่ใช่เหตุและผลที่พิสูจน์แล้ว"


@router.get("/company-summary", response_model=CompanySummary)
def company_summary(department: Optional[str] = None, top_n: int = Query(5, ge=1, le=50)):
    X = ms.employee_features()
    if department:
        departments = ms.raw_employees()["Department"]
        if department not in set(departments):
            raise HTTPException(404, f"ไม่พบแผนก '{department}' (มี: {sorted(departments.unique())})")
        X = X[departments.to_numpy() == department]
    ranking = mean_abs_shap(ms.explainer()(X)).head(top_n)
    return CompanySummary(
        department=department,
        n_employees=len(X),
        mean_risk_score=float(ms.risk_scores(X).mean()),
        top_factors=[
            Factor(feature=f, mean_abs_shap=float(v), recommendation=RECOMMENDATIONS.get(f)) for f, v in ranking.items()
        ],
    )
