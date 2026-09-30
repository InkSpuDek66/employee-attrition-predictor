"""ตั้งค่า MLflow ให้ทั้งทีมใช้ที่เดียวกัน (wk2-3 งานของ Saphondanai)

อ่านค่าจาก .env ที่รากโปรเจกต์ (ดู .env.example และ docs/mlflow_setup.md)
- ตั้ง MLFLOW_TRACKING_URI ไว้ -> log เข้า MLflow กลางของทีม (DagsHub)
- ไม่ได้ตั้ง -> ใช้ sqlite ในเครื่อง (mlflow.db) แบบเดียวกับ notebook ของ Puripat
"""

import os

import mlflow
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOCAL_TRACKING_URI = f"sqlite:///{os.path.join(ROOT, 'mlflow.db')}"

# MLflow อ่าน MLFLOW_TRACKING_USERNAME / MLFLOW_TRACKING_PASSWORD จาก env เองอยู่แล้ว
load_dotenv(os.path.join(ROOT, ".env"))


def tracking_uri() -> str:
    return os.getenv("MLFLOW_TRACKING_URI") or LOCAL_TRACKING_URI


def setup(experiment: str = None) -> str:
    """ชี้ MLflow ไปที่ tracking URI ของทีม (และเลือก experiment ถ้าระบุ) คืน URI ที่ใช้"""
    uri = tracking_uri()
    mlflow.set_tracking_uri(uri)
    if experiment:
        mlflow.set_experiment(experiment)
    return uri
