"""ปรับเทียบคะแนนความเสี่ยงต่อบริษัท (tenant) ตาม README 6.5 ด้วย Platt scaling หรือ isotonic regression

ponytail: เก็บผลเป็นไฟล์ JSON ต่อ tenant ใน backend/calibrations/ แทนตาราง tenant_calibrations
ย้ายไป DB เมื่อทีมตั้งเสร็จ (key ใน JSON ตั้งใจให้ตรงกับคอลัมน์ในตาราง เพื่อให้ /calibration-status อ่านได้)
"""

import json
import os
import re
from datetime import datetime, timezone

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

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
    os.makedirs(STORE, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=1)
    return record


def load(tenant_id: str):
    path = _path(tenant_id)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)
