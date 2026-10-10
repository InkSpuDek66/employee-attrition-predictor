"""Company-wide Aggregate Summary ตาม README 6.6 (wk4-5 งานของ Saphondanai + Nanthamon)

รับค่า SHAP รายบุคคล (จาก shap_explain / TreeExplainer) แล้วสรุปเป็นภาพรวมบริษัทหรือรายแผนก:
- จัดอันดับปัจจัยด้วย mean(|SHAP|) โดยรวมคอลัมน์ one-hot กลับเป็นฟีเจอร์เดิม (เช่น JobRole_* -> JobRole)
  ใช้ได้เพราะ SHAP บวกกันได้ ผลรวม |SHAP| ของกลุ่มจึงแทนผลกระทบของฟีเจอร์นั้นทั้งก้อน
- จับคู่กับคำแนะนำแบบ rule-based (ถ้อยคำเชิงทิศทาง เพราะ SHAP ไม่ใช่เหตุและผล)
- รวมกับ financial impact (business_rules.estimate) เป็นมูลค่าความเสี่ยงรวม
"""

import numpy as np
import pandas as pd

import business_rules
from clean_pipeline import NOMINAL_COLUMNS

NOTE = "SHAP บอกความสัมพันธ์กับโมเดล ไม่ใช่เหตุและผลที่พิสูจน์แล้ว คำแนะนำเป็นทิศทางที่น่าจะช่วย ไม่ใช่การรับประกันผล"

# ปัจจัยที่บริษัทปรับได้ -> คำแนะนำเชิงนโยบาย (README 6.6)
RECOMMENDATIONS = {
    "OverTime": "ทบทวนนโยบาย OT / ภาระงาน น่าจะช่วยลดความเสี่ยง",
    "OverTimeXDistance": "ทบทวนนโยบาย OT โดยเฉพาะพนักงานที่บ้านไกล น่าจะช่วยลดความเสี่ยง",
    "MonthlyIncome": "ทบทวนโครงสร้างเงินเดือนเทียบตลาด โดยเฉพาะกลุ่มรายได้ต่ำ",
    "PercentSalaryHike": "ทบทวนเกณฑ์การขึ้นเงินเดือนประจำปีให้สะท้อนผลงาน",
    "StockOptionLevel": "พิจารณาสวัสดิการระยะยาว (เช่น สมทบกองทุนสำรองเลี้ยงชีพเพิ่ม) แทนสิทธิ์ซื้อหุ้นซึ่งพบน้อยในบริษัทไทย",
    "WorkLifeBalance": "พิจารณาสวัสดิการ/ความยืดหยุ่นเวลาทำงาน",
    "AvgSatisfaction": "สำรวจความพึงพอใจเชิงลึกรายทีม",
    "JobSatisfaction": "สำรวจความพึงพอใจในงานรายทีม และทบทวนการมอบหมายงาน",
    "EnvironmentSatisfaction": "ทบทวนสภาพแวดล้อมการทำงาน",
    "RelationshipSatisfaction": "ส่งเสริมความสัมพันธ์ในทีม เช่น กิจกรรมทีม ระบบพี่เลี้ยง",
    "JobInvolvement": "เปิดโอกาสให้มีส่วนร่วมตัดสินใจ/มอบหมายงานที่มีความหมาย",
    "YearsWithCurrManager": "ดูแลช่วงเปลี่ยนหัวหน้าเป็นพิเศษ",
    "YearsSinceLastPromotion": "ทบทวนเส้นทางเลื่อนตำแหน่งของคนที่ไม่ได้เลื่อนนาน",
    "YearsInCurrentRole": "พิจารณาหมุนเวียนงานหรือเพิ่มความรับผิดชอบใหม่",
    "JobLevel": "วางเส้นทางความก้าวหน้าที่ชัดเจนให้พนักงานระดับเริ่มต้น",
    "TrainingTimesLastYear": "เพิ่มโอกาสอบรม/พัฒนาทักษะ",
    "BusinessTravel": "ลดความถี่การเดินทางไปทำงานนอกสถานที่ หรือชดเชยให้เหมาะสม",
    "DistanceFromHome": "พิจารณาทำงานจากที่บ้านบางวัน หรือช่วยค่าเดินทาง",
    "YearsAtCompany": "ดูแลพนักงานใหม่ช่วงปีแรก (onboarding, พี่เลี้ยง)",
    "TenureRatio": "ดูแลพนักงานใหม่ช่วงปีแรก (onboarding, พี่เลี้ยง)",
    "JobRole": "ทบทวนภาระงาน/ค่าตอบแทนของตำแหน่งที่เสี่ยงสูงเป็นพิเศษ",
    "Department": "เจาะดูรายแผนกด้วย ?department= เพื่อหาสาเหตุเฉพาะแผนก",
}

# ฟีเจอร์ที่ไม่ใช่นโยบายที่บริษัทปรับได้ (ข้อมูลส่วนตัว/ประวัติ) หรือเป็น protected attribute
NOT_ACTIONABLE = (
    "ไม่ใช่ปัจจัยที่บริษัทปรับได้โดยตรง ใช้ประกอบการเข้าใจกลุ่มเสี่ยงเท่านั้น"
    " ห้ามใช้เป็นเกณฑ์คัดเลือกหรือเลือกปฏิบัติ (ดู Fairness check README 6.4)"
)


def feature_group(column: str) -> str:
    """ชื่อฟีเจอร์เดิมของคอลัมน์หลัง encode เช่น 'JobRole_Manager' -> 'JobRole'"""
    for nominal in NOMINAL_COLUMNS:
        if column.startswith(nominal + "_"):
            return nominal
    return column


def factor_ranking(shap_values: np.ndarray, feature_names) -> pd.Series:
    """mean(|SHAP|) ต่อฟีเจอร์เดิม เรียงจากมากไปน้อย (คอลัมน์ one-hot รวมเป็นก้อนเดียว)"""
    per_employee = pd.DataFrame(np.abs(shap_values), columns=list(feature_names))
    grouped = per_employee.T.groupby(feature_group).sum().T
    return grouped.mean().sort_values(ascending=False)


def summarize(shap_values: np.ndarray, feature_names, risk_scores, employees: pd.DataFrame, top_n: int = 5) -> dict:
    """สรุปพนักงานกลุ่มหนึ่ง (ทั้งบริษัทหรือหนึ่งแผนก)

    shap_values: (n_employees, n_features) ลำดับแถวเดียวกับ employees และ risk_scores
    employees: ข้อมูลดิบรูปแบบ CSV ของ IBM (ใช้คำนวณ financial impact)
    """
    risk = np.asarray(risk_scores, dtype=float)
    ranking = factor_ranking(shap_values, feature_names)
    total = ranking.sum()
    bands = pd.Series([business_rules.risk_band(s) for s in risk]).value_counts()
    money = business_rules.estimate(employees, risk)
    return {
        "n_employees": len(risk),
        "mean_risk_score": float(risk.mean()),
        "risk_bands": {band: int(bands.get(band, 0)) for band in business_rules.RISK_BANDS},
        "expected_loss_total": float(money["expected_loss"].sum()),
        "high_risk_replacement_cost": float(money.loc[risk >= business_rules.HIGH_RISK, "replacement_cost"].sum()),
        "top_factors": [
            {
                "feature": feature,
                "mean_abs_shap": float(value),
                "share": float(value / total) if total else 0.0,
                "actionable": feature in RECOMMENDATIONS,
                "recommendation": RECOMMENDATIONS.get(feature, NOT_ACTIONABLE),
            }
            for feature, value in ranking.head(top_n).items()
        ],
    }


def by_department(shap_values: np.ndarray, feature_names, risk_scores, employees: pd.DataFrame, top_n: int = 3) -> list:
    """สรุปแยกทุกแผนก เรียงตามมูลค่าความเสี่ยงรวม (expected_loss_total) จากมากไปน้อย"""
    risk = np.asarray(risk_scores, dtype=float)
    departments = employees["Department"].to_numpy()
    rows = []
    for department in sorted(set(departments)):
        mask = departments == department
        rows.append(
            {"department": department, **summarize(shap_values[mask], feature_names, risk[mask], employees[mask], top_n)}
        )
    return sorted(rows, key=lambda r: r["expected_loss_total"], reverse=True)
