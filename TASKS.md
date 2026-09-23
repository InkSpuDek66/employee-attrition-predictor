# Individual Task Checklist (แผนงานรายบุคคล)

> ไฟล์นี้แตกจาก [README.md](README.md#103-การแบ่งงานรายบุคคลในแต่ละ-phase-ละเอียด) หัวข้อ 10.3 มาเป็น checklist รายบุคคล ใช้ติ๊กตามความคืบหน้าจริง — ถ้าแผนงานเปลี่ยน ให้แก้ที่ README ก่อนแล้วค่อยอัปเดตไฟล์นี้ตาม (README คือ source of truth ของแผน)

**สรุปบทบาทหลัก (เหตุผลเต็มดูที่ README 10.3):** Puripat + Saphondanai เป็นเจ้าของ pipeline ข้อมูล→โมเดล→backend หลัก→frontend ส่วนซับซ้อน (งานเทคนิคหนัก 🔴 ต่อเนื่องกันตลอดโปรเจกต์) ส่วน Yanisa + Nanthamon ดูแล EDA, baseline model, endpoint รอง, Survival/Fairness, frontend ส่วนเบา, Superset dashboard (งานสนับสนุน 🟡/🟢)

**Course Milestones ที่ต้องเจอระหว่างทาง:** Week 9 = Data Gate (อยู่ใน wk4–5), Week 13 = Model Gate (อยู่ใน wk8–9), Week 15–16 = Product Gate/สอบจริง (buffer หลัง wk9) — ดูรายละเอียดที่ [README 10.1](README.md#101-course-milestones-กำหนดการนำเสนอตามรายวิชา)

---

## Yanisa Intharawicha (66080853)

### wk1 (22–28 ก.ย.) — Foundation & EDA
- [ ] เข้าประชุม Requirement + ตั้งสมมติฐานธุรกิจ ร่วมกับทั้งทีม (~2–3 ชม.)
  - **วิธีทำ:** ทบทวนสไลด์ proposal เดิม สรุปขอบเขต/สมมติฐานธุรกิจลง Google Docs ร่วม
  - **ผลลัพธ์ที่ต้องส่ง:** เอกสาร requirement + สมมติฐานธุรกิจ (ทั้งทีมเห็นตรงกัน)
- [ ] ทำ EDA ฝั่ง **ฟีเจอร์ตัวเลข** (Age, MonthlyIncome, DistanceFromHome, YearsAtCompany, TotalWorkingYears ฯลฯ) ร่วมกับ Nanthamon
  - **วิธีทำ:** เปิด notebook ของตัวเอง เทียบค่าเฉลี่ย/การกระจายตัวระหว่างกลุ่มลาออก vs ไม่ลาออก ทำกราฟ histogram/boxplot ต่อฟีเจอร์
  - **ผลลัพธ์ที่ต้องส่ง:** notebook EDA ฝั่งตัวเลข + สรุป 3–5 bullet ว่าฟีเจอร์ไหนน่าสนใจสุด

### wk2–3 (29 ก.ย.–12 ต.ค.) — Modeling
- [ ] Train baseline model — **Logistic Regression** ร่วมกับ Nanthamon
  - **วิธีทำ:** ใช้ `data/processed/` ที่ Puripat/Saphondanai clean มา เทรน Logistic Regression เป็น baseline เปรียบเทียบ log ผล (AUC, F1, precision/recall) เข้า MLflow tracking server กลาง (URI จาก Saphondanai)
  - **ผลลัพธ์ที่ต้องส่ง:** MLflow run ที่ log แล้ว + บันทึกสั้นๆ ว่า baseline ทำได้แค่ไหนเทียบกับโมเดลหลักของ Puripat/Saphondanai

### wk4–5 (13–26 ต.ค.) — SHAP + Progress Check (Data Gate ★ wk4)
- [ ] SHAP integration รายบุคคล ร่วมกับ Puripat
  - **วิธีทำ:** โหลดโมเดลที่ promote แล้วจาก MLflow registry ใช้ `shap.TreeExplainer` คำนวณ SHAP values รายพนักงาน ทำ summary plot / waterfall plot ตัวอย่าง
  - **ผลลัพธ์ที่ต้องส่ง:** module คำนวณ SHAP (พร้อมต่อกับ endpoint `/shap` ในสัปดาห์ถัดไป) + ตัวอย่างกราฟ
- [ ] เตรียม slide หัวข้อ **EDA Findings** (2–3 แผ่น) สำหรับ Data Gate
  - **วิธีทำ:** สรุปผล EDA ฝั่งตัวเลขที่ทำใน wk1 ให้เป็นภาพ/กราฟสั้นกระชับ
  - **ผลลัพธ์ที่ต้องส่ง:** slide 2–3 แผ่นใน Google Slides ทีม + ซ้อมพูดหัวข้อนี้

### wk6–7 (27 ต.ค.–9 พ.ย.) — Backend & Analysis
- [ ] FastAPI endpoint รอง: `/interventions`, `/health` ร่วมกับ Nanthamon (Nanthamon ทำ `/calibration-status`, `/dashboard/summary`)
  - **วิธีทำ:** สร้าง `routers/interventions.py` เชื่อม dev database กลาง (Supabase/Neon) ตาม schema ที่ตกลงไว้ใน README หัวข้อ 7
  - **ผลลัพธ์ที่ต้องส่ง:** endpoint ทำงานได้จริง + ตัวอย่าง request/response
- [ ] Survival Analysis ร่วมกับ Nanthamon
  - **วิธีทำ:** เริ่มจาก tutorial ของ `lifelines` library ก่อน แล้ว apply Kaplan-Meier/Cox Proportional Hazards กับ dataset (duration = YearsAtCompany, event = Attrition)
  - **ผลลัพธ์ที่ต้องส่ง:** notebook survival curve + สรุปการตีความผล (ตอบคำถาม "จะลาออกเมื่อไหร่")
- [ ] Fairness check ร่วมกับ Nanthamon (ต่อจาก Survival Analysis)
  - **วิธีทำ:** ใช้ Fairlearn `MetricFrame` เช็ค demographic parity ของ risk_score ระหว่างกลุ่มเพศ/ช่วงอายุ ตาม [6.4](README.md#64-fairness-check)
  - **ผลลัพธ์ที่ต้องส่ง:** fairness report notebook + สรุปว่าพบ bias ไหม

### wk8–9 (10–23 พ.ย.) — BI & Frontend + Closing (Model Gate ★ wk8, Product Gate buffer)
- [ ] React: **Intervention Tracker** component ร่วมกับ Nanthamon
  - **วิธีทำ:** สร้างหน้า list + form บันทึก/ดูประวัติ intervention เรียก `POST/GET /interventions` ถ้า backend ยังไม่เสร็จให้ mock data ตาม schema ไปก่อน
  - **ผลลัพธ์ที่ต้องส่ง:** component ใช้งานได้จริง เชื่อม backend แล้ว
- [ ] Integration testing ร่วมกับทั้งทีม (นัดเวลา `docker-compose up` พร้อมกัน)
- [ ] เขียนรายงานส่วน **EDA & Survival Analysis** สำหรับรายงานจบ + slide Model Gate
- [ ] ซ้อม demo ส่วน Intervention Tracker + Survival Analysis เตรียมตอบคำถามช่วง Final (Product Gate)

---

## Saphondanai Chuechan (66076195)

### wk1 (22–28 ก.ย.) — Foundation & EDA
- [ ] เข้าประชุม Requirement + ตั้งสมมติฐานธุรกิจ ร่วมกับทั้งทีม
- [ ] Data cleaning ร่วมกับ Puripat
  - **วิธีทำ:** จัดการ missing value, encode categorical (OneHot/Ordinal ตามความเหมาะสม), ตรวจ timeline ของแต่ละฟีเจอร์ตาม [6.2 Data Leakage Guard](README.md#62-data-leakage-guard) ทำใน notebook ของตัวเอง (`01_cleaning_S.ipynb`) แล้วเทียบกับของ Puripat
  - **ผลลัพธ์ที่ต้องส่ง:** notebook cleaning ของตัวเอง + ร่วมสรุปเป็น `clean_pipeline.py` ไฟล์เดียวกับ Puripat ตอนจบสัปดาห์

### wk2–3 (29 ก.ย.–12 ต.ค.) — Modeling
- [ ] Feature engineering ร่วมกับ Puripat (ต่อเนื่องจาก Data cleaning)
  - **วิธีทำ:** สร้างฟีเจอร์ใหม่จาก domain knowledge (เช่น tenure ratio, income-per-level) encode ฟีเจอร์หมวดหมู่ที่เหลือ
  - **ผลลัพธ์ที่ต้องส่ง:** `feature_pipeline.py` (ทำงานร่วมกับ Puripat)
- [ ] Train + tune model หลัก (XGBoost) — **เป็นตัวหลัก** ร่วมกับ Puripat
  - **วิธีทำ:** เทรน XGBoost หลายชุด hyperparameter (GridSearch/Optuna) evaluate ด้วย AUC/F1/Precision-Recall (คำนึงถึง class imbalance 16%) log ทุก run เข้า MLflow
  - **ผลลัพธ์ที่ต้องส่ง:** ตัดสินใจร่วมกับ Puripat เลือก run ที่ดีที่สุด promote เป็น model version ใน MLflow registry
- [ ] ตั้งค่า MLflow tracking server (ทำคนเดียว, บล็อกงานทีม — ต้องเสร็จก่อนคนอื่นเริ่ม train)
  - **วิธีทำ:** รัน MLflow server (local Docker หรือ free-tier บน DagsHub) ตั้งค่า `.env.example` แจก connection URI ให้ทีม
  - **ผลลัพธ์ที่ต้องส่ง:** MLflow URI ที่ทุกคน log ได้จริง (ทดสอบกับทีมก่อนเริ่ม wk2)

### wk4–5 (13–26 ต.ค.) — SHAP + Progress Check (Data Gate ★ wk4)
- [ ] Company-wide Aggregate Summary ร่วมกับ Nanthamon
  - **วิธีทำ:** รอผล SHAP รายบุคคลของ Yanisa/Puripat เสร็จก่อน แล้วคำนวณ `mean(|shap_value|)` แยกตามแผนก จับคู่กับ rule-based recommendation table ตาม [6.6](README.md#66-company-wide-aggregate-summary)
  - **ผลลัพธ์ที่ต้องส่ง:** module คำนวณ company summary + ตัวอย่างผลลัพธ์ (พร้อมต่อ endpoint `/company-summary`)
- [ ] เตรียม slide หัวข้อ **Modeling Results & MLflow** (2–3 แผ่น) สำหรับ Data Gate

### wk6–7 (27 ต.ค.–9 พ.ย.) — Backend & Analysis
- [ ] FastAPI endpoint หลัก: `/predict`, `/whatif` — **เป็นตัวหลัก** ร่วมกับ Puripat (Puripat ทำ `/shap`, `/recalibrate`, `/company-summary`)
  - **วิธีทำ:** สร้าง `routers/predict.py`, `routers/whatif.py` เชื่อม MLflow model + dev database กลาง เขียน Pydantic schema ตามตารางใน README หัวข้อ 7
  - **ผลลัพธ์ที่ต้องส่ง:** endpoint ทำงานได้จริง มี response ตรง schema + basic test

### wk8–9 (10–23 พ.ย.) — BI & Frontend + Closing (Model Gate ★ wk8, Product Gate buffer)
- [ ] React: **What-if Simulator** — **เป็นตัวหลัก** ร่วมกับ Puripat (Puripat ทำ SHAP viewer)
  - **วิธีทำ:** สร้างฟอร์ม/slider ปรับค่าฟีเจอร์สมมติ เรียก `POST /whatif` แบบ real-time แสดง risk_score ที่เปลี่ยนไปทันที
  - **ผลลัพธ์ที่ต้องส่ง:** component ใช้งานได้จริง เชื่อม backend แล้ว
- [ ] Integration testing ร่วมกับทั้งทีม
- [ ] เขียนรายงานส่วน **Business Logic / Financial Impact / Model Localization** สำหรับรายงานจบ
- [ ] ซ้อม demo ส่วน What-if Simulator + เตรียมตอบ Technical Defense เรื่องการเลือกโมเดล/recalibration

---

## Puripat Wongtangton (66079943)

### wk1 (22–28 ก.ย.) — Foundation & EDA
- [ ] เข้าประชุม Requirement + ตั้งสมมติฐานธุรกิจ ร่วมกับทั้งทีม
- [ ] Data cleaning ร่วมกับ Saphondanai
  - **วิธีทำ:** ทำใน notebook ของตัวเอง (`01_cleaning_P.ipynb`) เทียบผลกับ Saphondanai ก่อนรวมเป็นไฟล์เดียว
  - **ผลลัพธ์ที่ต้องส่ง:** notebook cleaning ของตัวเอง + ร่วมสรุปเป็น `clean_pipeline.py`

### wk2–3 (29 ก.ย.–12 ต.ค.) — Modeling
- [ ] Feature engineering ร่วมกับ Saphondanai (ต่อเนื่องจาก Data cleaning)
  - **ผลลัพธ์ที่ต้องส่ง:** `feature_pipeline.py` (ทำงานร่วมกับ Saphondanai)
- [ ] Train + tune model หลัก (XGBoost) — **เป็นตัวหลัก** ร่วมกับ Saphondanai
  - **วิธีทำ:** ลอง config/feature subset คนละชุดกับ Saphondanai เพื่อกระจายการค้นหา (parallel search) log เข้า MLflow เดียวกัน
  - **ผลลัพธ์ที่ต้องส่ง:** ร่วมตัดสินใจเลือก run สุดท้ายกับ Saphondanai

### wk4–5 (13–26 ต.ค.) — SHAP + Progress Check (Data Gate ★ wk4)
- [ ] SHAP integration รายบุคคล ร่วมกับ Yanisa
  - **ผลลัพธ์ที่ต้องส่ง:** module คำนวณ SHAP (ร่วมกับ Yanisa) + ตัวอย่างกราฟ
- [ ] เตรียม slide หัวข้อ **Explainability (SHAP)** (2–3 แผ่น) สำหรับ Data Gate

### wk6–7 (27 ต.ค.–9 พ.ย.) — Backend & Analysis
- [ ] FastAPI endpoint หลัก: `/shap`, `/recalibrate`, `/company-summary` — **เป็นตัวหลัก** ร่วมกับ Saphondanai
  - **วิธีทำ:** สร้าง `routers/shap.py`, `routers/recalibrate.py`, `routers/company_summary.py` ต่อกับ SHAP module (จาก wk4–5) และ company summary module (จาก Saphondanai)
  - **ผลลัพธ์ที่ต้องส่ง:** 3 endpoint ทำงานได้จริง
- [ ] ช่วย review Survival Analysis / Fairness check ของ Yanisa+Nanthamon หลังทำ endpoint หลักเสร็จ (ถ้ามีเวลาเหลือ)

### wk8–9 (10–23 พ.ย.) — BI & Frontend + Closing (Model Gate ★ wk8, Product Gate buffer)
- [ ] React: **SHAP Viewer** — **เป็นตัวหลัก** ร่วมกับ Saphondanai
  - **วิธีทำ:** render SHAP values (ข้อมูลซ้อน/nested) เป็น waterfall chart หรือ bar chart รายพนักงาน
  - **ผลลัพธ์ที่ต้องส่ง:** component ใช้งานได้จริง เชื่อม `/shap` แล้ว
- [ ] ช่วย review Superset dashboard ของ Nanthamon หลังทำ SHAP viewer เสร็จ
- [ ] Integration testing ร่วมกับทั้งทีม
- [ ] เขียนรายงานส่วน **System Architecture / Backend (API Design)** สำหรับรายงานจบ
- [ ] ซ้อม demo ส่วน SHAP Viewer + เตรียมตอบ Technical Defense เรื่อง API design

---

## Nanthamon Supo (66083478)

### wk1 (22–28 ก.ย.) — Foundation & EDA
- [ ] เข้าประชุม Requirement + ตั้งสมมติฐานธุรกิจ ร่วมกับทั้งทีม
- [ ] ทำ EDA ฝั่ง **ฟีเจอร์หมวดหมู่** (Department, JobRole, MaritalStatus, OverTime, BusinessTravel ฯลฯ) ร่วมกับ Yanisa
  - **วิธีทำ:** เทียบสัดส่วนการลาออกในแต่ละกลุ่ม (bar chart, crosstab) ต่อฟีเจอร์หมวดหมู่
  - **ผลลัพธ์ที่ต้องส่ง:** notebook EDA ฝั่งหมวดหมู่ + สรุป 3–5 bullet ว่าฟีเจอร์ไหนน่าสนใจสุด

### wk2–3 (29 ก.ย.–12 ต.ค.) — Modeling
- [ ] Train baseline model — **Random Forest** ร่วมกับ Yanisa
  - **วิธีทำ:** เทรน Random Forest เป็น baseline เปรียบเทียบ log ผลเข้า MLflow เดียวกับทีม
  - **ผลลัพธ์ที่ต้องส่ง:** MLflow run ที่ log แล้ว + สรุปเทียบกับโมเดลหลัก

### wk4–5 (13–26 ต.ค.) — SHAP + Progress Check (Data Gate ★ wk4)
- [ ] Company-wide Aggregate Summary ร่วมกับ Saphondanai
  - **ผลลัพธ์ที่ต้องส่ง:** ร่วมพัฒนา module คำนวณ company summary กับ Saphondanai
- [ ] เตรียม slide หัวข้อ **Data Gate Overview / สรุปภาพรวม** (2–3 แผ่น)

### wk6–7 (27 ต.ค.–9 พ.ย.) — Backend & Analysis
- [ ] FastAPI endpoint รอง: `/calibration-status`, `/dashboard/summary` ร่วมกับ Yanisa
  - **ผลลัพธ์ที่ต้องส่ง:** endpoint ทำงานได้จริง + ตัวอย่าง request/response
- [ ] Survival Analysis ร่วมกับ Yanisa
- [ ] Fairness check ร่วมกับ Yanisa

### wk8–9 (10–23 พ.ย.) — BI & Frontend + Closing (Model Gate ★ wk8, Product Gate buffer)
- [ ] React: **Company Summary panel** ร่วมกับ Yanisa (ทำก่อนในช่วงต้นสัปดาห์)
  - **วิธีทำ:** แสดงผลจาก `GET /company-summary` เป็น card สรุปปัจจัยเสี่ยงเด่น + คำแนะนำเชิงนโยบาย
  - **ผลลัพธ์ที่ต้องส่ง:** component ใช้งานได้จริง
- [ ] Superset dashboard + Financial Impact panel — **เป็นตัวหลัก** (Puripat ช่วย review ทีหลัง)
  - **วิธีทำ:** ต่อ Superset เข้า dev database กลาง สร้าง chart: Risk Overview, Department Deep-dive, Financial Impact, Segmentation (ทำหลังทำ React Company Summary panel เสร็จ)
  - **ผลลัพธ์ที่ต้องส่ง:** Superset dashboard ใช้งานได้จริง embed เข้า frontend ได้
- [ ] Integration testing ร่วมกับทั้งทีม
- [ ] เขียนรายงานส่วน **BI Dashboard / Company Summary** สำหรับรายงานจบ
- [ ] ซ้อม demo ส่วน Superset Dashboard + Company Summary เตรียมตอบเรื่อง Financial Impact (กฎหมายแรงงานไทย)

---

## Buffer (24 พ.ย.–7 ธ.ค.) — Final Polish + Product Gate (Week 15–16)

ทั้ง 4 คนทำร่วมกัน ไม่แยกรายบุคคลแล้ว เพราะเป็นช่วง final polish + สอบจริง:

- [ ] รวมรายงานจบจากทุกคน (EDA/Survival, Financial Impact/Localization, Backend/API, BI/Dashboard) เป็นเล่มเดียว
- [ ] ซ้อม Live Demo เต็มระบบพร้อมกันอย่างน้อย 2 รอบ
- [ ] เตรียมตอบ Technical Defense แบ่งหัวข้อตามที่แต่ละคนถนัด (อ้างอิงหัวข้อรายงานที่แต่ละคนเขียนด้านบน)
- [ ] เช็ค GitHub Repository ให้ครบตามที่รายวิชากำหนด (README, ไฟล์งาน, การแบ่งบทบาทสมาชิก — ดู [README 10.1](README.md#101-course-milestones-กำหนดการนำเสนอตามรายวิชา))
