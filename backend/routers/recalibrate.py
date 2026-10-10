"""ปรับเทียบคะแนนกับข้อมูลลาออกจริงของบริษัท (README 6.5) เฉพาะผู้ดูแลระบบ บริษัทมาจาก token (SEC-02)

POST   /recalibrate            records เป็น JSON (คอลัมน์แบบ IBM) สำหรับเรียกจากระบบอื่น
GET    /recalibrate/template   ไฟล์ Excel ตัวอย่าง (demo=true = ข้อมูล IBM 300 คนไว้ทดลอง)
POST   /recalibrate/upload     ไฟล์ Excel/CSV หัวคอลัมน์ไทย ตรวจด้วยกฎเดียวกับหน้านำเข้า แล้วปรับเทียบ
GET    /recalibrate/history    ประวัติการปรับเทียบของบริษัท (ล่าสุดก่อน)
DELETE /recalibrate            ยกเลิกการปรับเทียบ กลับไปใช้คะแนนของโมเดลกลาง
"""

import logging
from typing import Literal, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sklearn.metrics import brier_score_loss

import auth
import batch_score
import calibration
import model_store as ms
from routers import employee_upload as eu

router = APIRouter(tags=["localization"])
log = logging.getLogger(__name__)

MIN_ROWS = 50  # ponytail: ค่าขั้นต่ำแบบประมาณ ต่ำกว่านี้ผลปรับเทียบไม่น่าเชื่อถือ ปรับเมื่อทีมตกลง
MAX_ROWS = 10_000  # SEC-03 (~8 MB ไม่เกินเพดาน body ใน main.py)
DEMO_ROWS = 300
EXAMPLE_SCORES = (0.2, 0.4, 0.6, 0.8)  # ให้หน้าเว็บโชว์ว่าคะแนนเดิมเท่านี้ หลังปรับเป็นเท่าไหร่

Method = Literal["platt", "isotonic"]


class RecalibrateRequest(BaseModel):
    tenant_id: Optional[str] = Field(None, pattern=calibration.TENANT_ID_PATTERN)  # ไม่ต้องส่ง ใช้บริษัทของผู้ login (ส่งบริษัทอื่น = 403)
    method: Method = "isotonic"
    # แต่ละแถว = พนักงาน 1 คน คอลัมน์เดียวกับ CSV ของ IBM รวม Attrition = "Yes"/"No"
    records: list[dict] = Field(min_length=MIN_ROWS, max_length=MAX_ROWS)


class Example(BaseModel):
    before: float
    after: float


class RecalibrateResponse(BaseModel):
    tenant_id: str
    method: str
    n_samples: int
    positive_rate: float
    brier_before: float
    brier_after: float  # วัดบนข้อมูลชุดเดียวกับที่ใช้ fit จึงดูดีเกินจริงเล็กน้อย
    calibrated_at: str
    examples: list[Example] = []


class UploadResult(BaseModel):
    check: eu.ValidateResponse
    result: Optional[RecalibrateResponse] = None  # None = ไฟล์ยังไม่ผ่าน ดู check / message
    message: Optional[str] = None


def _fit(raw: pd.DataFrame, method: str, tenant_id: str) -> RecalibrateResponse:
    """raw = พนักงานคอลัมน์แบบ IBM + Attrition (Yes/No) หน่วยเงินของโมเดลแล้ว"""
    labels = (raw["Attrition"] == "Yes").astype(int).to_numpy()
    if len(raw) < MIN_ROWS:
        raise HTTPException(422, f"ต้องมีพนักงานอย่างน้อย {MIN_ROWS} คน (มี {len(raw)} คน) ผลปรับเทียบจากข้อมูลน้อยกว่านี้ไม่น่าเชื่อถือ")
    if labels.min() == labels.max():
        raise HTTPException(422, "ต้องมีทั้งพนักงานที่ลาออกและที่ยังอยู่")
    try:
        scores = ms.risk_scores(ms.to_features(raw[sorted(ms.input_columns())]))
    except (KeyError, ValueError, TypeError) as e:
        # SEC-08: ไม่ส่งรายละเอียดให้ผู้ใช้ และ log แค่ชนิด error (ข้อความ exception อาจมีค่าข้อมูลพนักงาน)
        log.warning("recalibrate: แปลงข้อมูลไม่ได้ (%s)", type(e).__name__)
        raise HTTPException(422, "ข้อมูลไม่ตรงรูปแบบ ตรวจว่าแต่ละคอลัมน์เป็นตัวเลข/ตัวเลือกเดียวกับไฟล์ตัวอย่าง")

    params = calibration.fit(scores, labels, method)
    record = {"method": method, "params": params}
    calibrated = calibration.apply(record, scores)
    metrics = {
        "brier_before": float(brier_score_loss(labels, scores)),
        "brier_after": float(brier_score_loss(labels, calibrated)),
    }
    saved = calibration.save(tenant_id, method, params, len(raw), float(np.mean(labels)), metrics)
    after = calibration.apply(record, np.array(EXAMPLE_SCORES))
    return RecalibrateResponse(
        tenant_id=saved["tenant_id"],
        method=saved["method"],
        n_samples=saved["n_samples"],
        positive_rate=saved["positive_rate"],
        calibrated_at=saved["calibrated_at"],
        examples=[Example(before=b, after=float(a)) for b, a in zip(EXAMPLE_SCORES, after)],
        **metrics,
    )


@router.post("/recalibrate", response_model=RecalibrateResponse)
def recalibrate(req: RecalibrateRequest, background: BackgroundTasks, user: dict = Depends(auth.require_admin)):
    raw = pd.DataFrame(req.records)
    missing = sorted((ms.input_columns() | {"Attrition"}) - set(raw.columns))
    if missing:
        raise HTTPException(422, f"ขาดคอลัมน์: {missing}")
    if not raw["Attrition"].isin(["Yes", "No"]).all():
        raise HTTPException(422, 'Attrition ต้องเป็น "Yes" หรือ "No" เท่านั้น')
    result = _fit(raw, req.method, user["tenant_id"])
    background.add_task(batch_score.refresh_in_background)  # คะแนนปรับเทียบในตารางผลทำนายเปลี่ยน
    return result


@router.get("/recalibrate/template")
def recalibrate_template(demo: bool = False, _: dict = Depends(auth.require_admin)):
    """demo=false: หัวคอลัมน์ + 2 แถวตัวอย่าง, demo=true: พนักงาน IBM 300 คนพร้อมผลจริง ไว้ทดลองปรับเทียบ"""
    rows = eu._example_rows(DEMO_ROWS if demo else 2, label=True)
    name = "recalibrate_demo_ibm.xlsx" if demo else "recalibrate_template.xlsx"
    return eu.template_response(rows, eu.COLUMNS + [eu.LABEL], name)


@router.post("/recalibrate/upload", response_model=UploadResult)
async def recalibrate_upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    method: Method = Form("isotonic"),
    user: dict = Depends(auth.require_admin),
):
    valid, check = await eu._check(file, label=True)
    if check.missing_columns or check.n_invalid or not valid:
        return UploadResult(check=check, message="ไฟล์ยังมีคอลัมน์ที่ขาดหรือแถวที่ผิด แก้แล้วอัปโหลดใหม่")
    result = _fit(eu.to_model_units(pd.DataFrame(valid)), method, user["tenant_id"])
    background.add_task(batch_score.refresh_in_background)
    return UploadResult(check=check, result=result)


@router.get("/recalibrate/history")
def recalibrate_history(user: dict = Depends(auth.current_user)):
    return {"tenant_id": user["tenant_id"], "history": calibration.history(user["tenant_id"])}


@router.delete("/recalibrate")
def recalibrate_reset(background: BackgroundTasks, user: dict = Depends(auth.require_admin)):
    removed = calibration.reset(user["tenant_id"])
    background.add_task(batch_score.refresh_in_background)
    return {"tenant_id": user["tenant_id"], "removed": removed}
