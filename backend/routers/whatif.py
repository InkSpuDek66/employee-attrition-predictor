"""POST /whatif (README 3, 7) -- งานของ Saphondanai

จำลองการเปลี่ยนค่าฟีเจอร์ของพนักงาน 1 คน แล้วคืนคะแนนก่อน/หลัง ไม่บันทึกอะไรลง database
"""

from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ValidationError

import auth
import calibration
import company_summary as cs
import db
import model_store as ms
from routers.predict import resolve_employee, score
from routers.shap import UNCALIBRATED_WARNING
from schemas import EmployeeInput, EmployeeRef, Score

router = APIRouter(tags=["predict"])

NOTE = "ผลจำลองจากโมเดล ไม่ได้บันทึกลงระบบ และไม่รับประกันว่าทำจริงแล้วความเสี่ยงจะลดตามนี้"


class WhatIfRequest(EmployeeRef):
    # ชื่อคอลัมน์เดียวกับ EmployeeInput เช่น {"OverTime": "No", "MonthlyIncome": 6000}
    changes: dict[str, Any] = {}


class Driver(BaseModel):
    feature: str  # ชื่อกลุ่มฟีเจอร์ (one-hot รวมเป็นก้อนเดียว เช่น JobRole)
    change: float  # SHAP หลัง - ก่อน บวก = ทำให้เสี่ยงขึ้น ใช้เรียง/บอกทิศทาง ไม่ใช่คะแนน


MAX_DRIVERS = 3


class WhatIfResponse(BaseModel):
    employee_id: Optional[int] = None
    before: Score
    after: Score
    delta: float  # คะแนนหลัง - ก่อน (ใช้ calibrated ถ้ามี) ติดลบ = ความเสี่ยงลดลง
    changes_applied: dict[str, Any]
    employee: dict[str, Any]  # ข้อมูลหลังเปลี่ยน ใช้แสดงค่าปัจจุบันในฟอร์ม
    name: Optional[str] = None  # ชื่อ-นามสกุลที่บริษัทกรอกไว้ (แสดงผลเท่านั้น)
    # ปัจจัยที่ทำให้คะแนนเปลี่ยนมากสุด (critique 2026-10-16: ขึ้นเงินเดือนแล้วความเสี่ยงขึ้น ไม่มีอะไรบอกว่าทำไม)
    drivers: list[Driver] = []
    warning: Optional[str] = None
    note: str = NOTE


def _shown(s: Score) -> float:
    return s.risk_score if s.calibrated_risk_score is None else s.calibrated_risk_score


@router.post("/whatif", response_model=WhatIfResponse)
def whatif(req: WhatIfRequest, user: dict = Depends(auth.current_user)):
    unknown = sorted(set(req.changes) - set(EmployeeInput.model_fields))
    if unknown:
        raise HTTPException(422, f"ไม่รู้จักฟีเจอร์: {unknown}")
    record = calibration.load(user["tenant_id"])  # บริษัทจาก token (DE-11)
    base = resolve_employee(req, user["tenant_id"])
    try:
        changed = EmployeeInput(**{**base, **req.changes}).model_dump()
    except ValidationError as e:
        # ข้อความอ่านได้ เช่น "YearsSinceLastPromotion: ต้องไม่เกิน 6 ปี เมื่อเทียบกับจำนวนปีที่อยู่บริษัทนี้" (UX-04)
        detail = "; ".join(f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors(include_url=False))
        raise HTTPException(422, f"ค่าที่เปลี่ยนไม่ถูกต้อง: {detail}")

    before, after = score([base, changed], record)
    return WhatIfResponse(
        name=_name(req.employee_id, user["tenant_id"]),
        drivers=_drivers(base, changed),
        employee_id=req.employee_id,
        before=before,
        after=after,
        delta=_shown(after) - _shown(before),
        changes_applied={k: v for k, v in changed.items() if base[k] != v},
        employee=changed,
        warning=None if record else UNCALIBRATED_WARNING,
    )


def _drivers(base: dict, changed: dict) -> list[Driver]:
    """SHAP หลัง - ก่อน รวม one-hot ตามกลุ่ม เรียงตามขนาด (ไม่ได้ปรับอะไร = ว่าง)
    ต้นไม้มี interaction: ปัจจัยที่ไม่ได้ปรับเองก็เปลี่ยนได้ (เช่น ขึ้นเงินเดือนแล้ว "เงินเดือนขึ้นล่าสุด" มีผลต่างไป) บอกตามจริง"""
    if base == changed:
        return []
    X = ms.to_features(pd.DataFrame([base, changed]))
    sv = ms.explainer()(X).values
    diff = pd.Series(sv[1] - sv[0], index=X.columns).groupby(cs.feature_group).sum()
    top = diff[diff.abs() > 1e-4].abs().sort_values(ascending=False).index[:MAX_DRIVERS]
    return [Driver(feature=f, change=float(diff[f])) for f in top]


def _name(employee_id, tenant: str):
    if employee_id is None:
        return None
    try:
        row = ms.display_employees(tenant).set_index("EmployeeNumber").loc[employee_id]
    except KeyError:
        return None
    return row[db.FULL_NAME] if isinstance(row[db.FULL_NAME], str) else None
