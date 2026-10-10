"""Login + token + จำกัดจำนวนครั้งที่เรียก (SEC-01/02/03)

POST /auth/login {username, password} -> token แนบเป็น "Authorization: Bearer <token>" ทุก request
tenant ของผู้ใช้มาจาก token เท่านั้น request ที่ส่ง tenant_id ของบริษัทอื่นมาได้ 403 (SEC-02)

ponytail: บัญชีทดลองเขียนไว้ในโค้ด (หน้า login แสดงรหัสให้ด้วย) ใช้กับข้อมูลตัวอย่างเท่านั้น
ก่อน deploy/ใช้ข้อมูลจริง ต้องย้ายไปตาราง users ใน DB + hash รหัสผ่าน (เช่น bcrypt) และให้ทีมตกลงวิธี auth (SEC-01)
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

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

import calibration

router = APIRouter(tags=["auth"])

DEMO_USERS = {
    "hr_demo": {"password": "hr-demo-1234", "role": "hr", "tenant_id": "ibm_demo", "name": "ฝ่ายบุคคล (ทดลอง)"},
    "admin_demo": {"password": "admin-demo-1234", "role": "admin", "tenant_id": "ibm_demo", "name": "ผู้ดูแลระบบ (ทดลอง)"},
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
    if not hmac.compare_digest(sig, _sign(payload)):
        return None
    try:
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except ValueError:
        return None
    return data["sub"] if data.get("exp", 0) > time.time() and data.get("sub") in DEMO_USERS else None


TENANT_NAMES = {"ibm_demo": "IBM HR Analytics (ข้อมูลตัวอย่าง)"}  # ชื่อเดียวกับตาราง tenants ใน DB


def public(username: str) -> dict:
    u = DEMO_USERS[username]
    t = u["tenant_id"]
    return {"username": username, "name": u["name"], "role": u["role"], "tenant_id": t, "tenant_name": TENANT_NAMES.get(t, t)}


def current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    username = read_token(creds.credentials) if creds else None
    if not username:
        raise HTTPException(401, "กรุณาเข้าสู่ระบบก่อน (หรือหมดเวลาแล้ว เข้าสู่ระบบใหม่)", headers={"WWW-Authenticate": "Bearer"})
    return public(username)


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
LIMITS = {  # ใช้ใน main.py
    "whatif": RateLimit(240),  # หน้า What-if เรียกทุกครั้งที่ปรับค่า
    "recalibrate": RateLimit(10),
    "import": RateLimit(20),
}


class LoginRequest(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request):
    login_limit.check(request.client.host if request.client else "?")
    u = DEMO_USERS.get(req.username)
    # เทียบแบบเวลาคงที่ และตอบข้อความเดียวกันไม่ว่าผิดชื่อหรือผิดรหัส
    if not hmac.compare_digest((u or {}).get("password", "").encode(), req.password.encode()) or not u:
        raise HTTPException(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
    return LoginResponse(access_token=issue_token(req.username), user=public(req.username))


@router.get("/auth/me")
def me(user: dict = Depends(current_user)):
    return user
