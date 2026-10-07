"""GET /company-summary ตาม README 6.6

คำนวณด้วย src/company_summary.py (module ของ Saphondanai + Nanthamon): จัดอันดับปัจจัยด้วย mean |SHAP|
โดยรวม one-hot กลับเป็นฟีเจอร์เดิม, คำแนะนำ rule-based และ financial impact จาก src/business_rules.py
ponytail: ยังไม่ได้ cache ลง company_risk_summary (รอ dev database กลาง) คำนวณสดทุกครั้ง
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import calibration
import model_store as ms
from routers.predict import load_calibration
import business_rules  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)
import company_summary as cs  # noqa: E402

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


class TopEmployee(BaseModel):
    employee_id: int
    risk_score: float
    calibrated_risk_score: Optional[float] = None  # มีเมื่อส่ง tenant_id ที่ recalibrate แล้ว (ตรงกับ /shap, /whatif)
    risk_band: str  # คิดจาก calibrated_risk_score ถ้ามี
    risk_band_th: str
    department: str
    job_role: str
    job_level: int


class TopEmployeesResponse(BaseModel):
    employees: list[TopEmployee]
    note: str = "เรียงตามคะแนนความเสี่ยงจากมากไปน้อย ใช้เลือกว่าควรดูใครก่อน ไม่ใช่คำตัดสิน"


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


@router.get("/company-summary/top-employees", response_model=TopEmployeesResponse)
def top_employees(
    n: int = Query(10, ge=1, le=100),
    department: Optional[str] = None,
    tenant_id: Optional[str] = Query(None, pattern=calibration.TENANT_ID_PATTERN),
):
    """พนักงานที่คะแนนความเสี่ยงสูงสุด n คน (ทั้งบริษัทหรือแผนกเดียว) ให้หน้าเว็บกดเลือกได้โดยไม่ต้องรู้รหัส
    ส่ง tenant_id แล้วจัดลำดับ/แบ่งระดับด้วยคะแนนที่ปรับเทียบ ให้ตรงกับหน้า SHAP/What-if"""
    record = load_calibration(tenant_id)
    X = ms.employee_features()
    employees = ms.raw_employees().set_index("EmployeeNumber").loc[X.index]
    raw = ms.risk_scores(X)
    rows = employees.assign(risk_score=raw, shown=calibration.apply(record, raw) if record else raw)
    if department:
        if department not in set(rows["Department"]):
            raise HTTPException(404, f"ไม่พบแผนก '{department}' (มี: {sorted(rows['Department'].unique())})")
        rows = rows[rows["Department"] == department]
    top = rows.nlargest(n, "shown")
    return TopEmployeesResponse(
        employees=[
            TopEmployee(
                employee_id=int(emp_id),
                risk_score=float(r.risk_score),
                calibrated_risk_score=float(r.shown) if record else None,
                risk_band=(band := business_rules.risk_band(r.shown)),
                risk_band_th=business_rules.RISK_BANDS[band],
                department=r.Department,
                job_role=r.JobRole,
                job_level=int(r.JobLevel),
            )
            for emp_id, r in top.iterrows()
        ]
    )
