"""ปรับเทียบคะแนนความเสี่ยงต่อบริษัท (tenant) ตาม README 6.5 ด้วย Platt scaling หรือ isotonic regression

ตั้ง DATABASE_URL = เก็บในตาราง tenant_calibrations (เก็บทุกครั้ง ใช้ตัวล่าสุด)
ไม่ตั้ง = ไฟล์ JSON ต่อ tenant ใน backend/calibrations/ (key ตรงกับคอลัมน์ในตาราง ให้ /calibration-status อ่านได้ทั้งสองแบบ)
"""

import json
import os
import re
from datetime import datetime, timezone

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

import model_store  # noqa: F401  (เพิ่ม src/ เข้า sys.path)
import db  # noqa: E402

STORE = os.path.join(os.path.dirname(__file__), "calibrations")
TENANT_ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"  # ใช้เป็นชื่อไฟล์ จึงต้องกัน path traversal


def _path(tenant_id: str) -> str:
    if not re.match(TENANT_ID_PATTERN, tenant_id):
        raise ValueError("tenant_id ใช้ได้เฉพาะ A-Z a-z 0-9 _ - ยาวไม่เกิน 64 ตัว")
    return os.path.join(STORE, f"{tenant_id}.json")


def fit(scores: np.ndarray, labels: np.ndarray, method: str) -> dict:
    if method == "platt":
        lr = LogisticRegression().fit(scores.reshape(-1, 1), labels)
        return {"coef": float(lr.coef_[0, 0]), "intercept": float(lr.intercept_[0])}
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(scores, labels)
    return {"x": iso.X_thresholds_.tolist(), "y": iso.y_thresholds_.tolist()}


def apply(record: dict, scores: np.ndarray) -> np.ndarray:
    p = record["params"]
    if record["method"] == "platt":
        return 1 / (1 + np.exp(-(p["coef"] * scores + p["intercept"])))
    return np.interp(scores, p["x"], p["y"])


def save(tenant_id: str, method: str, params: dict, n_samples: int, positive_rate: float, metrics: dict) -> dict:
    record = {
        "tenant_id": tenant_id,
        "method": method,
        "params": params,
        "n_samples": n_samples,
        "positive_rate": positive_rate,
        "metrics": metrics,
        "calibrated_at": datetime.now(timezone.utc).isoformat(),
    }
    path = _path(tenant_id)
    if db.url():
        with db.connect() as conn:
            conn.execute(
                "INSERT INTO tenant_calibrations (tenant_id, calibrated_at, method, params, n_samples, positive_rate, metrics, model_version) "
                "VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s::jsonb, (SELECT model_version FROM model_runs WHERE is_active))",
                (tenant_id, record["calibrated_at"], method, json.dumps(params), n_samples, positive_rate, json.dumps(metrics)),
            )
        return record
    os.makedirs(STORE, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)
    return record


def history(tenant_id: str, limit: int = 10) -> list[dict]:
    """ผลปรับเทียบล่าสุดก่อน (ไม่มี DB = มีแค่ครั้งล่าสุดจากไฟล์ JSON)"""
    if not db.url():
        record = load(tenant_id)
        return [record] if record else []
    _path(tenant_id)
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT method, n_samples, positive_rate, metrics, calibrated_at FROM tenant_calibrations "
            "WHERE tenant_id = %s ORDER BY calibrated_at DESC LIMIT %s",
            (tenant_id, limit),
        ).fetchall()
    return [
        {"tenant_id": tenant_id, "method": m, "n_samples": n, "positive_rate": p, "metrics": met, "calibrated_at": at.isoformat()}
        for m, n, p, met, at in rows
    ]


def reset(tenant_id: str) -> int:
    """ยกเลิกการปรับเทียบทั้งหมดของบริษัท กลับไปใช้คะแนนของโมเดลกลาง คืนจำนวนที่ลบ"""
    path = _path(tenant_id)
    if db.url():
        with db.connect() as conn:
            return conn.execute("DELETE FROM tenant_calibrations WHERE tenant_id = %s", (tenant_id,)).rowcount
    if os.path.exists(path):
        os.remove(path)
        return 1
    return 0


def load(tenant_id: str):
    path = _path(tenant_id)
    if db.url():
        with db.connect() as conn:
            row = conn.execute(
                "SELECT tenant_id, method, params, n_samples, positive_rate, metrics, calibrated_at FROM tenant_calibrations "
                "WHERE tenant_id = %s ORDER BY calibrated_at DESC LIMIT 1",
                (tenant_id,),
            ).fetchone()
        if not row:
            return None
        keys = ("tenant_id", "method", "params", "n_samples", "positive_rate", "metrics", "calibrated_at")
        return dict(zip(keys, row)) | {"calibrated_at": row[-1].isoformat()}
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)
