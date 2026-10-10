"""FastAPI app -- รัน: uvicorn main:app --reload  (จากโฟลเดอร์ backend/)

แต่ละคนเพิ่ม router ของตัวเองใน routers/ แล้ว include ที่นี่ (README 10.3)
ทุก router ต้อง login (auth.same_tenant) ยกเว้น /auth/login ดู backend/auth.py
"""

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

import auth
from routers import company_summary, employee_upload, financial_impact, predict, recalibrate, shap, whatif

MAX_BODY_BYTES = 10 * 1024 * 1024  # SEC-03: ไฟล์นำเข้าจำกัด 5 MB, /recalibrate ไม่เกิน 10,000 แถว (~8 MB)

app = FastAPI(title="Employee Attrition Predictor API")


class BodyLimit:
    """ปฏิเสธ body ที่เกิน MAX_BODY_BYTES ทั้งแบบมี Content-Length และแบบส่งเป็น chunk (นับไบต์ระหว่างอ่าน)"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        length = dict(scope["headers"]).get(b"content-length", b"0")
        if int(length or 0) > MAX_BODY_BYTES:
            return await JSONResponse({"detail": TOO_LARGE}, status_code=413)(scope, receive, send)
        seen = 0

        async def counted():
            nonlocal seen
            message = await receive()
            seen += len(message.get("body", b""))
            if seen > MAX_BODY_BYTES:
                raise HTTPException(413, TOO_LARGE)  # FastAPI แปลงเป็น response 413 ตอนอ่าน body
            return message

        await self.app(scope, counted, send)


TOO_LARGE = "ข้อมูลที่ส่งมาใหญ่เกิน 10 MB"
app.add_middleware(BodyLimit)


login_required = [Depends(auth.same_tenant)]
app.include_router(auth.router)
app.include_router(shap.router, dependencies=login_required)
app.include_router(recalibrate.router, dependencies=login_required + [Depends(auth.LIMITS["recalibrate"].per_user)])
app.include_router(company_summary.router, dependencies=login_required)
app.include_router(predict.router, dependencies=login_required)
app.include_router(whatif.router, dependencies=login_required + [Depends(auth.LIMITS["whatif"].per_user)])
app.include_router(financial_impact.router, dependencies=login_required)
app.include_router(employee_upload.router, dependencies=login_required)
