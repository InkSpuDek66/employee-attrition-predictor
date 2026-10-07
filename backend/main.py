"""FastAPI app -- รัน: uvicorn main:app --reload  (จากโฟลเดอร์ backend/)

แต่ละคนเพิ่ม router ของตัวเองใน routers/ แล้ว include ที่นี่ (README 10.3)
ทุก router ต้อง login (auth.same_tenant) ยกเว้น /auth/login ดู backend/auth.py
"""

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

import auth
from routers import company_summary, employee_upload, financial_impact, predict, recalibrate, shap, whatif

MAX_BODY_BYTES = 10 * 1024 * 1024  # SEC-03: ไฟล์นำเข้าจำกัด 5 MB, /recalibrate ไม่เกิน 10,000 แถว (~8 MB)

app = FastAPI(title="Employee Attrition Predictor API")


@app.middleware("http")
async def limit_body(request: Request, call_next):
    # ponytail: เช็กจาก Content-Length อย่างเดียว ตอน deploy ตั้งเพดานที่ reverse proxy ด้วย (กัน chunked body)
    if int(request.headers.get("content-length") or 0) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "ข้อมูลที่ส่งมาใหญ่เกิน 10 MB"}, status_code=413)
    return await call_next(request)


login_required = [Depends(auth.same_tenant)]
app.include_router(auth.router)
app.include_router(shap.router, dependencies=login_required)
app.include_router(recalibrate.router, dependencies=login_required + [Depends(auth.LIMITS["recalibrate"].per_user)])
app.include_router(company_summary.router, dependencies=login_required)
app.include_router(predict.router, dependencies=login_required)
app.include_router(whatif.router, dependencies=login_required + [Depends(auth.LIMITS["whatif"].per_user)])
app.include_router(financial_impact.router, dependencies=login_required)
app.include_router(employee_upload.router, dependencies=login_required)
