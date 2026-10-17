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

# DE-01: เงินเดือน (MonthlyIncome) ของพนักงานเป็นบาทจริง ต้นทุนทุกตัวในไฟล์นี้จึงเป็นบาท
# แปลงเป็นหน่วยของโมเดลตอนให้คะแนนเท่านั้น (src/income_scale.py เทียบอันดับเงินเดือนในบริษัท)

# UX-04/DE-10: เพดานเงินเดือนต่อเดือน (บาท) กันพิมพ์เกินหลายหลัก แต่ต้องรับฐานเงินเดือน CEO บริษัทใหญ่ได้
# อ้างอิง: Adecco Thailand Salary Guide 2026 มัธยฐาน C-Level 350,000 บาท/เดือน, ประกาศงาน Country Manager
# ของ Robert Walters ไทย 400,000–600,000 บาท/เดือน, CEO ไทยเบฟ (บริษัทใหญ่สุดกลุ่มหนึ่งใน SET) ค่าตอบแทนรวม
# 126.76 ล้านบาท/ปี เป็นเงินเดือน 33% หรือราว 3.5 ล้านบาท/เดือน จึงตั้ง 5 ล้านให้มีที่เผื่อ
MAX_MONTHLY_INCOME_THB = 5_000_000


def shown_score(score: float) -> float:
    """คะแนนที่หน้าเว็บแสดง (x100 ปัดเป็นจำนวนเต็ม แบบ Math.round) ระดับและเงินคิดจากค่านี้ ตัวเลขบนจอจะได้ตรงกัน"""
    return int(float(score) * 100 + 0.5) / 100


def risk_band(score: float) -> str:
    """คืน 'High' / 'Medium' / 'Low' ตาม README 6.1 คิดจากคะแนนที่แสดง (39.75 แสดง 40 = ปานกลาง critique รอบ 8)"""
    score = shown_score(score)
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


# ปรับใน What-if แล้วนับเป็นมาตรการ "อบรม + แผนเลื่อนตำแหน่ง" (นับครั้งเดียวต่อแผน)
GROWTH_FIELDS = ("JobLevel", "YearsSinceLastPromotion", "TrainingTimesLastYear")


def plan_cost(employee: dict, changes: dict) -> tuple[list[dict], list[str]]:
    """ต้นทุน 1 ปีของสิ่งที่ HR ปรับใน What-if ทั้งหมด (UX-15) คิดจากค่าที่เปลี่ยนจริง ไม่ใช่มาตรการเดียวที่เลือกไว้
    employee = ค่าเดิม, changes = ค่าใหม่ (เงินเดือนเป็นบาท ต้นทุนที่คืนจึงเป็นบาท)
    คืน ([{key, label, cost}], ฟีเจอร์ที่เปลี่ยนแต่ยังไม่มีต้นทุนใน config) อย่างหลังต้องบอกผู้ใช้ ผลที่คาดว่าจะได้จะสูงกว่าจริง"""
    opts = retention_options()
    monthly = float(employee["MonthlyIncome"])
    items, rest = [], set(changes)

    def months(key):
        return {"key": key, "label": opts[key]["label"], "cost": monthly * opts[key]["months_of_salary"]}

    if "MonthlyIncome" in changes:  # ขึ้นเงินเดือนจริงเท่าไร = จ่ายเพิ่ม 12 เดือน (10% = 1.2 เดือน ตรงกับ config)
        rest -= {"MonthlyIncome", "PercentSalaryHike"}
        raised = float(changes["MonthlyIncome"]) - monthly
        if raised > 0:
            items.append({"key": "salary_raise", "label": f"ขึ้นเงินเดือน {raised / monthly:.0%} (1 ปี)", "cost": raised * 12})
    elif "PercentSalaryHike" in changes:
        rest.discard("PercentSalaryHike")
        extra = float(changes["PercentSalaryHike"]) - float(employee["PercentSalaryHike"])
        if extra > 0:
            items.append({"key": "salary_raise", "label": f"ขึ้นเงินเดือนเพิ่ม {extra:g}% (1 ปี)", "cost": monthly * extra / 100 * 12})
    if changes.get("OverTime") == "No" and employee.get("OverTime") == "Yes":
        rest.discard("OverTime")
        items.append(months("reduce_overtime"))
    grew = (
        changes.get("JobLevel", employee["JobLevel"]) > employee["JobLevel"]
        or changes.get("YearsSinceLastPromotion", employee["YearsSinceLastPromotion"]) < employee["YearsSinceLastPromotion"]
        or changes.get("TrainingTimesLastYear", employee["TrainingTimesLastYear"]) > employee["TrainingTimesLastYear"]
    )
    if grew:
        rest -= set(GROWTH_FIELDS)
        items.append(months("training_and_promotion_track"))
    return items, sorted(rest)


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
    employees: pd.DataFrame, risk_scores, retention: str = None, include_severance: bool = None, risk_scores_after=None,
    retain_cost=None,
) -> pd.DataFrame:
    """ประมาณต้นทุน Retain vs Replace ต่อพนักงาน (README 6.3)

    employees ต้องมีคอลัมน์ MonthlyIncome, YearsAtCompany, JobLevel (รูปแบบเดียวกับ CSV ของ IBM)
    risk_scores_after = คะแนนหลังทำมาตรการ (จาก What-if) ถ้าส่งมาจะได้ expected_benefit ด้วย (UX-15)
    retain_cost = ต้นทุนมาตรการที่คิดไว้แล้ว (plan_cost) ไม่ส่ง = ใช้มาตรการ retention ตัวเดียว
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
    if retain_cost is None:
        retain_cost = monthly * retention_options()[retention]["months_of_salary"]
    else:
        retain_cost = pd.Series(np.asarray(retain_cost, dtype=float), index=employees.index)
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
