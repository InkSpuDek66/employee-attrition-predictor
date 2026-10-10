"""GET /company-summary ตาม README 6.6

คำนวณด้วย src/company_summary.py (module ของ Saphondanai + Nanthamon): จัดอันดับปัจจัยด้วย mean |SHAP|
โดยรวม one-hot กลับเป็นฟีเจอร์เดิม, คำแนะนำ rule-based และ financial impact จาก src/business_rules.py
ตั้ง DATABASE_URL แล้วอ่านผลจาก backend/batch_score.py (ตาราง company_risk_summary) ถ้าใหม่กว่าข้อมูลพนักงาน
และเป็นโมเดลตัวเดียวกัน ไม่งั้นคำนวณสด (SEC-03 ข้อ 3) ผลเหมือนกันทั้งสองทาง
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

import auth
import calibration
import model_store as ms
import db  # noqa: E402
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
    calibrated_risk_score: Optional[float] = None  # มีเมื่อบริษัทของผู้ใช้ recalibrate แล้ว (ตรงกับ /shap, /whatif)
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


CACHE_SQL = """
SELECT department, n_employees, mean_risk_score, risk_bands, expected_loss_total, high_risk_replacement_cost, top_factors
FROM company_risk_summary
WHERE tenant_id = %(t)s AND model_version = %(v)s
  AND generated_at = (SELECT max(generated_at) FROM company_risk_summary WHERE tenant_id = %(t)s AND model_version = %(v)s)
  AND generated_at > (SELECT max(updated_at) FROM employees WHERE tenant_id = %(t)s)
"""
CACHE_KEYS = ("n_employees", "mean_risk_score", "risk_bands", "expected_loss_total", "high_risk_replacement_cost", "top_factors")


def _cached(top_n: int):
    """{department หรือ None (ทั้งบริษัท): สรุป} จากรอบ batch ล่าสุด หรือ None ถ้าต้องคำนวณสด"""
    if not db.url():
        return None
    with db.connect() as conn:
        rows = conn.execute(CACHE_SQL, {"t": db.DEMO_TENANT, "v": ms.MODEL_VERSION}).fetchall()
    cache = {r[0]: dict(zip(CACHE_KEYS, r[1:])) for r in rows}
    if not cache or any(len(s["top_factors"]) < top_n for s in cache.values()):
        return None
    return {d: s | {"top_factors": s["top_factors"][:top_n]} for d, s in cache.items()}


@router.get("/company-summary", response_model=CompanySummary)
def company_summary(department: Optional[str] = None, top_n: int = Query(5, ge=1, le=50)):
    cache = _cached(top_n)
    if cache and department in cache:
        return CompanySummary(department=department, **cache[department])
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
    cache = _cached(top_n)
    if cache:
        rows = [{"department": d, **s} for d, s in cache.items() if d is not None]
        return DepartmentsResponse(departments=sorted(rows, key=lambda r: r["expected_loss_total"], reverse=True))
    return DepartmentsResponse(departments=cs.by_department(*_inputs(), top_n=top_n))


@router.get("/company-summary/top-employees", response_model=TopEmployeesResponse)
def top_employees(
    n: int = Query(10, ge=1, le=100),
    department: Optional[str] = None,
    user: dict = Depends(auth.current_user),
):
    """พนักงานที่คะแนนความเสี่ยงสูงสุด n คน (ทั้งบริษัทหรือแผนกเดียว) ให้หน้าเว็บกดเลือกได้โดยไม่ต้องรู้รหัส
    บริษัทที่ recalibrate แล้ว (ของผู้ใช้ที่ login) จัดลำดับ/แบ่งระดับด้วยคะแนนที่ปรับเทียบ ให้ตรงกับหน้า SHAP/What-if"""
    record = calibration.load(user["tenant_id"])
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
