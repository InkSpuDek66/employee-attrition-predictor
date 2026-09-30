"""GET /financial-impact/{employee_id} (README 6.3, 7) -- งานของ Saphondanai

ต้นทุน Retain vs Replace ของพนักงาน 1 คน ตัวเลขทั้งหมดมาจาก config/financial_impact.json
"""

from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import calibration
from routers.predict import load_calibration, resolve_employee, score
from routers.shap import UNCALIBRATED_WARNING
from schemas import EmployeeRef, Score

import business_rules  # noqa: E402  (อยู่ใน src/)

router = APIRouter(tags=["business"])


class FinancialImpact(BaseModel):
    employee_id: int
    score: Score
    monthly_income: float
    years_at_company: int
    job_level: int
    severance_days: int
    severance_pay: float  # ข้อมูลประกอบ รวมใน replacement_cost เฉพาะเมื่อ include_severance=true
    include_severance: bool
    hiring_cost: float
    replacement_cost: float
    retention: str
    retention_label: str
    retain_cost: float
    net_benefit_if_retained: float
    expected_loss: float
    retention_options: dict[str, str]
    currency_note: str
    warning: Optional[str] = None


@router.get("/financial-impact/{employee_id}", response_model=FinancialImpact)
def financial_impact(
    employee_id: int,
    retention: Optional[str] = None,
    include_severance: Optional[bool] = None,
    tenant_id: Optional[str] = Query(None, pattern=calibration.TENANT_ID_PATTERN),
):
    record = load_calibration(tenant_id)
    employee = resolve_employee(EmployeeRef(employee_id=employee_id))
    (s,) = score([employee], record)
    shown = s.risk_score if s.calibrated_risk_score is None else s.calibrated_risk_score
    try:
        row = business_rules.estimate(pd.DataFrame([employee]), [shown], retention, include_severance).iloc[0]
    except ValueError as e:
        raise HTTPException(422, str(e))

    cfg = business_rules.config()
    retention = retention or cfg["retention_options"]["default"]
    options = business_rules.retention_options()
    return FinancialImpact(
        employee_id=employee_id,
        score=s,
        monthly_income=employee["MonthlyIncome"],
        years_at_company=employee["YearsAtCompany"],
        job_level=employee["JobLevel"],
        severance_days=int(row["severance_days"]),
        severance_pay=row["severance_pay"],
        include_severance=cfg["severance"]["include_by_default"] if include_severance is None else include_severance,
        hiring_cost=row["hiring_cost"],
        replacement_cost=row["replacement_cost"],
        retention=retention,
        retention_label=options[retention]["label"],
        retain_cost=row["retain_cost"],
        net_benefit_if_retained=row["net_benefit_if_retained"],
        expected_loss=row["expected_loss"],
        retention_options={k: v["label"] for k, v in options.items()},
        currency_note=cfg["currency_note"],
        warning=None if record else UNCALIBRATED_WARNING,
    )
