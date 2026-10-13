"""สร้างบริษัทใหม่จากหน้าเว็บ + บัญชีใน DB (app_users) ใช้ auth จริง (ปิด override ของ conftest) และ PostgreSQL จริง"""

import pytest
from fastapi.testclient import TestClient

import auth
import conftest
import db
from main import app

client = TestClient(app)
PASSWORD = "test-pass-1234"


@pytest.fixture
def accounts(monkeypatch):
    """auth จริง + DB จริง ลบบริษัท/บัญชีที่ test สร้างทิ้งหลังจบ (ชื่อขึ้นต้น pytest_)"""
    if not conftest.REAL_DATABASE_URL:
        pytest.skip("ไม่ได้ตั้ง DATABASE_URL")
    monkeypatch.setenv("DATABASE_URL", conftest.REAL_DATABASE_URL)
    try:
        db.connect().close()
    except Exception:  # noqa: BLE001
        pytest.skip("ต่อ PostgreSQL ไม่ได้ (docker compose up -d postgres)")
    saved = app.dependency_overrides.pop(auth.current_user)
    auth.login_limit.reset()
    auth.register_limit.reset()
    yield
    app.dependency_overrides[auth.current_user] = saved
    with db.connect() as conn:
        tenants = [t for (t,) in conn.execute("SELECT tenant_id FROM app_users WHERE username LIKE 'pytest_%'")]
        conn.execute("DELETE FROM app_users WHERE username LIKE 'pytest_%'")
        conn.execute("DELETE FROM tenants WHERE tenant_id = ANY(%s) AND tenant_id LIKE 'co_%%'", (tenants,))


def register(username, company="บริษัททดสอบ"):
    return client.post("/auth/register", json={"company_name": company, "name": "ผู้ดูแลทดสอบ", "username": username, "password": PASSWORD})


def bearer(r):
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_password_is_hashed_and_checked():
    stored = auth.hash_password("abc12345")
    assert "abc12345" not in stored and stored.startswith("pbkdf2_sha256$")
    assert auth.verify_password("abc12345", stored) and not auth.verify_password("abc12346", stored)
    assert not auth.verify_password("x", "เสีย")


def test_register_new_company_starts_empty(accounts):
    r = register("pytest_owner")
    assert r.status_code == 200, r.text
    admin = bearer(r)
    me = client.get("/auth/me", headers=admin).json()
    assert me["role"] == "admin" and me["tenant_id"].startswith("co_") and me["tenant_name"] == "บริษัททดสอบ"
    assert client.get("/company-summary", headers=admin).json()["n_employees"] == 0  # ไม่เห็นข้อมูลของ IBM
    assert client.get("/shap/1", headers=admin).status_code == 404
    login = client.post("/auth/login", json={"username": "PYTEST_OWNER ", "password": PASSWORD})  # ตัวพิมพ์ใหญ่/เว้นวรรค
    assert login.status_code == 200
    assert client.post("/auth/login", json={"username": "pytest_owner", "password": "wrong-pass"}).status_code == 401
    assert register("pytest_owner").status_code == 409  # ชื่อซ้ำ
    assert register("admin_demo").status_code == 409  # ชื่อซ้ำกับบัญชีทดลอง
    with db.connect() as conn:
        (stored,) = conn.execute("SELECT password_hash FROM app_users WHERE username = 'pytest_owner'").fetchone()
    assert PASSWORD not in stored


def test_admin_adds_hr_only_in_own_company(accounts):
    admin = bearer(register("pytest_boss"))
    new_hr = {"username": "pytest_staff", "password": PASSWORD, "name": "HR ทดสอบ", "role": "hr"}
    assert client.post("/auth/users", json=new_hr, headers=admin).status_code == 201
    hr = bearer(client.post("/auth/login", json={"username": "pytest_staff", "password": PASSWORD}))
    me = client.get("/auth/me", headers=hr).json()
    assert me["role"] == "hr" and me["tenant_id"] == client.get("/auth/me", headers=admin).json()["tenant_id"]
    assert client.post("/auth/users", json=new_hr | {"username": "pytest_x"}, headers=hr).status_code == 403  # HR เพิ่มบัญชีไม่ได้
    assert [u["username"] for u in client.get("/auth/users", headers=admin).json()["users"]] == ["pytest_boss", "pytest_staff"]
    other = bearer(register("pytest_other", company="อีกบริษัท"))
    assert [u["username"] for u in client.get("/auth/users", headers=other).json()["users"]] == ["pytest_other"]
    bad = {"username": "ab", "password": "short", "name": ""}
    assert client.post("/auth/users", json=bad, headers=admin).status_code == 422


def test_deleted_account_token_stops_working(accounts):
    admin = bearer(register("pytest_gone"))
    tenant = client.get("/auth/me", headers=admin).json()["tenant_id"]
    with db.connect() as conn:  # ลบบริษัทด้วย (fixture หาบริษัทจากบัญชี ซึ่งลบไปแล้ว)
        conn.execute("DELETE FROM app_users WHERE username = 'pytest_gone'")
        conn.execute("DELETE FROM tenants WHERE tenant_id = %s", (tenant,))
    assert client.get("/auth/me", headers=admin).status_code == 401


def test_register_needs_database(monkeypatch):
    saved = app.dependency_overrides.pop(auth.current_user)
    auth.register_limit.reset()
    try:
        monkeypatch.setenv("DATABASE_URL", "")
        assert register("pytest_nodb").status_code == 503
    finally:
        app.dependency_overrides[auth.current_user] = saved
