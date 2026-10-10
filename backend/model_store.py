"""โหลดโมเดล + ข้อมูลพนักงาน + SHAP explainer ครั้งเดียว ใช้ร่วมทุก router

ข้อมูลพนักงานอ่านจาก PostgreSQL (ตาราง employees, tenant ibm_demo) เมื่อตั้ง DATABASE_URL ไม่ตั้ง = อ่าน CSV ดิบของ IBM
ponytail: อ่านบริษัทเดียว (ibm_demo) ทั้ง backend แยกตาม tenant เมื่อมี login (SEC-02)
โมเดลตั้งค่าด้วย env MLFLOW_TRACKING_URI / MODEL_URI (อ่านจาก .env ผ่าน src/mlflow_setup.py
ค่าเริ่มต้น = โมเดลตัวทดลองใน mlflow.db ในเครื่อง)
"""

import json
import os
import sys
import threading
import time
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
MODEL_VERSION = MODEL_URI.removeprefix("models:/")  # ชื่อที่บันทึกใน model_runs เช่น 'attrition-xgboost-P/1'


@lru_cache
def model():
    mlflow_setup.setup()
    return mlflow.xgboost.load_model(MODEL_URI)


# วันเข้าออฟฟิศต่อสัปดาห์ (WFH) ไม่ใช่ฟีเจอร์ของโมเดล IBM ไม่มีข้อมูลนี้ = ถือว่าเข้าทุกวัน
OFFICE_DAYS = "OfficeDaysPerWeek"
FULL_WEEK = 5


# DE-15: ข้อมูลพนักงานใน DB เปลี่ยนได้จากทางอื่น (src/db.py, SQL, worker อื่น) cache จึงเช็ก "เวอร์ชันข้อมูล"
# (จำนวนแถว + updated_at ล่าสุด query เร็วมาก) ไม่เกินทุก DATA_CHECK_SECONDS วินาที ถ้าเปลี่ยนก็โหลดใหม่
# ponytail: UPDATE ด้วย SQL ตรงที่ไม่แก้ updated_at จะไม่ถูกจับ ถ้าต้องแก้มือให้ SET updated_at = now() ด้วย
DATA_CHECK_SECONDS = 5
_seen = {"version": None, "checked": float("-inf")}
_seen_lock = threading.Lock()


def _data_version():
    with db.connect() as conn:
        return conn.execute(
            "SELECT count(*), max(updated_at) FROM employees WHERE tenant_id = %s", (db.DEMO_TENANT,)
        ).fetchone()


def _refresh_if_changed():
    if not db.url():
        return
    with _seen_lock:
        now = time.monotonic()
        if now - _seen["checked"] < DATA_CHECK_SECONDS:
            return
        _seen["checked"] = now
        version = _data_version()
        if version != _seen["version"]:
            _load_employees.cache_clear()
            _employee_features.cache_clear()
            _seen["version"] = version


def clear_cache():
    """ล้าง cache ข้อมูลพนักงานทันที (หลังนำเข้าใน process นี้) คำขอถัดไปจะเช็กเวอร์ชันแล้วโหลดใหม่"""
    with _seen_lock:
        _load_employees.cache_clear()
        _employee_features.cache_clear()
        _seen.update(version=None, checked=float("-inf"))


@lru_cache
def _load_employees() -> pd.DataFrame:
    df = db.read_employees() if db.url() else load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))
    return df if OFFICE_DAYS in df else df.assign(**{OFFICE_DAYS: FULL_WEEK})


def raw_employees() -> pd.DataFrame:
    _refresh_if_changed()
    return _load_employees()


def commute_adjusted(raw: pd.DataFrame) -> pd.DataFrame:
    """ระยะทางจากบ้านที่ใช้ให้คะแนน = ระยะทาง × วันเข้าออฟฟิศ / 5 (ไม่ต่ำกว่า 1 ค่าต่ำสุดที่โมเดลเคยเห็น)
    ponytail: โมเดลไม่ได้เรียนผลของ WFH โดยตรง เป็นการประมาณว่าเดินทางน้อยลงตามสัดส่วนวัน
    ถ้าวันหลังเทรนด้วยข้อมูลที่มี WFH จริง ให้ใช้เป็นฟีเจอร์ของโมเดลแทน"""
    if OFFICE_DAYS not in raw:
        return raw
    days = pd.to_numeric(raw[OFFICE_DAYS], errors="coerce").fillna(FULL_WEEK)
    distance = (pd.to_numeric(raw["DistanceFromHome"]) * days / FULL_WEEK).round().clip(lower=1).astype(int)
    return raw.assign(DistanceFromHome=distance)


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
    # Attrition ไม่ใช้ทำนาย (ตัดทิ้งก่อนเข้าโมเดล) แต่ clean_data ต้องมีครบ พนักงานที่ import มายังไม่มีผลจริง จึงใส่ค่าแทน
    both = pd.concat([commute_adjusted(raw), raw_employees()], ignore_index=True).assign(**{TARGET_COLUMN: "No"})
    X = add_features(clean_data(both), only=SELECTED_FEATURES).drop(columns=TARGET_COLUMN)
    return X.iloc[: len(raw)][model().feature_names_in_]


def employee_features() -> pd.DataFrame:
    """ฟีเจอร์ของพนักงานทุกคน index = EmployeeNumber"""
    _refresh_if_changed()
    return _employee_features()


@lru_cache
def _employee_features() -> pd.DataFrame:
    raw = raw_employees()
    return to_features(raw).set_index(raw["EmployeeNumber"])  # to_features ปรับระยะทางตามวันเข้าออฟฟิศให้แล้ว


@lru_cache
def explainer():
    return shap.TreeExplainer(model())


def risk_scores(X: pd.DataFrame):
    return model().predict_proba(X)[:, 1]
