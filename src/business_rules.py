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

# DE-01: ถือว่า MonthlyIncome ของ IBM dataset เป็น USD หน้าเว็บ/ไฟล์นำเข้าใช้บาท แปลงด้วยค่านี้ที่เดียว
# backend ส่งให้หน้าเว็บตอน login (auth.py) ส่วน THB_PER_USD ใน frontend/src/theme.js เป็นค่าสำรอง มี test เช็กว่าตรงกัน
THB_PER_USD = 35

# UX-04/DE-10: เพดานเงินเดือนต่อเดือน (บาท) กันพิมพ์เกินหลายหลัก แต่ต้องรับฐานเงินเดือน CEO บริษัทใหญ่ได้
# อ้างอิง: Adecco Thailand Salary Guide 2026 มัธยฐาน C-Level 350,000 บาท/เดือน, ประกาศงาน Country Manager
# ของ Robert Walters ไทย 400,000–600,000 บาท/เดือน, CEO ไทยเบฟ (บริษัทใหญ่สุดกลุ่มหนึ่งใน SET) ค่าตอบแทนรวม
# 126.76 ล้านบาท/ปี เป็นเงินเดือน 33% หรือราว 3.5 ล้านบาท/เดือน จึงตั้ง 5 ล้านให้มีที่เผื่อ
MAX_MONTHLY_INCOME_THB = 5_000_000


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


def estimate(
    employees: pd.DataFrame, risk_scores, retention: str = None, include_severance: bool = None, risk_scores_after=None
) -> pd.DataFrame:
    """ประมาณต้นทุน Retain vs Replace ต่อพนักงาน (README 6.3)

    employees ต้องมีคอลัมน์ MonthlyIncome, YearsAtCompany, JobLevel (รูปแบบเดียวกับ CSV ของ IBM)
    risk_scores_after = คะแนนหลังทำมาตรการ (จาก What-if) ถ้าส่งมาจะได้ expected_benefit ด้วย (UX-15)
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
    risk = np.asarray(risk_scores, dtype=float)

    out = pd.DataFrame(
        {
            "risk_score": risk,
            "severance_days": days,
            "severance_pay": severance_pay,
            "hiring_cost": hiring_cost,
            "replacement_cost": replacement_cost,
            "retain_cost": retain_cost,
            "expected_loss": risk * replacement_cost,
        },
        index=employees.index,
    )
    if risk_scores_after is not None:
        # README 6.3 (UX-15): ผลที่คาดว่าจะได้ = มูลค่าความเสี่ยงที่ลดลง - ต้นทุนมาตรการ
        # สูตรเดิม (ต้นทุนหาคนแทน - ต้นทุนมาตรการ) สมมติว่าไม่ทำอะไรจะลาออกแน่ จึงเป็นบวกแม้คนที่เสี่ยงแทบเป็นศูนย์
        out["expected_loss_after"] = np.asarray(risk_scores_after, dtype=float) * replacement_cost
        out["expected_benefit"] = out["expected_loss"] - out["expected_loss_after"] - retain_cost
    return out
