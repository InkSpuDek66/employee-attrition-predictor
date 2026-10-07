"""POST /recalibrate ปรับเทียบคะแนนกับข้อมูลลาออกจริงของบริษัท (README 6.5) เฉพาะผู้ดูแลระบบ บริษัทมาจาก token (SEC-02)"""

import logging
from typing import Literal, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sklearn.metrics import brier_score_loss

import auth
import calibration
import model_store as ms

router = APIRouter(tags=["localization"])
log = logging.getLogger(__name__)

MIN_ROWS = 50  # ponytail: ค่าขั้นต่ำแบบประมาณ ต่ำกว่านี้ผลปรับเทียบไม่น่าเชื่อถือ ปรับเมื่อทีมตกลง
MAX_ROWS = 10_000  # SEC-03 (~8 MB ไม่เกินเพดาน body ใน main.py)


class RecalibrateRequest(BaseModel):
    tenant_id: Optional[str] = Field(None, pattern=calibration.TENANT_ID_PATTERN)  # ไม่ต้องส่ง ใช้บริษัทของผู้ login (ส่งบริษัทอื่น = 403)
    method: Literal["platt", "isotonic"] = "isotonic"
    # แต่ละแถว = พนักงาน 1 คน คอลัมน์เดียวกับ CSV ของ IBM รวม Attrition = "Yes"/"No"
    records: list[dict] = Field(min_length=MIN_ROWS, max_length=MAX_ROWS)


class RecalibrateResponse(BaseModel):
    tenant_id: str
    method: str
    n_samples: int
    positive_rate: float
    brier_before: float
    brier_after: float  # วัดบนข้อมูลชุดเดียวกับที่ใช้ fit จึงดูดีเกินจริงเล็กน้อย
    calibrated_at: str


@router.post("/recalibrate", response_model=RecalibrateResponse)
def recalibrate(req: RecalibrateRequest, user: dict = Depends(auth.require_admin)):
    raw = pd.DataFrame(req.records)
    missing = sorted((ms.input_columns() | {"Attrition"}) - set(raw.columns))
    if missing:
        raise HTTPException(422, f"ขาดคอลัมน์: {missing}")
    if not raw["Attrition"].isin(["Yes", "No"]).all():
        raise HTTPException(422, 'Attrition ต้องเป็น "Yes" หรือ "No" เท่านั้น')
    labels = (raw["Attrition"] == "Yes").astype(int).to_numpy()
    if labels.min() == labels.max():
        raise HTTPException(422, "ต้องมีทั้งพนักงานที่ลาออกและไม่ลาออก")

    try:
        scores = ms.risk_scores(ms.to_features(raw[sorted(ms.input_columns())]))
    except (KeyError, ValueError, TypeError):
        # SEC-08: รายละเอียด exception ลง log ฝั่ง server ไม่ส่งให้ผู้ใช้
        log.exception("recalibrate: แปลงข้อมูลไม่ได้")
        raise HTTPException(422, "ข้อมูลไม่ตรงรูปแบบ ตรวจว่าแต่ละคอลัมน์เป็นตัวเลข/ตัวเลือกเดียวกับไฟล์ตัวอย่าง")

    params = calibration.fit(scores, labels, req.method)
    calibrated = calibration.apply({"method": req.method, "params": params}, scores)
    metrics = {
        "brier_before": float(brier_score_loss(labels, scores)),
        "brier_after": float(brier_score_loss(labels, calibrated)),
    }
    saved = calibration.save(user["tenant_id"], req.method, params, len(raw), float(np.mean(labels)), metrics)
    return RecalibrateResponse(
        tenant_id=saved["tenant_id"],
        method=saved["method"],
        n_samples=saved["n_samples"],
        positive_rate=saved["positive_rate"],
        calibrated_at=saved["calibrated_at"],
        **metrics,
    )
