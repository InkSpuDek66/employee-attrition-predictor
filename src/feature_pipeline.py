"""ไปป์ไลน์ feature engineering (wk2-3) -- ร่างรอยืนยันกับ Saphondanai

ชุดฟีเจอร์เป็นข้อเสนอของ Puripat: คัดเหลือ SELECTED_FEATURES จากการวัด CV AUC ใน
notebooks/04_tuning_P.ipynb แล้ว แต่ยังต้องตกลงชุดสุดท้ายร่วมกับ Saphondanai

รับผลลัพธ์จาก `clean_pipeline.clean_data` แล้วคืน DataFrame ที่มีฟีเจอร์เพิ่ม
(ไม่ใช้คอลัมน์ Attrition ในสูตรใด ๆ จึงไม่เพิ่มความเสี่ยง leakage ตาม README 6.2)
"""

import numpy as np
import pandas as pd

SATISFACTION_COLUMNS = [
    "EnvironmentSatisfaction",
    "JobSatisfaction",
    "RelationshipSatisfaction",
    "JobInvolvement",
]


NEW_FEATURES = ["TenureRatio", "IncomePerLevel", "PromotionGap", "ManagerStability",
                "JobHopping", "AvgSatisfaction", "OverTimeXDistance"]


def _ratio(num: pd.Series, den: pd.Series) -> pd.Series:
    """หารแบบกัน 0: ตัวหารเป็น 0 -> ผลเป็น 0 (ไม่ใช่ inf/NaN)"""
    return (num / den.replace(0, np.nan)).fillna(0)


# ฟีเจอร์ที่ผ่านการคัดเลือกใน notebooks/04_tuning_P.ipynb (เพิ่ม CV AUC บน train ทั้ง 3 ตัว)
# ที่เหลืออีก 4 ตัวทำให้ CV AUC ลดลง จึงไม่เลือก -- ยังต้องยืนยันร่วมกับ Saphondanai
SELECTED_FEATURES = ["OverTimeXDistance", "AvgSatisfaction", "TenureRatio"]


def add_features(df: pd.DataFrame, only: list = None) -> pd.DataFrame:
    """สร้างฟีเจอร์ใหม่ทั้ง 7 ตัว; ส่ง `only=SELECTED_FEATURES` เพื่อเก็บเฉพาะที่ผ่านการคัดเลือก"""
    df = df.copy()
    df["TenureRatio"] = _ratio(df["YearsAtCompany"], df["TotalWorkingYears"])
    df["IncomePerLevel"] = _ratio(df["MonthlyIncome"], df["JobLevel"])
    df["PromotionGap"] = _ratio(df["YearsSinceLastPromotion"], df["YearsAtCompany"])
    df["ManagerStability"] = _ratio(df["YearsWithCurrManager"], df["YearsAtCompany"])
    df["JobHopping"] = _ratio(df["NumCompaniesWorked"], df["TotalWorkingYears"])
    df["AvgSatisfaction"] = df[SATISFACTION_COLUMNS].mean(axis=1)
    df["OverTimeXDistance"] = df["OverTime"] * df["DistanceFromHome"]
    if only is not None:
        df = df.drop(columns=[c for c in NEW_FEATURES if c not in only])
    return df


if __name__ == "__main__":
    import os
    import sys

    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from clean_pipeline import RAW_FILENAME, clean_data, load_raw_data

    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    out = add_features(clean_data(load_raw_data(os.path.join(root, "data", "raw", RAW_FILENAME))))
    assert not out.isna().any().any() and np.isfinite(out.select_dtypes("number")).all().all()
    print("shape:", out.shape)
    print(out.corr()["Attrition"].filter(regex="Ratio|Per|Gap|Stability|Hopping|Avg|XD").round(3))
