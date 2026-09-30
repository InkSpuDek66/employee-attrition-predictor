"""FastAPI app -- รัน: uvicorn main:app --reload  (จากโฟลเดอร์ backend/)

แต่ละคนเพิ่ม router ของตัวเองใน routers/ แล้ว include ที่นี่ (README 10.3)
"""

from fastapi import FastAPI

from routers import company_summary, financial_impact, predict, recalibrate, shap, whatif

app = FastAPI(title="Employee Attrition Predictor API")
app.include_router(shap.router)
app.include_router(recalibrate.router)
app.include_router(company_summary.router)
app.include_router(predict.router)
app.include_router(whatif.router)
app.include_router(financial_impact.router)
