"""SHAP รายบุคคล (wk4-5) -- ร่างของ Puripat ใช้กับโมเดลตัวทดลองใน MLflow ในเครื่อง

ต่อกับ endpoint `/shap` ในภายหลังได้: `explain` + `top_factors` คือแกนหลัก
โมเดลที่จะใช้จริงต้องรอ promote เป็นตัวสุดท้ายร่วมกับ Saphondanai (เปลี่ยนแค่ MODEL_URI / tracking URI)

หมายเหตุ: SHAP ของ XGBoost อยู่ในหน่วย log-odds ไม่ใช่ % ค่าบวก = ดันไปทางลาออก ค่าลบ = ดันไปทางอยู่ต่อ
"""

import os
import sys

import mlflow.xgboost
import pandas as pd
import shap
from sklearn.model_selection import train_test_split

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from clean_pipeline import RAW_FILENAME, clean_data, load_raw_data
from feature_pipeline import SELECTED_FEATURES, add_features

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_URI = "models:/attrition-xgboost-P/1"


def load_model_and_test_data():
    """โหลดโมเดล + test split ชุดเดียวกับ notebook 04 (seed 42) คืน (model, X_test, y_test)"""
    mlflow.set_tracking_uri(f"sqlite:///{os.path.join(ROOT, 'mlflow.db')}")
    model = mlflow.xgboost.load_model(MODEL_URI)
    df = add_features(clean_data(load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))), only=SELECTED_FEATURES)
    X, y = df.drop(columns="Attrition"), df["Attrition"]
    _, Xte, _, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    return model, Xte[model.feature_names_in_], yte


def explain(model, X: pd.DataFrame) -> shap.Explanation:
    return shap.TreeExplainer(model)(X)


def top_factors(exp: shap.Explanation, i: int, n: int = 5) -> pd.DataFrame:
    """ปัจจัยที่ส่งผลต่อคนที่ i มากที่สุด n ตัว (เรียงตามขนาดผลกระทบ)"""
    df = pd.DataFrame({"feature": exp.feature_names, "value": exp.data[i], "shap": exp.values[i]})
    df["direction"] = df["shap"].map(lambda v: "เพิ่มความเสี่ยง" if v > 0 else "ลดความเสี่ยง")
    return df.reindex(df["shap"].abs().sort_values(ascending=False).index).head(n).reset_index(drop=True)


def mean_abs_shap(exp: shap.Explanation) -> pd.Series:
    """ค่าเฉลี่ย |SHAP| ต่อฟีเจอร์ -- ใช้ต่อกับ Company-wide Summary (ของ Saphondanai/Nanthamon)"""
    return pd.Series(abs(exp.values).mean(axis=0), index=exp.feature_names).sort_values(ascending=False)
