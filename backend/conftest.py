import os
import sys

import pytest
from dotenv import dotenv_values

sys.path.insert(0, os.path.dirname(__file__))  # ให้ pytest import main/model_store ได้เมื่อรันจากรากโปรเจกต์

# test ทั่วไปใช้ CSV + ไฟล์ calibration ชั่วคราว ไม่เขียนลง DB จริง (ค่าว่าง = load_dotenv ไม่ทับ)
# test ที่ต้องใช้ DB อ่าน URL จริงจาก REAL_DATABASE_URL แล้วข้ามถ้าไม่มี (ดู test_db.py)
REAL_DATABASE_URL = os.environ.get("DATABASE_URL") or dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env")).get("DATABASE_URL")
os.environ["DATABASE_URL"] = ""

import auth  # noqa: E402
from main import app  # noqa: E402

# ทุก test เรียก API ในนาม admin ของบริษัท "co" (test ของ login/สิทธิ์อยู่ใน test_auth.py ซึ่งปิด override นี้เอง)
TEST_USER = {"username": "pytest", "name": "pytest", "role": "admin", "tenant_id": "co"}
app.dependency_overrides[auth.current_user] = lambda: TEST_USER


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """test หลายไฟล์เรียก endpoint เดียวกันในนามผู้ใช้คนเดียว ล้างตัวนับทุก test (test ของ limit อยู่ใน test_auth.py)"""
    for limit in auth.LIMITS.values():
        limit.reset()
