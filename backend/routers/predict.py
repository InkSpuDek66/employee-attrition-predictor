"""POST /predict (README 7) -- งานของ Saphondanai

ponytail: ยังไม่บันทึก attrition_predictions ลง DB (รอ dev database กลาง) คำนวณสดทุกครั้ง
"""

from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

import auth
import calibration
import model_store as ms
from routers.shap import UNCALIBRATED_WARNING
from schemas import EmployeeRef, Score

import business_rules  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)

router = APIRouter(tags=["predict"])


class PredictResponse(Score):
    employee_id: Optional[int] = None
    warning: Optional[str] = None


def resolve_employee(ref: EmployeeRef) -> dict:
    """คืนข้อมูลดิบของพนักงานจาก employee_id หรือ employee (ต้องระบุอย่างใดอย่างหนึ่ง)"""
    if (ref.employee_id is None) == (ref.employee is None):
        raise HTTPException(422, "ระบุ employee_id หรือ employee อย่างใดอย่างหนึ่ง")
    if ref.employee is not None:
        return ref.employee.model_dump()
    record = ms.employee_record(ref.employee_id)
    if record is None:
        raise HTTPException(404, f"ไม่พบพนักงาน employee_id={ref.employee_id}")
    return record


def score(records: list, calibration_record) -> list:
    """คะแนนความเสี่ยงของพนักงานหลายคนในครั้งเดียว (ข้อมูลดิบรูปแบบ CSV ของ IBM)"""
    raw = ms.risk_scores(ms.to_features(pd.DataFrame(records)))
    calibrated = calibration.apply(calibration_record, raw) if calibration_record else [None] * len(raw)
    out = []
    for r, c in zip(raw, calibrated):
        shown = float(r if c is None else c)
        band = business_rules.risk_band(shown)
        out.append(
            Score(
                risk_score=float(r),
                calibrated_risk_score=None if c is None else float(c),
                risk_band=band,
                risk_band_th=business_rules.RISK_BANDS[band],
            )
        )
    return out


@router.post("/predict", response_model=PredictResponse)
def predict(req: EmployeeRef, user: dict = Depends(auth.current_user)):
    record = calibration.load(user["tenant_id"])  # บริษัทจาก token เหมือน /shap (DE-11) ไม่ใช่ tenant_id ใน request
    (result,) = score([resolve_employee(req)], record)
    return PredictResponse(
        **result.model_dump(),
        employee_id=req.employee_id,
        warning=None if record else UNCALIBRATED_WARNING,
    )
