from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

import auth
import calibration
import model_store as ms
import company_summary as cs  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)

router = APIRouter(tags=["explain"])

# README 6.5: ต้องเตือนทุกครั้งที่บริษัทยังไม่ได้ recalibrate
UNCALIBRATED_WARNING = (
    "ยังไม่ได้ปรับเทียบกับข้อมูลจริงของบริษัท — ใช้ SHAP (ทิศทางของปัจจัย) ประกอบการตัดสินใจมากกว่าเชื่อตัวเลขตรงๆ"
)


class Contribution(BaseModel):
    feature: str
    value: float
    shap_value: float  # log-odds: บวก = ดันไปทางลาออก, ลบ = ดันไปทางอยู่ต่อ
    # UX-06/07: personal (ข้อมูลส่วนตัว ห้ามใช้ตัดสินใจ), unexplained (HR ตีความไม่ได้) ไม่ควรยกเป็นเหตุผล
    # actionable = บริษัทปรับได้ มี recommendation, background = ประวัติ/ตำแหน่ง ใช้ทำความเข้าใจ
    kind: str
    recommendation: Optional[str] = None


class Commute(BaseModel):
    """DE-18: ระยะทางที่โมเดลใช้ถูกปรับตามวันเข้าออฟฟิศ (model_store.commute_adjusted) ไม่ใช่ระยะทางจริง"""

    distance_km: int  # ระยะทางจริงจากบ้านตามข้อมูลพนักงาน
    office_days: int
    used_km: int  # ค่าที่ส่งเข้าโมเดล (ค่าที่อยู่ใน contributions ของ DistanceFromHome)


class ShapResponse(BaseModel):
    employee_id: int
    risk_score: float
    calibrated_risk_score: Optional[float] = None
    warning: Optional[str] = None
    base_value: float
    contributions: list[Contribution]
    commute: Optional[Commute] = None  # มีเฉพาะคนที่เข้าออฟฟิศไม่ครบ 5 วัน


@router.get("/shap/{employee_id}", response_model=ShapResponse)
def get_shap(employee_id: int, top_n: int = Query(10, ge=1, le=100), user: dict = Depends(auth.current_user)):
    """คะแนนปรับเทียบใช้ของบริษัทผู้ใช้ที่ login (SEC-02)"""
    X = ms.employee_features()
    if employee_id not in X.index:
        raise HTTPException(404, f"ไม่พบพนักงาน employee_id={employee_id}")
    record = calibration.load(user["tenant_id"])

    row = X.loc[[employee_id]]
    exp = ms.explainer()(row)
    score = ms.risk_scores(row)
    order = abs(exp.values[0]).argsort()[::-1][:top_n]
    raw = ms.employee_record(employee_id)
    office_days = raw.get(ms.OFFICE_DAYS, ms.FULL_WEEK)
    commute = None
    if office_days < ms.FULL_WEEK:
        used = int(ms.commute_adjusted(pd.DataFrame([raw]))["DistanceFromHome"].iloc[0])
        commute = Commute(distance_km=raw["DistanceFromHome"], office_days=office_days, used_km=used)
    return ShapResponse(
        employee_id=employee_id,
        risk_score=float(score[0]),
        calibrated_risk_score=float(calibration.apply(record, score)[0]) if record else None,
        warning=None if record else UNCALIBRATED_WARNING,
        base_value=float(exp.base_values[0]),
        contributions=[
            Contribution(
                feature=(name := row.columns[i]),
                value=float(row.iloc[0, i]),
                shap_value=float(exp.values[0, i]),
                kind=cs.factor_kind(name),
                recommendation=cs.RECOMMENDATIONS.get(cs.feature_group(name)),
            )
            for i in order
        ],
        commute=commute,
    )
