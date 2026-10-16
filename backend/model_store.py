"""โหลดโมเดล + ข้อมูลพนักงาน + SHAP explainer ครั้งเดียว ใช้ร่วมทุก router

ข้อมูลพนักงานแยกตามบริษัท (tenant ของผู้ใช้ที่ login) อ่านจาก PostgreSQL ตาราง employees เมื่อตั้ง DATABASE_URL
ไม่ตั้ง = บริษัทเดโม (ibm_demo) อ่าน CSV ดิบของ IBM ส่วนบริษัทอื่นว่าง
ข้อมูลอ้างอิงตอนแปลงฟีเจอร์ (one-hot ให้ครบหมวด) ใช้ CSV ของ IBM เสมอ ไม่ขึ้นกับบริษัท
เงินเดือน (MonthlyIncome) ของพนักงานเป็นบาทจริงทุกที่ แปลงเป็นหน่วยของโมเดลตอนเข้า to_features เท่านั้น (income_scale.py)
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
import income_scale  # noqa: E402

# v2 = ไม่ใช้เพศ/สถานภาพสมรส (src/train.py EXCLUDED) ส่วน v1 ใช้ทั้งสองอย่าง ค่าปรับเทียบผูกกับเวอร์ชัน เปลี่ยนแล้วต้องปรับเทียบใหม่
MODEL_URI = os.getenv("MODEL_URI", "models:/attrition-xgboost-P/2")
# ชื่อที่บันทึกใน model_runs ผูกกับค่าปรับเทียบ "+income-rank" = แปลงเงินเดือนแบบเทียบอันดับ (DE-01) คะแนนต่างจากแบบหาร 35
# ผลปรับเทียบเดิมจึงขึ้นว่า "ทำไว้กับโมเดลรุ่นก่อน" ให้ปรับเทียบใหม่
MODEL_VERSION = MODEL_URI.removeprefix("models:/") + "+income-rank"


@lru_cache
def model():
    mlflow_setup.setup()
    return mlflow.xgboost.load_model(MODEL_URI)


INCOME = "MonthlyIncome"

# วันเข้าออฟฟิศต่อสัปดาห์ (WFH) ไม่ใช่ฟีเจอร์ของโมเดล IBM ไม่มีข้อมูลนี้ = ถือว่าเข้าทุกวัน
OFFICE_DAYS = "OfficeDaysPerWeek"
FULL_WEEK = 5


# DE-15: ข้อมูลพนักงานใน DB เปลี่ยนได้จากทางอื่น (src/db.py, SQL, worker อื่น) cache จึงเช็ก "เวอร์ชันข้อมูล" ต่อบริษัท
# (จำนวนแถว + updated_at ล่าสุด query เร็วมาก) ไม่เกินทุก DATA_CHECK_SECONDS วินาที ถ้าเปลี่ยนก็โหลดใหม่
# ponytail: UPDATE ด้วย SQL ตรงที่ไม่แก้ updated_at จะไม่ถูกจับ ถ้าต้องแก้มือให้ SET updated_at = now() ด้วย
# ponytail: ข้อมูลบริษัทไหนเปลี่ยน ล้าง cache ทุกบริษัท (ง่าย ถูกเสมอ) แยกล้างรายบริษัทเมื่อมีหลายบริษัทจริงจนช้า
DATA_CHECK_SECONDS = 5
TENANT_CACHE = 32  # จำนวนบริษัทที่เก็บ cache ไว้พร้อมกัน
_seen: dict = {}  # tenant -> {"version", "checked"}
_seen_lock = threading.Lock()


def _data_version(tenant: str):
    with db.connect() as conn:
        return conn.execute("SELECT count(*), max(updated_at) FROM employees WHERE tenant_id = %s", (tenant,)).fetchone()


def _clear():
    _load_employees.cache_clear()
    _load_labels.cache_clear()
    _employee_features.cache_clear()


def _refresh_if_changed(tenant: str):
    if not db.url():
        return
    with _seen_lock:
        seen = _seen.setdefault(tenant, {"version": None, "checked": float("-inf")})
        now = time.monotonic()
        if now - seen["checked"] < DATA_CHECK_SECONDS:
            return
        seen["checked"] = now
        version = _data_version(tenant)
        if version != seen["version"]:
            if seen["version"] is not None:
                _clear()
            seen["version"] = version


def clear_cache():
    """ล้าง cache ข้อมูลพนักงานทันที (หลังนำเข้าใน process นี้) คำขอถัดไปจะเช็กเวอร์ชันแล้วโหลดใหม่"""
    with _seen_lock:
        _clear()
        _seen.clear()


@lru_cache
def reference_employees() -> pd.DataFrame:
    """พนักงาน IBM จาก CSV (ไม่ขึ้นกับบริษัท) ใช้เป็นข้อมูลอ้างอิงตอนแปลงฟีเจอร์ แถวตัวอย่างใน template และไฟล์ทดลอง"""
    df = load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))
    return df.assign(**{OFFICE_DAYS: FULL_WEEK})


@lru_cache
def reference_income():
    """เงินเดือนของ IBM (หน่วยของโมเดล) ที่ใช้เทียบอันดับ"""
    return reference_employees()[INCOME].to_numpy(dtype=float)


def ibm_in_thb(df: pd.DataFrame) -> pd.DataFrame:
    """ข้อมูล IBM (หน่วยของโมเดล) -> เงินเดือนบาท สำหรับบริษัทเดโม/แถวตัวอย่าง (ไม่มีเงินเดือนไทยจริง ใช้ตัวคูณคงที่)"""
    return df.assign(**{INCOME: (df[INCOME] * income_scale.THB_PER_UNIT).astype(int)})


@lru_cache(maxsize=TENANT_CACHE)
def _load_employees(tenant: str) -> pd.DataFrame:
    if db.url():
        df = db.read_employees(tenant)
    else:
        df = ibm_in_thb(reference_employees()) if tenant == db.DEMO_TENANT else reference_employees().iloc[:0]
    return df if OFFICE_DAYS in df else df.assign(**{OFFICE_DAYS: FULL_WEEK})


def raw_employees(tenant: str = db.DEMO_TENANT) -> pd.DataFrame:
    """พนักงานของบริษัท (ชื่อคอลัมน์แบบ IBM) บริษัทที่ยังไม่มีพนักงาน = ตารางว่าง"""
    _refresh_if_changed(tenant)
    return _load_employees(tenant)


@lru_cache(maxsize=TENANT_CACHE)
def _load_labels(tenant: str) -> pd.DataFrame:
    return db.employee_labels(tenant)


def display_employees(tenant: str = db.DEMO_TENANT) -> pd.DataFrame:
    """พนักงานของบริษัทสำหรับแสดงผล/จัดกลุ่ม: Department / JobRole = ชื่อจริงของบริษัทถ้ากรอกไว้ ไม่งั้นชื่อกลุ่มของโมเดล
    + คอลัมน์ FullName ห้ามส่งตารางนี้เข้าโมเดล (ใช้ raw_employees / employee_features)"""
    raw = raw_employees(tenant)
    labels = _load_labels(tenant).reindex(raw["EmployeeNumber"])
    return raw.assign(
        Department=labels[db.DEPARTMENT_NAME].fillna(raw["Department"].set_axis(labels.index)).to_numpy(),
        JobRole=labels[db.JOB_TITLE].fillna(raw["JobRole"].set_axis(labels.index)).to_numpy(),
        **{db.FULL_NAME: labels[db.FULL_NAME].to_numpy()},
    )


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
    return set(reference_employees().columns) - set(NOISE_COLUMNS) - {TARGET_COLUMN}


def employee_record(employee_id: int, tenant: str = db.DEMO_TENANT):
    """ข้อมูลดิบของพนักงาน 1 คนในบริษัท (เฉพาะ input_columns) เป็น dict หรือ None ถ้าไม่พบ"""
    raw = raw_employees(tenant)
    match = raw.loc[raw["EmployeeNumber"] == employee_id, sorted(input_columns())]
    # ผ่าน JSON เพื่อแปลงชนิด numpy เป็น int/str ของ Python
    return None if match.empty else json.loads(match.head(1).to_json(orient="records"))[0]


def company_income(tenant: str):
    """เงินเดือนบาทของพนักงานปัจจุบันทั้งบริษัท ใช้เทียบอันดับตอนให้คะแนนพนักงานของบริษัทนั้น (to_features)"""
    return raw_employees(tenant)[INCOME]


def to_features(raw: pd.DataFrame, company_thb) -> pd.DataFrame:
    """แปลงข้อมูลดิบ (รูปแบบเดียวกับ CSV ของ IBM เงินเดือนเป็นบาท) เป็นเมทริกซ์ที่โมเดลรับได้ คงลำดับแถวเดิม
    company_thb = เงินเดือนบาทของคนทั้งกลุ่มที่ใช้เทียบอันดับ (พนักงานของบริษัท หรือคนในไฟล์ปรับเทียบ) บังคับส่ง
    ให้ทุกคนที่เรียกเลือกเองว่าเทียบกับใคร เทียบผิดกลุ่ม = คะแนนผิดแบบเงียบๆ

    ต่อข้อมูลอ้างอิงเข้าไปก่อน clean เพื่อให้ one-hot ได้คอลัมน์ครบเหมือนตอนเทรน แม้ข้อมูลใหม่จะมีหมวดไม่ครบ
    """
    # Attrition ไม่ใช้ทำนาย (ตัดทิ้งก่อนเข้าโมเดล) แต่ clean_data ต้องมีครบ พนักงานที่ import มายังไม่มีผลจริง จึงใส่ค่าแทน
    scaled = raw.assign(**{INCOME: income_scale.to_model(raw[INCOME], company_thb, reference_income()).astype(int)})
    both = pd.concat([commute_adjusted(scaled), reference_employees()], ignore_index=True).assign(**{TARGET_COLUMN: "No"})
    X = add_features(clean_data(both), only=SELECTED_FEATURES).drop(columns=TARGET_COLUMN)
    return X.iloc[: len(raw)][model().feature_names_in_]


def employee_features(tenant: str = db.DEMO_TENANT) -> pd.DataFrame:
    """ฟีเจอร์ของพนักงานทุกคนในบริษัท index = EmployeeNumber"""
    _refresh_if_changed(tenant)
    return _employee_features(tenant)


@lru_cache(maxsize=TENANT_CACHE)
def _employee_features(tenant: str) -> pd.DataFrame:
    raw = _load_employees(tenant)
    # to_features ปรับระยะทางตามวันเข้าออฟฟิศ + เทียบอันดับเงินเดือนในบริษัทให้แล้ว
    return to_features(raw, raw[INCOME]).set_index(raw["EmployeeNumber"])


@lru_cache
def explainer():
    return shap.TreeExplainer(model())


def risk_scores(X: pd.DataFrame):
    return model().predict_proba(X)[:, 1]
