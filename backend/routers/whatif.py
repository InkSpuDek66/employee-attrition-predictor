"""POST /whatif (README 3, 7) -- งานของ Saphondanai

จำลองการเปลี่ยนค่าฟีเจอร์ของพนักงาน 1 คน แล้วคืนคะแนนก่อน/หลัง ไม่บันทึกอะไรลง database
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ValidationError

import auth
import calibration
from routers.predict import resolve_employee, score
from routers.shap import UNCALIBRATED_WARNING
from schemas import EmployeeInput, EmployeeRef, Score

router = APIRouter(tags=["predict"])

NOTE = "ผลจำลองจากโมเดล ไม่ได้บันทึกลงระบบ และไม่รับประกันว่าทำจริงแล้วความเสี่ยงจะลดตามนี้"


class WhatIfRequest(EmployeeRef):
    # ชื่อคอลัมน์เดียวกับ EmployeeInput เช่น {"OverTime": "No", "MonthlyIncome": 6000}
    changes: dict[str, Any] = {}


class WhatIfResponse(BaseModel):
    employee_id: Optional[int] = None
    before: Score
    after: Score
    delta: float  # คะแนนหลัง - ก่อน (ใช้ calibrated ถ้ามี) ติดลบ = ความเสี่ยงลดลง
    changes_applied: dict[str, Any]
    employee: dict[str, Any]  # ข้อมูลหลังเปลี่ยน ใช้แสดงค่าปัจจุบันในฟอร์ม
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
    base = resolve_employee(req)
    try:
        changed = EmployeeInput(**{**base, **req.changes}).model_dump()
    except ValidationError as e:
        # ข้อความอ่านได้ เช่น "YearsSinceLastPromotion: ต้องไม่เกิน 6 ปี เมื่อเทียบกับจำนวนปีที่อยู่บริษัทนี้" (UX-04)
        detail = "; ".join(f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors(include_url=False))
        raise HTTPException(422, f"ค่าที่เปลี่ยนไม่ถูกต้อง: {detail}")

    before, after = score([base, changed], record)
    return WhatIfResponse(
        employee_id=req.employee_id,
        before=before,
        after=after,
        delta=_shown(after) - _shown(before),
        changes_applied={k: v for k, v in changed.items() if base[k] != v},
        employee=changed,
        warning=None if record else UNCALIBRATED_WARNING,
    )
