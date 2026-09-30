"""GET /company-summary ตาม README 6.6

คำนวณด้วย src/company_summary.py (module ของ Saphondanai + Nanthamon): จัดอันดับปัจจัยด้วย mean |SHAP|
โดยรวม one-hot กลับเป็นฟีเจอร์เดิม, คำแนะนำ rule-based และ financial impact จาก src/business_rules.py
ponytail: ยังไม่ได้ cache ลง company_risk_summary (รอ dev database กลาง) คำนวณสดทุกครั้ง
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import model_store as ms
import company_summary as cs  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)

router = APIRouter(tags=["explain"])


class Factor(BaseModel):
    feature: str
    mean_abs_shap: float
    share: float  # สัดส่วนของ mean |SHAP| รวมทุกปัจจัย
    actionable: bool  # บริษัทปรับได้ผ่านนโยบายหรือไม่
    recommendation: Optional[str] = None


class Summary(BaseModel):
    n_employees: int
    mean_risk_score: float
    risk_bands: dict[str, int]  # README 6.1: High / Medium / Low
    expected_loss_total: float  # ผลรวม risk_score x ต้นทุนหาคนแทน (ใช้เทียบลำดับ ไม่ใช่ยอดเงินจริง)
    high_risk_replacement_cost: float
    top_factors: list[Factor]


class CompanySummary(Summary):
    department: Optional[str]
    note: str = cs.NOTE


class DepartmentSummary(Summary):
    department: str


class DepartmentsResponse(BaseModel):
    departments: list[DepartmentSummary]
    note: str = cs.NOTE


def _inputs():
    X = ms.employee_features()
    return ms.explainer()(X).values, list(X.columns), ms.risk_scores(X), ms.raw_employees()


@router.get("/company-summary", response_model=CompanySummary)
def company_summary(department: Optional[str] = None, top_n: int = Query(5, ge=1, le=50)):
    shap_values, names, risk, employees = _inputs()
    if department:
        departments = employees["Department"]
        if department not in set(departments):
            raise HTTPException(404, f"ไม่พบแผนก '{department}' (มี: {sorted(departments.unique())})")
        mask = departments.to_numpy() == department
        shap_values, risk, employees = shap_values[mask], risk[mask], employees[mask]
    return CompanySummary(department=department, **cs.summarize(shap_values, names, risk, employees, top_n))


@router.get("/company-summary/departments", response_model=DepartmentsResponse)
def departments_summary(top_n: int = Query(3, ge=1, le=50)):
    """ทุกแผนกในครั้งเดียว เรียงตามมูลค่าความเสี่ยงรวม สำหรับหน้า Company Summary / Superset"""
    return DepartmentsResponse(departments=cs.by_department(*_inputs(), top_n=top_n))
