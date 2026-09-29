# ร่างรายงาน: System Architecture / Backend (API Design) — Puripat

> **สถานะ: ร่าง** เขียนจากโค้ดที่อยู่ใน repo ณ วันที่ 30 ก.ย. 2026 (branch `dev007-NungUm`)
> ส่วนที่ยังรอทีม (database กลาง, โมเดลสุดท้าย, company summary module, endpoint ของคนอื่น) ระบุไว้ในหัวข้อ 5
> ก่อนใส่รายงานจริงต้องอัปเดตให้ตรงกับระบบตอนส่ง

## 1. ภาพรวมสถาปัตยกรรม

```
CSV (IBM HR Analytics)
   │  src/clean_pipeline.py    ตัดคอลัมน์ noise, encode target/หมวดหมู่
   │  src/feature_pipeline.py  เพิ่มฟีเจอร์ที่ผ่านการคัดเลือก 3 ตัว
   ▼
XGBoost (เทรน + tune ใน notebooks/04_tuning_P.ipynb) ──► MLflow Model Registry
                                                            │ โหลดครั้งเดียวตอนเรียกครั้งแรก
                                                            ▼
                                   FastAPI (backend/) ── SHAP TreeExplainer
                                        │  /shap  /recalibrate  /company-summary
                                        ▼
                                   React + Recharts (frontend/) ── SHAP Viewer
```

- **ขั้นเตรียมข้อมูลเป็นโค้ดชุดเดียวกันทั้งตอนเทรนและตอนให้บริการ** (`clean_data` + `add_features`) ป้องกันปัญหาฟีเจอร์ตอนเทรนกับตอนใช้งานไม่ตรงกัน (training/serving skew)
- **Backend ไม่ผูกกับโมเดลตัวใดตัวหนึ่ง** เปลี่ยนโมเดลได้ด้วย env `MODEL_URI` และ `MLFLOW_TRACKING_URI` โดยไม่แก้โค้ด
- **Frontend เรียก backend ผ่าน `/api/*`** ตอนพัฒนาใช้ proxy ของ Vite จึงยังไม่ต้องเปิด CORS ที่ backend

## 2. โครงสร้าง Backend

| ไฟล์ | หน้าที่ |
| :--- | :--- |
| `backend/main.py` | สร้าง FastAPI app และ include router ของแต่ละคน |
| `backend/model_store.py` | โหลดโมเดล, ข้อมูลพนักงาน และ SHAP explainer ครั้งเดียวแล้ว cache (`functools.lru_cache`) ใช้ร่วมทุก router |
| `backend/calibration.py` | fit/apply/save/load การปรับเทียบต่อบริษัท (tenant) |
| `backend/routers/shap.py` | `GET /shap/{employee_id}` |
| `backend/routers/recalibrate.py` | `POST /recalibrate` |
| `backend/routers/company_summary.py` | `GET /company-summary` |
| `backend/test_api.py` | test ของทั้ง 3 endpoint (`python -m pytest backend`) |

แยก router เป็นไฟล์ต่อ endpoint (FastAPI `APIRouter`) ตามแผนใน README 10.3 เพื่อให้แต่ละคนทำงานคู่ขนานได้โดยไม่แก้ไฟล์เดียวกัน

## 3. API Design (ส่วนของ Puripat)

### 3.1 `GET /shap/{employee_id}`

อธิบายว่าปัจจัยใดดันให้พนักงานคนนี้เสี่ยงลาออกมากหรือน้อย

| พารามิเตอร์ | ชนิด | คำอธิบาย |
| :--- | :--- | :--- |
| `employee_id` (path) | int | รหัสพนักงาน |
| `top_n` (query) | int 1–100, ค่าเริ่มต้น 10 | จำนวนปัจจัยที่คืน เรียงตามขนาดผลกระทบ |
| `tenant_id` (query, ไม่บังคับ) | string | ถ้าบริษัทนี้ปรับเทียบแล้ว จะคืน `calibrated_risk_score` ด้วย |

ตัวอย่าง response จริง (`/shap/1?top_n=3`):

```json
{
  "employee_id": 1,
  "risk_score": 0.713,
  "calibrated_risk_score": null,
  "warning": "ยังไม่ได้ปรับเทียบกับข้อมูลจริงของบริษัท — ใช้ SHAP (ทิศทางของปัจจัย) ประกอบการตัดสินใจมากกว่าเชื่อตัวเลขตรงๆ",
  "base_value": 0.324,
  "contributions": [
    {"feature": "WorkLifeBalance", "value": 1.0, "shap_value": 0.523},
    {"feature": "OverTime", "value": 1.0, "shap_value": 0.503},
    {"feature": "NumCompaniesWorked", "value": 8.0, "shap_value": 0.498}
  ]
}
```

- `shap_value` อยู่ในหน่วย log-odds ค่าบวกดันไปทางลาออก ค่าลบดันไปทางอยู่ต่อ
- Error: `404` ไม่พบพนักงาน, `422` `tenant_id` ผิดรูปแบบ

### 3.2 `POST /recalibrate`

ปรับเทียบคะแนนของโมเดลกลางให้เข้ากับข้อมูลลาออกจริงของบริษัทไทยแต่ละแห่ง (README 6.5) **โดยไม่ retrain โมเดล**

Request body:

| ฟิลด์ | ชนิด | คำอธิบาย |
| :--- | :--- | :--- |
| `tenant_id` | string (`A-Z a-z 0-9 _ -` ไม่เกิน 64 ตัว) | รหัสบริษัท |
| `method` | `"platt"` หรือ `"isotonic"` (ค่าเริ่มต้น) | วิธีปรับเทียบ |
| `records` | list ของพนักงาน อย่างน้อย 50 แถว | คอลัมน์เดียวกับ CSV ของ IBM รวม `Attrition` = `"Yes"`/`"No"` |

Response: `tenant_id`, `method`, `n_samples`, `positive_rate`, `brier_before`, `brier_after`, `calibrated_at`

การตรวจข้อมูลก่อนรับ (ตอบ `422` พร้อมข้อความภาษาไทย):
- คอลัมน์ต้องครบ
- `Attrition` ต้องเป็น Yes/No
- ต้องมีทั้งคนลาออกและไม่ลาออก
- `tenant_id` ถูกจำกัดรูปแบบ เพราะใช้เป็นชื่อไฟล์ จึงกัน path traversal ได้

เหตุผลที่เลือก Platt/isotonic: ลำดับความเสี่ยง (ranking) และ SHAP ยังมาจาก pattern ของ IBM dataset แต่ตัวเลขความเสี่ยงจะเข้ากับอัตราลาออกจริงของบริษัทนั้น ใช้ข้อมูลน้อยกว่าการเทรนใหม่มาก

### 3.3 `GET /company-summary`

สรุปปัจจัยเสี่ยงเด่นทั้งบริษัทหรือรายแผนก (README 6.6)

| พารามิเตอร์ | คำอธิบาย |
| :--- | :--- |
| `department` (ไม่บังคับ) | กรองตามแผนก เช่น `Sales` (ไม่พบตอบ `404` พร้อมรายชื่อแผนกที่มี) |
| `top_n` | จำนวนปัจจัย ค่าเริ่มต้น 5 |

Response: `n_employees`, `mean_risk_score`, `top_factors[]` (`feature`, `mean_abs_shap`, `recommendation`) และ `note` ที่เตือนว่า SHAP ไม่ใช่เหตุและผล คำแนะนำใช้ถ้อยคำเชิงทิศทาง ("น่าจะช่วยลดความเสี่ยง")

## 4. การตัดสินใจเชิงออกแบบ

1. **โหลดโมเดลและ explainer ครั้งเดียว:** การโหลดจาก MLflow และสร้าง TreeExplainer ช้า จึง cache ไว้ใน process ทำให้แต่ละ request คำนวณเฉพาะแถวที่ขอ
2. **one-hot ให้คอลัมน์ครบเสมอ:** ข้อมูลที่บริษัทอัปโหลดอาจมีหมวดไม่ครบ (เช่น ไม่มีแผนก HR) จึงต่อข้อมูลอ้างอิงก่อน encode แล้วตัดออก ได้คอลัมน์ตรงกับตอนเทรนทุกครั้ง
3. **ความโปร่งใส:** ทุก response ที่มีคะแนนแต่ยังไม่ได้ปรับเทียบจะมี `warning` และ response สรุปภาพรวมมี `note` เรื่องเหตุและผล ตาม README 6.5–6.6
4. **Frontend แสดงระดับ ต่ำ/ปานกลาง/สูง แทนเปอร์เซ็นต์:** โมเดลเทรนด้วย `scale_pos_weight` คะแนนจึงไม่ใช่ความน่าจะเป็นจริง ค่ารหัสต่าง ๆ (เช่น OverTime = 1) แปลงเป็นคำก่อนแสดง

## 5. ข้อจำกัดและสิ่งที่ยังค้าง

| เรื่อง | ตอนนี้ | เป้าหมาย |
| :--- | :--- | :--- |
| ข้อมูลพนักงาน | อ่านจาก CSV | dev database กลาง (Supabase/Neon) |
| ผลปรับเทียบ | ไฟล์ JSON ใน `backend/calibrations/` | ตาราง `tenant_calibrations` (ให้ `/calibration-status` อ่าน) |
| โมเดล | ตัวทดลองใน MLflow ในเครื่อง | โมเดลที่ทีมเลือกและ promote บน MLflow กลาง |
| `/company-summary` | ใช้ mean \|SHAP\| + ตารางคำแนะนำชั่วคราว, คำนวณสดทุกครั้ง | module ของ Saphondanai + Nanthamon, cache ใน `company_risk_summary`, รวม financial impact |
| Authentication | ยังไม่มี | ต้องมีก่อนเปิดให้คนนอกใช้ (ข้อมูลพนักงานเป็นข้อมูลอ่อนไหว) |
| CORS / deploy | ใช้ proxy ของ Vite ตอนพัฒนา | ตั้ง CORS หรือ reverse proxy ตอน deploy (Docker Compose + Render) |
| Endpoint อื่น | `/predict`, `/whatif` (Saphondanai), `/health`, `/interventions` (Yanisa), `/calibration-status`, `/dashboard/summary` (Nanthamon) | include เข้า `backend/main.py` |

## 6. การทดสอบ

- `python -m pytest backend`: 4 test ครอบคลุมกรณีปกติ, พนักงานไม่พบ, ปรับเทียบทั้งสองวิธีแล้ว `/shap` ใช้ผลปรับเทียบ, และข้อมูลไม่ถูกต้อง 5 แบบ (รวม `tenant_id` แบบ `../x`)
- Frontend ทดสอบด้วยการเปิดหน้าจริงในเบราว์เซอร์ headless ทั้งจอกว้างและจอมือถือ (390px)
- ยังไม่มี integration test ร่วมกับ endpoint ของคนอื่น (เป็นงานร่วมทั้งทีมใน wk8–9)
