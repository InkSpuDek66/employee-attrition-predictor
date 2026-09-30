"""หน้าเว็บทดสอบ (EXPERIMENTAL) มี 2 หน้า สลับได้ด้วยแถบด้านบนหรือ path ของ URL:
- /model   ทดสอบโมเดล: กรอกข้อมูลพนักงานทุกช่อง ดูระดับความเสี่ยง เหตุผล (SHAP) และต้นทุน
- /whatif  What-if Simulator: ปรับเฉพาะค่าที่บริษัทเปลี่ยนได้ เทียบความเสี่ยงก่อน/หลัง (ใช้ข้อมูลจำลองได้)

ไม่ใช่ frontend จริงของโปรเจกต์ (ตัวจริงคือ React + FastAPI ตาม README) ใช้แค่ลองโมเดลในเครื่อง
รัน: streamlit run src/test_app.py   (จากรากโปรเจกต์)

ใช้โมเดล/ขั้นเตรียมข้อมูลชุดเดียวกับ backend (backend/model_store.py อ่าน MODEL_URI และ MLflow จาก .env)
และเกณฑ์ระดับความเสี่ยง + ต้นทุนจาก src/business_rules.py ของทีม ผลในหน้านี้จึงตรงกับ API
"""

import streamlit as st

st.set_page_config(page_title="ทดสอบโมเดลทำนายการลาออก", layout="wide")
st.navigation(
    [
        st.Page("app_pages/model_page.py", title="ทดสอบโมเดล", url_path="model", default=True),
        st.Page("app_pages/whatif_page.py", title="What-if Simulator", url_path="whatif"),
    ],
    position="top",
).run()
