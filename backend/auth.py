"""Login + token + จำกัดจำนวนครั้งที่เรียก (SEC-01/02/03)

POST /auth/login {username, password} -> token แนบเป็น "Authorization: Bearer <token>" ทุก request
tenant ของผู้ใช้มาจาก token เท่านั้น request ที่ส่ง tenant_id ของบริษัทอื่นมาได้ 403 (SEC-02)

POST /auth/register สร้างบริษัทใหม่ (บริษัทว่าง) + บัญชี admin แล้ว login ให้เลย (ต้องต่อ DB)
GET/POST /auth/users admin ดู/เพิ่มบัญชีของบริษัทตัวเอง บัญชีเหล่านี้อยู่ในตาราง app_users รหัสผ่านเก็บเป็น PBKDF2
ponytail: บัญชีทดลองยังเขียนไว้ในโค้ด (หน้า login แสดงรหัสให้ด้วย) ใช้กับข้อมูลตัวอย่างเท่านั้น
ยังไม่มีเปลี่ยน/รีเซ็ตรหัสผ่าน ลบบัญชี หรือยืนยันอีเมล ก่อนใช้ข้อมูลจริงให้ทีมตกลงวิธี auth (SEC-01)
token เซ็นด้วย HMAC-SHA256 (stdlib) ไม่ตั้ง AUTH_SECRET = สุ่มใหม่ทุกครั้งที่เปิด backend ทุกคนต้อง login ใหม่หลัง restart
rate limit เก็บในหน่วยความจำของ process เดียว ถ้ารันหลาย worker/เครื่อง ให้ย้ายไป Redis หรือ reverse proxy
"""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from collections import defaultdict, deque

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

import calibration
import db  # noqa: E402

router = APIRouter(tags=["auth"])

DEMO_USERS = {
    "hr_demo": {"password": "hr-demo-1234", "role": "hr", "tenant_id": "ibm_demo", "name": "ฝ่ายบุคคล (ทดลอง)"},
    "admin_demo": {"password": "admin-demo-1234", "role": "admin", "tenant_id": "ibm_demo", "name": "ผู้ดูแลระบบ (ทดลอง)"},
    # บริษัทที่เริ่มจากว่าง: ลองนำเข้าพนักงานของบริษัทเอง ไม่เห็นข้อมูล IBM (ข้อมูลแยกตาม tenant_id)
    "newco_hr": {"password": "newco-hr-1234", "role": "hr", "tenant_id": "newco_demo", "name": "ฝ่ายบุคคล (บริษัทใหม่)"},
    "newco_admin": {"password": "newco-admin-1234", "role": "admin", "tenant_id": "newco_demo", "name": "ผู้ดูแลระบบ (บริษัทใหม่)"},
}
SECRET = (os.getenv("AUTH_SECRET") or secrets.token_hex(32)).encode()
TOKEN_TTL = 8 * 3600  # 1 วันทำงาน

_bearer = HTTPBearer(auto_error=False)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _sign(payload: str) -> str:
    return _b64(hmac.new(SECRET, payload.encode(), hashlib.sha256).digest())


def issue_token(username: str, now: float = None) -> str:
    payload = _b64(json.dumps({"sub": username, "exp": int((now or time.time()) + TOKEN_TTL)}).encode())
    return f"{payload}.{_sign(payload)}"


def read_token(token: str):
    """คืนชื่อผู้ใช้ถ้า token ถูกต้องและยังไม่หมดอายุ ไม่งั้น None"""
    payload, _, sig = token.partition(".")
    # เทียบเป็น bytes: compare_digest กับ str ที่มีอักษรนอก ASCII จะ TypeError (เคยทำให้ token ภาษาไทยได้ 500, SEC-16)
    if not hmac.compare_digest(sig.encode(), _sign(payload).encode()):
        return None
    try:
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except ValueError:
        return None
    return data.get("sub") if data.get("exp", 0) > time.time() else None


TENANT_NAMES = {"ibm_demo": "IBM HR Analytics (ข้อมูลตัวอย่าง)", "newco_demo": "บริษัทตัวอย่าง"}  # ชื่อเดียวกับตาราง tenants ใน DB

# ---- รหัสผ่านของบัญชีใน DB: PBKDF2-SHA256 (stdlib) salt สุ่มต่อบัญชี ----
PBKDF2_ROUNDS = 240_000


def hash_password(password: str, salt: bytes = None, rounds: int = PBKDF2_ROUNDS) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"pbkdf2_sha256${rounds}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt, _ = stored.split("$")
        return hmac.compare_digest(hash_password(password, bytes.fromhex(salt), int(rounds)).encode(), stored.encode())
    except ValueError:
        return False


DUMMY_HASH = hash_password(secrets.token_hex(8))  # ชื่อผู้ใช้ไม่มี = ยังคำนวณ hash เวลาเท่ากัน เดาไม่ได้ว่าชื่อไหนมีอยู่


def _db_user(username: str):
    """บัญชีจากตาราง app_users พร้อมชื่อบริษัท ไม่ต่อ DB / ไม่มี / DB เก่ายังไม่มีตาราง = None"""
    if not db.url():
        return None
    try:
        with db.connect() as conn:
            row = conn.execute(
                "SELECT u.username, u.name, u.role, u.tenant_id, t.name, u.password_hash "
                "FROM app_users u JOIN tenants t USING (tenant_id) WHERE u.username = %s",
                (username,),
            ).fetchone()
    except Exception:  # noqa: BLE001  เช่น DB เก่ายังไม่มีตาราง app_users (QA-06): ใช้ได้แค่บัญชีทดลอง
        return None
    if row is None:
        return None
    keys = ("username", "name", "role", "tenant_id", "tenant_name", "password_hash")
    return dict(zip(keys, row))


def public(username: str):
    """ข้อมูลผู้ใช้ที่ส่งให้หน้าเว็บ/endpoint (ไม่มีรหัสผ่าน) ไม่พบบัญชี = None"""
    if username in DEMO_USERS:
        u = DEMO_USERS[username]
        t = u["tenant_id"]
        return {"username": username, "name": u["name"], "role": u["role"], "tenant_id": t, "tenant_name": TENANT_NAMES.get(t, t)}
    u = _db_user(username)
    return None if u is None else {k: v for k, v in u.items() if k != "password_hash"}


def current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    username = read_token(creds.credentials) if creds else None
    user = public(username) if username else None  # บัญชีที่ถูกลบไปแล้ว token เดิมใช้ไม่ได้
    if not user:
        raise HTTPException(401, "กรุณาเข้าสู่ระบบก่อน (หรือหมดเวลาแล้ว เข้าสู่ระบบใหม่)", headers={"WWW-Authenticate": "Bearer"})
    return user


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "ต้องเป็นผู้ดูแลระบบของบริษัทเท่านั้น")
    return user


async def same_tenant(request: Request, user: dict = Depends(current_user)) -> dict:
    """ใส่ทุก router: ถ้าส่ง tenant_id (query หรือ JSON body) ต้องเป็นบริษัทของผู้ใช้เอง
    ค่าที่ผิดรูปแบบปล่อยให้ validation ของ endpoint ตอบ 422 ตามเดิม"""
    sent = request.query_params.getlist("tenant_id")  # ส่งซ้ำหลายตัว (?tenant_id=a&tenant_id=b) ต้องผ่านทุกตัว
    # อ่าน body ทุกครั้งที่ไม่ใช่ form/ไฟล์ ไม่ดู Content-Type เพราะ FastAPI parse JSON ได้แม้ไม่ส่ง header นี้
    if not request.headers.get("content-type", "").lower().startswith(("multipart/", "application/x-www-form-urlencoded")):
        try:
            body = json.loads(await request.body() or b"null")  # Starlette cache body ไว้ endpoint อ่านซ้ำได้
        except ValueError:
            body = None  # body ไม่ใช่ JSON: endpoint ตอบ 422 เอง
        if isinstance(body, dict):
            sent.append(body.get("tenant_id"))
    for t in sent:
        if isinstance(t, str) and re.match(calibration.TENANT_ID_PATTERN, t) and t != user["tenant_id"]:
            raise HTTPException(403, "เข้าถึงข้อมูลของบริษัทอื่นไม่ได้")
    return user


class RateLimit:
    """อนุญาตไม่เกิน n ครั้งต่อ per วินาที ต่อ key (ผู้ใช้ หรือ IP สำหรับ login)"""

    def __init__(self, n: int, per: float = 60):
        self.n, self.per = n, per
        self.hits = defaultdict(deque)

    def check(self, key: str):
        now, q = time.monotonic(), self.hits[key]
        while q and now - q[0] > self.per:
            q.popleft()
        if len(q) >= self.n:
            raise HTTPException(429, "เรียกถี่เกินไป รอสักครู่แล้วลองใหม่", headers={"Retry-After": str(int(self.per))})
        q.append(now)

    def per_user(self, user: dict = Depends(current_user)):
        self.check(user["username"])

    def reset(self):
        self.hits.clear()


login_limit = RateLimit(10)  # กันเดารหัสผ่าน
register_limit = RateLimit(5, per=3600)  # สร้างบริษัทใหม่ได้ไม่เกิน 5 ครั้ง/ชั่วโมง/IP กันสร้างบริษัทขยะรัวๆ
# เพิ่มบัญชี: ตอบ 409 เมื่อชื่อซ้ำ (หน้าสมัครทุกเว็บต้องบอก) จึงจำกัดจำนวนครั้งไว้ ไม่ให้ใช้ไล่เดาว่าชื่อไหนมีอยู่
add_user_limit = RateLimit(20, per=3600)
# บริษัทเดโมใช้บัญชีทดลองร่วมกัน (รหัสแสดงบนหน้า login) ถ้าให้เพิ่มบัญชีได้ ใครก็ใส่ admin ถาวรของตัวเองได้
DEMO_TENANTS = {u["tenant_id"] for u in DEMO_USERS.values()}
LIMITS = {  # ใช้ใน main.py
    "whatif": RateLimit(240),  # หน้า What-if เรียกทุกครั้งที่ปรับค่า
    "recalibrate": RateLimit(30),  # รวมดูประวัติ/ดาวน์โหลดไฟล์ตัวอย่างในแท็บปรับเทียบ
    "import": RateLimit(20),
    "validate": RateLimit(30),  # SEC-15: ตรวจไฟล์ 10,000 แถวใช้ CPU หลายวินาที
}


class LoginRequest(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    settings: dict = {}  # ค่าที่หน้าเว็บต้องใช้ตรงกับ backend (ตอนนี้ว่าง: เงินเป็นบาทแล้ว ไม่ต้องส่งอัตราแลกเปลี่ยน DE-01)


def _session(username: str) -> LoginResponse:
    return LoginResponse(access_token=issue_token(username), user=public(username), settings={})


@router.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request):
    login_limit.check(request.client.host if request.client else "?")
    username = req.username.strip()
    demo = DEMO_USERS.get(username)
    if demo:  # เทียบแบบเวลาคงที่
        ok = hmac.compare_digest(demo["password"].encode(), req.password.encode())
    else:
        stored = _db_user(username.lower())
        ok = verify_password(req.password, stored["password_hash"] if stored else DUMMY_HASH) and stored is not None
        username = username.lower()
    if not ok:  # ข้อความเดียวกันไม่ว่าผิดชื่อหรือผิดรหัส
        raise HTTPException(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
    return _session(username)


# ---- สร้างบริษัท / บัญชีจากหน้าเว็บ (เก็บใน DB) ----
USERNAME = r"^[a-z0-9_.-]{3,32}$"  # ตรงกับ CHECK ของตาราง app_users


class NewAccount(BaseModel):
    username: str = Field(pattern=USERNAME, description="a-z 0-9 _ . - ยาว 3–32 ตัว")
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)


class RegisterRequest(NewAccount):
    company_name: str = Field(min_length=1, max_length=100)


class NewUser(NewAccount):
    role: Literal["admin", "hr"] = "hr"


def _need_db():
    if not db.url():
        raise HTTPException(503, "ระบบยังไม่ได้ต่อฐานข้อมูล สร้างบัญชีไม่ได้ (ผู้ดูแลต้องตั้ง DATABASE_URL)")


def _taken(conn, username: str) -> bool:
    return username in DEMO_USERS or conn.execute("SELECT 1 FROM app_users WHERE username = %s", (username,)).fetchone() is not None


TAKEN = "ชื่อผู้ใช้นี้มีคนใช้แล้ว ลองชื่ออื่น"


@router.post("/auth/register", response_model=LoginResponse)
def register(req: RegisterRequest, request: Request):
    """สร้างบริษัทใหม่ (เริ่มจากว่าง ไม่เห็นข้อมูลของบริษัทอื่น) + บัญชี admin ของบริษัทนั้น แล้ว login ให้เลย"""
    register_limit.check(request.client.host if request.client else "?")
    _need_db()
    tenant = f"co_{secrets.token_hex(5)}"  # ผู้ใช้ไม่ต้องตั้งรหัสบริษัทเอง ไม่ชนกับบริษัทอื่น
    with db.connect() as conn:  # transaction เดียว: สร้างบัญชีไม่ได้ = ไม่มีบริษัทค้าง
        if _taken(conn, req.username):
            raise HTTPException(409, TAKEN)
        conn.execute("INSERT INTO tenants (tenant_id, name) VALUES (%s, %s)", (tenant, req.company_name.strip()))
        conn.execute(
            "INSERT INTO app_users (username, tenant_id, role, name, password_hash) VALUES (%s, %s, 'admin', %s, %s)",
            (req.username, tenant, req.name.strip(), hash_password(req.password)),
        )
    return _session(req.username)


@router.get("/auth/users")
def list_users(user: dict = Depends(require_admin)):
    """บัญชีทั้งหมดของบริษัทตัวเอง (บัญชีทดลองในโค้ด + บัญชีที่สร้างจากหน้าเว็บ) ไม่มีรหัสผ่าน"""
    demo = [{"username": k, "name": v["name"], "role": v["role"], "demo": True} for k, v in DEMO_USERS.items() if v["tenant_id"] == user["tenant_id"]]
    rows = []
    if db.url():
        with db.connect() as conn:
            rows = conn.execute(
                "SELECT username, name, role FROM app_users WHERE tenant_id = %s ORDER BY created_at", (user["tenant_id"],)
            ).fetchall()
    return {"users": demo + [{"username": u, "name": n, "role": r, "demo": False} for u, n, r in rows]}


@router.post("/auth/users", status_code=201)
def add_user(req: NewUser, user: dict = Depends(require_admin)):
    """admin เพิ่มบัญชี (HR หรือ admin) ให้บริษัทตัวเองเท่านั้น (ไม่รวมบริษัทเดโม)"""
    if user["tenant_id"] in DEMO_TENANTS:
        raise HTTPException(403, "บริษัทเดโมใช้บัญชีทดลองร่วมกัน เพิ่มบัญชีไม่ได้ ถ้าอยากลองให้สร้างบริษัทใหม่จากหน้าเข้าสู่ระบบ")
    add_user_limit.check(user["username"])
    _need_db()
    with db.connect() as conn:
        if _taken(conn, req.username):
            raise HTTPException(409, TAKEN)
        conn.execute(
            "INSERT INTO app_users (username, tenant_id, role, name, password_hash) VALUES (%s, %s, %s, %s, %s)",
            (req.username, user["tenant_id"], req.role, req.name.strip(), hash_password(req.password)),
        )
    return {"username": req.username, "name": req.name.strip(), "role": req.role, "demo": False}


@router.get("/auth/me")
def me(user: dict = Depends(current_user)):
    return user
