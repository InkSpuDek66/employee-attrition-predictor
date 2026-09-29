"""โหลดโมเดล + ข้อมูลพนักงาน + SHAP explainer ครั้งเดียว ใช้ร่วมทุก router

ponytail: ข้อมูลพนักงานอ่านจาก CSV ดิบไปก่อน สลับเป็น dev database กลาง (Supabase/Neon) เมื่อทีมตั้งเสร็จ
โมเดลตั้งค่าด้วย env MLFLOW_TRACKING_URI / MODEL_URI (ค่าเริ่มต้น = โมเดลตัวทดลองใน mlflow.db ในเครื่อง)
"""

import os
import sys
from functools import lru_cache

import mlflow.xgboost
import pandas as pd
import shap

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(ROOT, "src"))
from clean_pipeline import NOISE_COLUMNS, RAW_FILENAME, TARGET_COLUMN, clean_data, load_raw_data  # noqa: E402
from feature_pipeline import SELECTED_FEATURES, add_features  # noqa: E402

MODEL_URI = os.getenv("MODEL_URI", "models:/attrition-xgboost-P/1")
TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", f"sqlite:///{os.path.join(ROOT, 'mlflow.db')}")


@lru_cache
def model():
    mlflow.set_tracking_uri(TRACKING_URI)
    return mlflow.xgboost.load_model(MODEL_URI)


@lru_cache
def raw_employees() -> pd.DataFrame:
    return load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))


def input_columns() -> set:
    """คอลัมน์ที่ข้อมูลพนักงานต้องมี (ไม่รวม noise และ Attrition)"""
    return set(raw_employees().columns) - set(NOISE_COLUMNS) - {TARGET_COLUMN}


def to_features(raw: pd.DataFrame) -> pd.DataFrame:
    """แปลงข้อมูลดิบ (รูปแบบเดียวกับ CSV ของ IBM) เป็นเมทริกซ์ที่โมเดลรับได้ คงลำดับแถวเดิม

    ต่อข้อมูลอ้างอิงเข้าไปก่อน clean เพื่อให้ one-hot ได้คอลัมน์ครบเหมือนตอนเทรน แม้ข้อมูลใหม่จะมีหมวดไม่ครบ
    """
    both = pd.concat([raw.assign(**{TARGET_COLUMN: "No"}), raw_employees()], ignore_index=True)
    X = add_features(clean_data(both), only=SELECTED_FEATURES).drop(columns=TARGET_COLUMN)
    return X.iloc[: len(raw)][model().feature_names_in_]


@lru_cache
def employee_features() -> pd.DataFrame:
    """ฟีเจอร์ของพนักงานทุกคน index = EmployeeNumber"""
    raw = raw_employees()
    return to_features(raw).set_index(raw["EmployeeNumber"])


@lru_cache
def explainer():
    return shap.TreeExplainer(model())


def risk_scores(X: pd.DataFrame):
    return model().predict_proba(X)[:, 1]
