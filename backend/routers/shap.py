from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

import auth
import calibration
import model_store as ms

router = APIRouter(tags=["explain"])

# README 6.5: ต้องเตือนทุกครั้งที่บริษัทยังไม่ได้ recalibrate
UNCALIBRATED_WARNING = (
    "ยังไม่ได้ปรับเทียบกับข้อมูลจริงของบริษัท — ใช้ SHAP (ทิศทางของปัจจัย) ประกอบการตัดสินใจมากกว่าเชื่อตัวเลขตรงๆ"
)


class Contribution(BaseModel):
    feature: str
    value: float
    shap_value: float  # log-odds: บวก = ดันไปทางลาออก, ลบ = ดันไปทางอยู่ต่อ


class ShapResponse(BaseModel):
    employee_id: int
    risk_score: float
    calibrated_risk_score: Optional[float] = None
    warning: Optional[str] = None
    base_value: float
    contributions: list[Contribution]


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
    return ShapResponse(
        employee_id=employee_id,
        risk_score=float(score[0]),
        calibrated_risk_score=float(calibration.apply(record, score)[0]) if record else None,
        warning=None if record else UNCALIBRATED_WARNING,
        base_value=float(exp.base_values[0]),
        contributions=[
            Contribution(feature=row.columns[i], value=float(row.iloc[0, i]), shap_value=float(exp.values[0, i]))
            for i in order
        ],
    )
