"""กฎธุรกิจตาม README หัวข้อ 6 (wk4-5 งานของ Saphondanai): 6.1 Risk Banding + 6.3 Financial Impact

ตัวเลขทั้งหมด (ตารางค่าชดเชย, ตัวคูณต้นทุนหาคนแทน, ต้นทุนมาตรการ) อยู่ใน config/financial_impact.json
แก้ตามกฎหมายหรือบริษัทได้โดยไม่ต้องแก้โค้ดหรือ retrain

ข้อควรระวัง: risk_score จากโมเดลที่เทรนด้วย scale_pos_weight สูงกว่าความน่าจะเป็นจริง
expected_loss (= risk_score x ต้นทุนหาคนแทน) จึงสูงเกินจริงจนกว่าบริษัทจะ recalibrate (README 6.5)
ใช้เทียบลำดับความสำคัญระหว่างพนักงาน/แผนกได้ แต่ไม่ควรอ่านเป็นยอดเงินที่จะเสียจริง
"""

import json
import os
from functools import lru_cache

import numpy as np
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONFIG_PATH = os.path.join(ROOT, "config", "financial_impact.json")

# README 6.1 (ค่าตั้งต้น ปรับได้เมื่อเห็นการกระจายของ risk_score หลัง recalibrate)
HIGH_RISK = 0.7
MEDIUM_RISK = 0.4
RISK_BANDS = {"High": "สูง", "Medium": "ปานกลาง", "Low": "ต่ำ"}


def risk_band(score: float) -> str:
    """คืน 'High' / 'Medium' / 'Low' ตาม README 6.1"""
    if score >= HIGH_RISK:
        return "High"
    if score >= MEDIUM_RISK:
        return "Medium"
    return "Low"


@lru_cache
def config() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def retention_options() -> dict:
    return config()["retention_options"]["options"]


def severance_days(years_at_company) -> np.ndarray:
    """จำนวนวันค่าชดเชยตามอายุงาน (มาตรา 118)

    YearsAtCompany ใน dataset เป็นจำนวนเต็ม ค่า 0 แยกไม่ได้ว่าครบ 120 วันหรือยัง จึงนับเป็น 0 วัน (ประมาณต่ำไว้ก่อน)
    """
    years = np.asarray(years_at_company, dtype=float)
    days = np.zeros_like(years)
    for tier in sorted(config()["severance"]["tiers"], key=lambda t: t["min_years"]):
        days = np.where(years >= tier["min_years"], tier["days"], days)
    return days


def estimate(employees: pd.DataFrame, risk_scores, retention: str = None, include_severance: bool = None) -> pd.DataFrame:
    """ประมาณต้นทุน Retain vs Replace ต่อพนักงาน (README 6.3)

    employees ต้องมีคอลัมน์ MonthlyIncome, YearsAtCompany, JobLevel (รูปแบบเดียวกับ CSV ของ IBM)
    คืน DataFrame index เดียวกับ employees
    """
    cfg = config()
    retention = retention or cfg["retention_options"]["default"]
    if retention not in retention_options():
        raise ValueError(f"ไม่รู้จักมาตรการ '{retention}' (มี: {sorted(retention_options())})")
    if include_severance is None:
        include_severance = cfg["severance"]["include_by_default"]

    monthly = employees["MonthlyIncome"].astype(float)
    multiplier = employees["JobLevel"].astype(int).astype(str).map(cfg["hiring_cost"]["annual_salary_multiplier_by_job_level"])
    days = severance_days(employees["YearsAtCompany"])

    severance_pay = monthly / cfg["days_per_month"] * days
    hiring_cost = monthly * 12 * multiplier
    replacement_cost = hiring_cost + (severance_pay if include_severance else 0)
    retain_cost = monthly * retention_options()[retention]["months_of_salary"]

    return pd.DataFrame(
        {
            "risk_score": np.asarray(risk_scores, dtype=float),
            "severance_days": days,
            "severance_pay": severance_pay,
            "hiring_cost": hiring_cost,
            "replacement_cost": replacement_cost,
            "retain_cost": retain_cost,
            "net_benefit_if_retained": replacement_cost - retain_cost,  # README 6.3: ROI
            "expected_loss": np.asarray(risk_scores, dtype=float) * replacement_cost,
        },
        index=employees.index,
    )
