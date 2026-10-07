"""โหลดโมเดล + ข้อมูลพนักงาน + SHAP explainer ครั้งเดียว ใช้ร่วมทุก router

ข้อมูลพนักงานอ่านจาก PostgreSQL (ตาราง employees, tenant ibm_demo) เมื่อตั้ง DATABASE_URL ไม่ตั้ง = อ่าน CSV ดิบของ IBM
ponytail: อ่านบริษัทเดียว (ibm_demo) ทั้ง backend แยกตาม tenant เมื่อมี login (SEC-02)
โมเดลตั้งค่าด้วย env MLFLOW_TRACKING_URI / MODEL_URI (อ่านจาก .env ผ่าน src/mlflow_setup.py
ค่าเริ่มต้น = โมเดลตัวทดลองใน mlflow.db ในเครื่อง)
"""

import json
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
import mlflow_setup  # noqa: E402  (โหลด .env)
import db  # noqa: E402

MODEL_URI = os.getenv("MODEL_URI", "models:/attrition-xgboost-P/1")


@lru_cache
def model():
    mlflow_setup.setup()
    return mlflow.xgboost.load_model(MODEL_URI)


@lru_cache
def raw_employees() -> pd.DataFrame:
    if db.url():
        return db.read_employees()
    return load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))


def input_columns() -> set:
    """คอลัมน์ที่ข้อมูลพนักงานต้องมี (ไม่รวม noise และ Attrition)"""
    return set(raw_employees().columns) - set(NOISE_COLUMNS) - {TARGET_COLUMN}


def employee_record(employee_id: int):
    """ข้อมูลดิบของพนักงาน 1 คน (เฉพาะ input_columns) เป็น dict หรือ None ถ้าไม่พบ"""
    raw = raw_employees()
    match = raw.loc[raw["EmployeeNumber"] == employee_id, sorted(input_columns())]
    # ผ่าน JSON เพื่อแปลงชนิด numpy เป็น int/str ของ Python
    return None if match.empty else json.loads(match.head(1).to_json(orient="records"))[0]


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
