"""login, สิทธิ์ admin, กันข้ามบริษัท (SEC-01/02) และเพดานขนาด/ความถี่ (SEC-03) ปิด override ของ conftest ให้ใช้ auth จริง"""

import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import auth
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def real_auth():
    saved = app.dependency_overrides.pop(auth.current_user)
    auth.login_limit.reset()
    yield
    app.dependency_overrides[auth.current_user] = saved


def login(username):
    r = client.post("/auth/login", json={"username": username, "password": auth.DEMO_USERS[username]["password"]})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_requires_login_and_rejects_bad_tokens():
    assert client.get("/shap/1").status_code == 401
    assert client.get("/shap/1", headers={"Authorization": "Bearer abc.def"}).status_code == 401
    expired = auth.issue_token("hr_demo", now=time.time() - auth.TOKEN_TTL - 1)
    assert client.get("/shap/1", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    assert client.post("/auth/login", json={"username": "hr_demo", "password": "wrong"}).status_code == 401
    assert client.post("/auth/login", json={"username": "nobody", "password": "x"}).status_code == 401
    hr = login("hr_demo")
    assert client.get("/auth/me", headers=hr).json()["tenant_id"] == "ibm_demo"
    assert client.get("/shap/1", headers=hr).status_code == 200


def test_hr_cannot_recalibrate_and_nobody_crosses_tenants():
    hr, admin = login("hr_demo"), login("admin_demo")
    assert client.post("/recalibrate", headers=hr, json={"records": []}).status_code == 403
    assert client.post("/whatif", headers=admin, json={"employee_id": 1, "tenant_id": "other_co"}).status_code == 403
    assert client.get("/financial-impact/1", headers=hr, params={"tenant_id": "other_co"}).status_code == 403
    assert client.post("/whatif", headers=hr, json={"employee_id": 1, "tenant_id": "ibm_demo"}).status_code == 200
    # ไม่ส่ง Content-Type / ส่งเป็น text/plain: FastAPI ยัง parse JSON ได้ ต้องถูกตรวจเหมือนกัน
    raw = b'{"employee_id": 1, "tenant_id": "other_co"}'
    for ctype in (None, "text/plain", "application/merge-patch+json"):
        h = hr | ({"Content-Type": ctype} if ctype else {})
        assert client.post("/whatif", headers=h, content=raw).status_code == 403, ctype
    assert client.get("/financial-impact/1?tenant_id=ibm_demo&tenant_id=other_co", headers=hr).status_code == 403


def test_login_rate_limit_and_body_cap():
    codes = [client.post("/auth/login", json={"username": "x", "password": "x"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429
    limit = auth.RateLimit(2)
    limit.check("u"), limit.check("u")
    with pytest.raises(HTTPException) as e:
        limit.check("u")
    assert e.value.status_code == 429
    auth.login_limit.reset()
    big = b"x" * (11 * 1024 * 1024)
    r = client.post("/employees/validate", headers=login("hr_demo"), files={"file": ("a.csv", big, "text/csv")})
    assert r.status_code == 413
