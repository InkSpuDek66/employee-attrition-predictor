# รายงานตรวจโปรเจกต์ มุมมอง Data Engineering

| หัวข้อ | รายละเอียด |
| :--- | :--- |
| วันที่ตรวจ | 1 ต.ค. 2026 (ทีมอยู่ wk2 ช่วง Modeling) |
| รอบการตรวจ | รอบ 1 อ่านโค้ดและรันสคริปต์ตรวจ · รอบ 2 (วันเดียวกัน) ตรวจเพิ่มตามข้อจำกัดของรอบ 1: ผล CI + pytest, notebook 05–07, รายงานร่างใน `docs/`, fairness เบื้องต้น |
| เวอร์ชันที่ตรวจ | commit `45f926a` บน `main` (ตรงกับ `dev001-Ink` ณ วันตรวจ) รอบ 2 ตรวจ notebook 07 และรายงานร่างจาก commit `fc4a969` ที่ตามมา (commit นี้ไม่ได้แก้โค้ดใน `src/` `backend/` `frontend/`) |
| ผู้ตรวจ | Claude Code (AI, Claude Opus 5.5) รับบท senior data engineer ตามคำขอของ Saphondanai |
| ผู้ดูแลเอกสาร | Saphondanai (ถามหรือแย้งได้ที่ Saphondanai) |
| สถานะ | รอทีมยืนยันผู้รับผิดชอบและกำหนดเสร็จ |
| เอกสารชุดเดียวกัน | Data Engineering (ไฟล์นี้) · [Security](round1-2_security_S.md) · [UX/UI](round1-2_ux_ui_S.md) |

**วิธีใช้เอกสารนี้**

1. อ่าน [1. สรุป](#1-สรุป) ก่อน (2 นาที)
2. หาชื่อตัวเองใน [7. งานแยกรายคน](#7-งานแยกรายคน) แล้วกดลิงก์ไปอ่านรายละเอียดของข้อนั้นใน [4](#4-รายการที่ต้องแก้)–[6](#6-เรื่องเล็ก--เก็บงาน)
3. แก้เสร็จแล้วให้ติ๊ก checkbox ในหัวข้อ 7 พร้อมใส่ commit hash
4. ถ้าไม่เห็นด้วยกับข้อไหน ให้เขียนเหตุผลไว้ใน [8. ความเห็นทีม](#8-ความเห็นทีม) แล้ว commit ไม่ต้องแก้เนื้อหาของข้อนั้นเอง

> ผู้รับผิดชอบที่ระบุในเอกสารนี้เป็นข้อเสนอ อ้างอิงจาก [TASKS.md](../../TASKS.md) และผู้เขียนไฟล์ใน git log ทีมต้องยืนยันกันอีกครั้งก่อนเริ่มแก้
> บัญชี git ที่ใช้อ้างอิง: `Ink-SPU` = Saphondanai, `NungUmSudNaRak` (commit ขึ้นต้น Dev007) = Puripat (อนุมานจาก commit ที่ตรงกับงานของ Puripat ใน TASKS.md)

---

## 1. สรุป

สำหรับงานระดับนักศึกษา ฝั่งโมเดลกับ API ทำมาดีกว่าที่เห็นทั่วไป แต่ถ้ามองแบบ data engineer ระบบยังเน้นโมเดลเป็นหลัก ส่วนชั้นข้อมูลยังบาง ได้แก่ นิยามหน่วยข้อมูล ที่เก็บข้อมูล การทำ version และ batch pipeline

ข้อที่ร้ายแรงที่สุดคือมี 2 จุดที่ข้อมูลผิดแล้วระบบไม่ error แต่ให้คำตอบผิดเงียบ ๆ (DE-01, DE-02) ทั้งสองจุดอยู่ในเรื่อง Model Localization ซึ่งเป็นฟีเจอร์หลักที่โปรเจกต์นำเสนอ จึงน่าจะโดนถามตอน Defense

รอบ 2 พบเพิ่ม 3 ข้อ:
- **DE-08:** เทรนด้วยโค้ดและ seed เดียวกัน แต่ได้โมเดลไม่เหมือนกันเมื่อเปลี่ยนเครื่องหรือจำนวน thread (AUC 0.805–0.815) เอกสารที่บอกว่า "ผลเหมือนเดิมเพราะใช้ seed คงที่" จึงไม่จริง
- **DE-09:** รายงานร่างและเอกสารมีตัวเลขหรือข้อความที่ไม่ตรงกับของจริงหลายจุด
- **DS-04:** fairness เบื้องต้นพบว่าโมเดลจับคนลาออกกลุ่มอายุ 40 ขึ้นไปได้ไม่ถึงครึ่ง ขณะที่กลุ่มอายุน้อยจับได้ 79%

ส่วนที่ดีคือ CI ผ่านครบทุก step และ notebook 05–07 มีระเบียบวิธีที่ดี: ไม่มี leakage, ใช้ test ครั้งเดียว และตรวจความลำเอียงของตัวเองด้วย nested CV

| ID | ระดับ | เรื่อง | ผู้รับผิดชอบ (เสนอ) | เสนอให้เสร็จ |
| :--- | :--- | :--- | :--- | :--- |
| [DE-01](#de-01-หน่วยเงินเดือนไม่มีนิยามกลาง) | สูง | หน่วยเงินเดือนไม่มีนิยามกลาง ถ้าอัปโหลดเป็นบาท โมเดลจะไม่เห็นผลของเงินเดือนเลย | Saphondanai (หลัก), Puripat | ก่อน Data Gate (wk4) |
| [DE-02](#de-02-recalibrate-รับข้อมูลเสียโดยไม่-error) | สูง | `/recalibrate` รับค่าหมวดหมู่ผิดแล้วไม่ error คะแนนเพี้ยน | Puripat (หลัก), Saphondanai review | ก่อน Data Gate (wk4) |
| [DE-03](#de-03-ขั้นเตรียมข้อมูลไม่ได้ถูก-version-ไปกับโมเดล) | สูง | ขั้นเตรียมข้อมูลไม่ได้ถูก version ไปพร้อมโมเดล | Saphondanai (หลัก), Puripat | ก่อนเริ่ม wk6 |
| [DE-04](#de-04-ยังไม่มี-data-layer-และ-batch-scoring-ที่-superset-ต้องใช้) | กลาง | ยังไม่มี data layer และ batch scoring ที่ Superset ต้องใช้ | ทั้งทีมตัดสินใจ แล้ว Saphondanai + Puripat ทำ | ตัดสินใจก่อนจบ wk3 (12 ต.ค.) |
| [DE-05](#de-05-dependency-ไม่ได้-pin-เวอร์ชัน) | กลาง | Dependency ไม่ได้ pin เวอร์ชัน | Saphondanai | ก่อน Data Gate (wk4) |
| [DE-06](#de-06-ไฟล์-dataprocessed-ไม่มีใครใช้-และติดตามที่มาของข้อมูลไม่ได้) | กลาง | ไฟล์ `data/processed/` ไม่มีใครใช้ และติดตามที่มาของข้อมูลไม่ได้ | Puripat + Saphondanai | ก่อนเริ่ม wk6 |
| [DE-07](#de-07-ตัวเลขใน-demo-ดูดีเกินจริง-in-sample-และ-auc-ไม่มีช่วงความเชื่อมั่น) | กลาง | ตัวเลขใน demo ดูดีเกินจริง และ AUC ไม่มีช่วงความเชื่อมั่น | Saphondanai + Puripat | ก่อน Data Gate (wk4) |
| [DE-08](#de-08-เทรนซ้ำด้วยโค้ดและ-seed-เดียวกัน-แต่ได้โมเดลไม่เหมือนกัน) (รอบ 2) | กลาง | เทรนซ้ำด้วยโค้ดและ seed เดียวกัน แต่ได้โมเดลไม่เหมือนกัน | Saphondanai | ก่อน Data Gate (wk4) |
| [DE-09](#de-09-รายงานร่างและเอกสารมีตัวเลขหรือข้อความที่ไม่ตรงกับของจริง) (รอบ 2) | กลาง | รายงานร่างและเอกสารมีตัวเลขหรือข้อความที่ไม่ตรงกับของจริง | เจ้าของแต่ละไฟล์ (Saphondanai, Puripat) | ก่อน Data Gate (wk4) |
| [DS-01](#ds-01-ข้อมูลไม่มีมิติเวลา-point-in-time) | ต่ำ | ข้อมูลไม่มีมิติเวลา (point-in-time) | Yanisa + Nanthamon, ทีมรีวิว data model | ใส่รายงานก่อน Model Gate (wk8) |
| [DS-02](#ds-02-feedback-loop-ของขั้น-measure) | ต่ำ | Feedback loop ของขั้น Measure | Yanisa + Nanthamon | ใส่ใน schema `/interventions` |
| [DS-03](#ds-03-pdpa-fairness-และความปลอดภัย) | ต่ำ | PDPA, Fairness และความปลอดภัย | Yanisa + Nanthamon, Saphondanai, Puripat | ก่อน Model Gate (wk8) |
| [DS-04](#ds-04-fairness-เบื้องต้น-โมเดลจับคนลาออกกลุ่มอายุมากและแต่งงานแล้วได้น้อยกว่ามาก) (รอบ 2) | กลาง | Fairness เบื้องต้น: โมเดลจับคนลาออกกลุ่มอายุมากและแต่งงานแล้วได้น้อยกว่ามาก | Yanisa + Nanthamon (หลัก), Saphondanai + Puripat | ก่อน Model Gate (wk8) |
| [H-01 – H-07](#6-เรื่องเล็ก--เก็บงาน) | เก็บงาน | เรื่องเล็ก / เก็บงาน | ตามตาราง | ถ้ามีเวลา |

**ระดับความรุนแรง**
- สูง: ผลลัพธ์ผิดโดยไม่มี error หรือโดนถามตอน Defense แน่นอน
- กลาง: ต้องมีก่อนเข้า Backend phase / BI
- ต่ำ: เป็นเรื่องการออกแบบ ใส่ในรายงานและเตรียมตอบ ไม่ต้องแก้โค้ดทันที
- เก็บงาน: เก็บงานให้เรียบร้อย

---

## 2. ขอบเขตและขั้นตอนการตรวจ

### ขั้นตอนที่ทำ

1. เก็บบริบท: อ่าน [README.md](../../README.md) (สถาปัตยกรรม, data model, business rules), [TASKS.md](../../TASKS.md) (ใครทำอะไร) และ `git log` (ใครเขียนไฟล์ไหน)
2. อ่านโค้ดตลอดเส้นทาง ข้อมูล → โมเดล → API: ทุกไฟล์ใน `src/`, `backend/`, `backend/routers/`, `config/`, `docker-compose.yml`, `docker/`, `.github/workflows/ci.yml`, `requirements.txt`, `.env.example`, `.gitignore`
3. ตรวจ notebook เฉพาะจุด: ดูใน `04_tuning_P.ipynb` และ `04_tuning_S.ipynb` ว่า Optuna ประเมินผลด้วยข้อมูลชุดไหน (เช็ก leakage จาก test set)
4. ดู frontend เฉพาะจุดที่เกี่ยวกับข้อมูล: คือการเรียก API และหน่วยของเงินเดือนใน `WhatIfSimulator.jsx` กับหน้า Streamlit
5. รันสคริปต์ตรวจในเครื่อง (`.venv`) โดยเทรนโมเดลซ้ำตามสูตรใน [src/train.py](../../src/train.py) ได้ test AUC 0.814 ตรงกับ `attrition-xgboost-P` v1 บน DagsHub (รอบ 2 โหลด v1 มาเทียบแล้ว คะแนนตรงกันทุกแถว ต่างกัน 0.0 ตัวเลขทุกตัวในรายงานนี้จึงเป็นของ v1 จริง) จากนั้นวัด:
   - ช่วงความเชื่อมั่นของ AUC (bootstrap 10,000 รอบ)
   - คะแนนแบบ in-sample เทียบกับ out-of-fold
   - ผลเมื่อเงินเดือนเป็นหน่วยบาท
   - ผลเมื่อค่าหมวดหมู่สะกดผิด
   - รายชื่อฟีเจอร์ที่โมเดลใช้จริง

   สคริปต์นี้ไม่ได้ log อะไรขึ้น MLflow/DagsHub ดูโค้ดและวิธีรันซ้ำได้ที่ [ภาคผนวก](#ภาคผนวก-สคริปต์ตรวจซ้ำ)
6. จัดระดับและระบุผู้รับผิดชอบ: อิงจาก TASKS.md และผู้เขียนไฟล์

**รอบ 2: ตรวจเพิ่มตามข้อจำกัดของรอบ 1**

7. **CI และ test:**
   - ดูผล CI บน GitHub ของ commit `45f926a` ด้วย `gh run view` (ทุก step และ log)
   - รัน `ruff check .` และ `python -m pytest backend` ในเครื่อง (pytest โหลด v1 จาก DagsHub แบบอ่านอย่างเดียว)
   - เทียบเวอร์ชันแพ็กเกจของ CI กับ `.venv`
   - ทดลองเทรนซ้ำด้วย `n_jobs` 1, 2, 4, 8
   - โหลด v1 จาก DagsHub มาเทียบกับโมเดลที่เทรนซ้ำทีละแถว
8. notebook 05–07: อ่าน code cell ทั้งหมดของ `05_model_comparison_S`, `05_shap_P`, `06_param_sweep_S`, `07_imbalance_S` ตรวจ:
   - leakage (resample หรือเลือก threshold ด้วยข้อมูลที่ใช้วัดผลหรือไม่)
   - การใช้ test set, seed และแหล่งข้อมูล/โมเดลที่ notebook พึ่ง
9. รายงานร่างใน `docs/`: เทียบตัวเลขและข้อความใน `report_business_logic_draft_S.md`, `report_backend_draft_P.md`, `dataset.md`, `mlflow_setup.md` กับข้อมูล โค้ด และโมเดล v1 จริง
10. fairness เบื้องต้น: ด้วย pandas/scikit-learn (ไม่ได้ติดตั้ง Fairlearn) บนคะแนน out-of-fold 5-fold ของทั้ง 1,470 คน แยกตามเพศ ช่วงอายุ และสถานภาพสมรส แล้วทดลองสลับค่าเพศ (counterfactual) ([ภาคผนวก รอบ 2](#ภาคผนวก-รอบ-2))

### สิ่งที่ยังไม่ได้ตรวจ (ข้อจำกัดของรายงานนี้)

| ข้อจำกัดของรอบ 1 | สถานะหลังรอบ 2 |
| :--- | :--- |
| ไม่ได้รัน pytest หรือ CI และไม่ได้เปิด docker compose | เสร็จ: CI บน GitHub ผ่านทุก step ที่ `45f926a`, ในเครื่อง ruff ผ่าน และ pytest ผ่าน 17 test (ที่ `fc4a969`) · ค้าง: ไม่ได้เปิด docker compose ในเครื่องเอง เพราะ CI ทำขั้นนี้ให้ทุกครั้งแล้ว (step "Start PostgreSQL + MLflow" ผ่าน) |
| ไม่ได้อ่าน notebook อื่นนอกจาก 04 | เสร็จ: อ่าน 05, 05_shap_P, 06, 07 แล้ว · ค้าง: ยังไม่ได้อ่าน 01–03 (cleaning และการทดลองแรก ซึ่งถูกรวมเป็น `src/clean_pipeline.py` แล้ว) |
| ไม่ได้ตรวจ UI/UX | เสร็จ: อยู่ใน[รายงาน UX/UI](round1-2_ux_ui_S.md) |
| ไม่ได้ตรวจรายงานร่างใน `docs/` | เสร็จ: ตรวจแล้ว ผลอยู่ใน DE-09 · ค้าง: ไม่ได้ตรวจสำนวนภาษาหรือโครงของรายงาน ตรวจเฉพาะความถูกต้องของตัวเลขและข้อความทางเทคนิค |
| ไม่ได้ทำ security review / fairness metric | เสร็จ: security อยู่ใน[รายงาน Security](round1-2_security_S.md) · เสร็จ: fairness เบื้องต้น อยู่ใน DS-04 · ค้าง: ยังไม่ใช่ Fairness check เต็มรูปแบบตาม README 6.4 (ยังไม่ได้ใช้ Fairlearn, ยังไม่ได้ตั้งเกณฑ์ที่ยอมรับได้ และยังไม่ได้ลองวิธีลดความลำเอียง) ซึ่งเป็นงานของ Yanisa + Nanthamon ใน TASKS.md |

---

## 3. จุดที่ทำได้ดี (ควรรักษาไว้)

- Tune โดยไม่แตะ test set: Optuna ใช้ CV บน train เท่านั้น ([04_tuning_S.ipynb](../../notebooks/04_tuning_S.ipynb)) จึงไม่มี leakage จากขั้น tuning
- ตัวเลขธุรกิจแยกออกจากโค้ด: อยู่ใน [config/financial_impact.json](../../config/financial_impact.json) แก้ตามกฎหมายได้โดยไม่ต้อง retrain
- ตรวจ input ที่ขอบระบบ: `/predict` และ `/whatif` ใช้ Pydantic `Literal` กับ `extra="forbid"` ค่าผิดจะได้ 422 ทันที ([backend/schemas.py](../../backend/schemas.py))
- pipeline รันได้ครบตั้งแต่ต้นจนจบ: CI เทรนโมเดลใหม่จากข้อมูลดิบทุกครั้ง ([ci.yml](../../.github/workflows/ci.yml)) รอบ 2 ยืนยันว่า run ของ `45f926a` ผ่านทุก step (ruff → docker compose → train.py → pytest 17 test → lint/build frontend) แต่โมเดลที่ได้ไม่ได้เหมือนกันทุกเครื่อง (ดู DE-08)
- **ระเบียบวิธีใน notebook 05–07 ดี (ตรวจรอบ 2):**
  - resample เฉพาะ fold ที่ใช้เทรน ([07_imbalance_S.ipynb](../../notebooks/07_imbalance_S.ipynb)) จึงไม่มี leakage แบบ SMOTE ก่อนแบ่งข้อมูล
  - threshold ตรึงจาก OOF ของ train แล้วใช้ test ครั้งเดียว
  - notebook 06 ตรวจความลำเอียงของตัวเองด้วย nested threshold และเลือกค่าด้วยกฎ 1-SE
  - การสาธิต calibration ใน 07 ใช้ OOF ภายใน fold ซึ่งถูกต้อง
- ความโปร่งใส: มีคำเตือนตอนยังไม่ recalibrate และเขียนชัดว่า "SHAP ไม่ใช่เหตุและผล"
- ความปลอดภัยพื้นฐาน: กัน path traversal ของ `tenant_id`, docker-compose bind ที่ `127.0.0.1`, แยก database ของ MLflow ออกจากของแอป

---

## 4. รายการที่ต้องแก้

ทุกข้อใช้โครงเดียวกัน: ปัญหา → หลักฐาน → ทำไมต้องแก้ → วิธีแก้ → เสร็จเมื่อ → ผู้รับผิดชอบ

### DE-01 หน่วยเงินเดือนไม่มีนิยามกลาง

ระดับ: สูง

**ปัญหา:** `MonthlyIncome` ตัวเดียวกันถูกตีความ 3 แบบ และไม่มีที่ไหนแปลงหน่วยก่อนส่งเข้าโมเดล

| ที่ | ตีความว่า |
| :--- | :--- |
| [config/financial_impact.json:3](../../config/financial_impact.json#L3) | "ไม่ได้ระบุสกุลเงิน ไม่ใช่บาท" และถ้าเป็นข้อมูลบริษัทไทย "ตัวเลขจะเป็นบาทตามข้อมูลที่อัปโหลด" |
| [src/app_pages/whatif_page.py:6](../../src/app_pages/whatif_page.py#L6) (Streamlit ทดสอบ) | เป็นดอลลาร์ แปลงด้วย 35 บาท/ดอลลาร์ |
| [frontend/src/WhatIfSimulator.jsx:7](../../frontend/src/WhatIfSimulator.jsx#L7) (React) | slider 1,000–20,000 ไม่มีหน่วย |
| `/predict`, `/whatif`, `/recalibrate` | รับค่าไปใช้ตรง ๆ ไม่แปลง |

**หลักฐาน (รันจริง):**
- เงินเดือนใน IBM อยู่ในช่วง 1,009–19,999 และจุดตัดสูงสุดที่โมเดลใช้กับ `MonthlyIncome` คือ 17,465 (จาก 126 จุดตัดในทุก tree)
- ถ้าบริษัทอัปโหลดเป็นบาท (ค่าเท่าเดิม × 35) ข้อมูล 100% จะเกินค่าสูงสุดที่โมเดลเคยเห็น
- เงินเดือนทุกค่าที่ ≥ 17,465 ให้ผลต่อโมเดล เท่ากันหมด ดังนั้นถ้าข้อมูลเป็นบาท การจำลอง "ขึ้นเงินเดือน" ใน `/whatif` จะได้ `delta = 0` เสมอ
- test AUC ลดจาก 0.814 เหลือ 0.796 เพราะสัญญาณเรื่องรายได้หายไป

**ทำไมต้องแก้:**
- นี่คือ training-serving skew คือข้อมูลตอนใช้งานจริงมีหน่วยหรือรูปแบบต่างจากตอนเทรน โมเดลไม่ error แต่ตอบผิด
- `/recalibrate` (Platt/isotonic) แก้ปัญหานี้ไม่ได้ เพราะมันแค่ปรับคะแนนที่ออกมาแล้วโดยรักษาลำดับเดิม ไม่ได้ย้อนไปแก้ input ที่หน่วยผิด
- เรื่องนี้ชนกับ README 6.5 Model Localization ตรง ๆ ซึ่งเป็นฟีเจอร์หลักที่โปรเจกต์นำเสนอ

**วิธีแก้:**
1. ตกลงหน่วยไว้ที่เดียว: เขียนใน [docs/dataset.md](../dataset.md) (data dictionary) ว่าโมเดลรับ `MonthlyIncome` ในหน่วย IBM (สมมติเป็น USD)
2. ย้ายอัตราแลกเปลี่ยนเข้า config: เช่น `"income": {"model_unit": "USD", "thb_per_usd": 35}` ใน `config/financial_impact.json`
3. แปลงหน่วยครั้งเดียวที่ขอบระบบ (API): ให้ API รับเงินเดือนเป็นบาท แล้วแปลงก่อนเข้าโมเดล หน้าจอทุกหน้า (React, Streamlit) และ `/recalibrate` ใช้ค่าจาก config ตัวเดียวกัน ห้ามมีตัวเลข 35 กระจายหลายที่
4. เช็กช่วงค่า (range guard): ถ้าค่าอยู่นอกช่วงที่โมเดลเคยเห็นตอนเทรน ให้ใส่ `warning` ใน response ไม่ต้อง reject
5. เพิ่ม test: ส่งเงินเดือนเกินช่วงแล้วต้องได้ warning และขึ้นเงินเดือนแล้ว `delta` ต้องไม่เป็น 0

**เสร็จเมื่อ:** ทุกหน้าจอและทุก endpoint อ่านหน่วยจาก config ที่เดียว มี warning เมื่อค่าอยู่นอกช่วง และ test ผ่าน

**ผู้รับผิดชอบ:**
- Saphondanai (หลัก): ดูแล config, `business_rules`, `schemas.py`, React What-if และรายงานส่วน Localization
- Puripat: ปรับหน้า Streamlit `whatif_page.py` และ `/recalibrate` ให้ใช้ค่ากลาง
- ทั้งทีม: ตกลงหน่วยในข้อ 1

---

### DE-02 `/recalibrate` รับข้อมูลเสียโดยไม่ error

ระดับ: สูง

**ปัญหา:** [backend/routers/recalibrate.py:21](../../backend/routers/recalibrate.py#L21) รับ `records: list[dict]` แล้วเช็กแค่ว่ามีคอลัมน์ครบและ `Attrition` เป็น Yes/No ไม่ได้ตรวจค่าทีละแถวเหมือน `/predict`

**หลักฐาน (รันจริง ผ่าน `clean_data` → `add_features` → โมเดล แบบเดียวกับที่ endpoint ทำ):**

| ข้อมูลที่ส่ง | สิ่งที่เกิดขึ้น | คะแนนเดิม → คะแนนใหม่ |
| :--- | :--- | :--- |
| `BusinessTravel = "Travel_Sometimes"` (สะกดผิด) | กลายเป็น `NaN` XGBoost มองว่าเป็น missing value | 0.663 → 0.866 |
| `Department = "Sales "` (มีเว้นวรรคท้าย) | one-hot ของแผนกเป็น 0 ทั้งแถว | 0.066 → 0.093 |

ไม่มี error หรือ warning เลย

**ทำไมต้องแก้:**
- calibration จะถูก fit บนคะแนนที่เพี้ยน แล้วถูกใช้กับ ทุกคำทำนายของบริษัทนั้น ต่อไปเรื่อย ๆ
- ข้อมูล HR จริงที่ export มาจาก Excel มีเว้นวรรคหรือสะกดต่างกันเป็นเรื่องปกติ
- หลักของ DE คือ fail loud at the boundary: ข้อมูลผิดต้องถูกปฏิเสธพร้อมบอกเหตุผลตั้งแต่ตอนเข้าระบบ ไม่ใช่ปล่อยให้ไปพังเงียบ ๆ ข้างใน

**วิธีแก้:**
1. เพิ่ม schema สำหรับข้อมูลที่มี label ใน [backend/schemas.py](../../backend/schemas.py) โดยต่อยอดจาก `EmployeeInput` ตัวเดิม
   ```python
   class LabeledEmployee(EmployeeInput):
       # CSV ของ IBM มีคอลัมน์ noise (EmployeeNumber, Over18 ฯลฯ) ติดมาด้วย จึงไม่ใช้ extra="forbid" ตรงนี้
       model_config = ConfigDict(extra="ignore")
       Attrition: Literal["Yes", "No"]
   ```
2. ใน `recalibrate.py` เปลี่ยนเป็น `records: list[LabeledEmployee] = Field(min_length=MIN_ROWS)` แล้วสร้าง DataFrame ด้วย `pd.DataFrame([r.model_dump() for r in req.records])` จากนั้นลบโค้ดเช็กคอลัมน์และเช็ก Attrition แบบเขียนเอง เพราะ Pydantic ทำให้แล้ว และจะบอกได้ด้วยว่าผิดที่แถวไหน ฟิลด์ไหน
3. เพิ่ม test ใน [backend/test_api.py](../../backend/test_api.py) ว่าค่าหมวดหมู่ที่สะกดผิดหรือมีเว้นวรรคเกินต้องได้ 422

> ถ้าอยากให้ระบบตัดเว้นวรรคให้เองแทนการปฏิเสธ ต้องเขียน `field_validator(..., mode="before")` ที่ strip string ก่อน เพราะ `str_strip_whitespace` ของ Pydantic ไม่มีผลกับฟิลด์ `Literal` (ทดสอบกับ Pydantic 2.13.5 แล้ว)

**เสร็จเมื่อ:** ส่งค่าหมวดหมู่ที่โมเดลไม่รู้จักแล้วได้ 422 ที่ระบุแถวและฟิลด์ และ test เดิมยังผ่าน

**ผู้รับผิดชอบ:** Puripat (หลัก) เพราะเป็นเจ้าของ `/recalibrate` และ Saphondanai review เพราะเป็นเจ้าของ `schemas.py`

---

### DE-03 ขั้นเตรียมข้อมูลไม่ได้ถูก version ไปกับโมเดล

ระดับ: สูง

**ปัญหา:**
- MLflow เก็บแค่ `XGBClassifier` เปล่า ๆ ([src/train.py:43](../../src/train.py#L43))
- ตอนเสิร์ฟ [backend/model_store.py:50-57](../../backend/model_store.py#L50-L57) import `clean_data`/`add_features` จากโค้ด ปัจจุบัน ใน `src/` และต้องต่อ CSV ทั้ง 1,470 แถวเข้าไปทุก request เพื่อให้ one-hot ได้คอลัมน์ครบ
- `MODEL_URI` ถูก hardcode เป็น `/1` อยู่ 3 ที่: [model_store.py:23](../../backend/model_store.py#L23), [shap_explain.py:22](../../src/shap_explain.py#L22) และ [ci.yml](../../.github/workflows/ci.yml)

**ทำไมต้องแก้:**
- เกิด training-serving skew ได้ง่าย: ถ้าใครแก้สูตรใน `feature_pipeline.py` (เช่น `AvgSatisfaction`) ชื่อคอลัมน์ยังเหมือนเดิม โมเดล v1 จะได้ค่าคนละความหมายกับตอนเทรนโดยไม่มี error
- ย้อนกลับไปใช้โมเดลเก่าไม่ได้จริง: เพราะโค้ดเตรียมข้อมูลไม่ได้ย้อนตาม
- ฝั่งเสิร์ฟต้องพึ่งไฟล์ training data เสมอ: และยิ่งข้อมูลมาก request ยิ่งช้า
- เปลี่ยนโมเดลต้องแก้โค้ดถึง 3 ที่

**วิธีแก้ (เลือก A หรือ B):**
- A. เปลี่ยนน้อย (แนะนำสำหรับกรอบเวลานี้)
  1. ตอนเทรน ให้ log "feature spec" เป็น artifact คู่กับโมเดล ได้แก่ รายการ category ของแต่ละคอลัมน์ nominal, รายชื่อคอลัมน์สุดท้ายตามลำดับ และ tag `git_commit` กับ sha256 ของ raw CSV
  2. ตอนเสิร์ฟ ใช้ spec นี้ทำ one-hot ด้วย `pd.Categorical(..., categories=spec[col])` แทนการต่อ CSV
- B. มาตรฐานกว่า (งานเยอะกว่า)
  1. ห่อเป็น sklearn `Pipeline(ColumnTransformer(OneHotEncoder(...)), XGBClassifier)` หรือ `mlflow.pyfunc`
  2. SHAP ยังใช้ `TreeExplainer(pipe[-1])` กับ `pipe[:-1].transform(X)` ได้ แต่ชื่อคอลัมน์จะเปลี่ยน จึงต้องแก้ `company_summary.feature_group` ด้วย
  3. ข้อควรระวัง: ทางนี้เก็บโมเดลด้วย cloudpickle ซึ่งตอนโหลดรันโค้ดที่ฝังในไฟล์ได้ ถ้ามีคน register โมเดลอันตรายเข้า registry ก็จะรันโค้ดบน backend ได้ ดู [SEC-05 ในรายงาน Security](round1-2_security_S.md#sec-05-ความเสี่ยงจากไฟล์โมเดล-model-supply-chain) ซึ่งเป็นอีกเหตุผลที่แนะนำทางเลือก A
- ทั้งสองทาง: ให้ใช้ alias ของ MLflow แทนเลข version ตายตัว: `MlflowClient().set_registered_model_alias("attrition-xgboost-P", "champion", <version>)` แล้วตั้ง `MODEL_URI=models:/attrition-xgboost-P@champion` ต่อไปจะเปลี่ยนโมเดลได้โดยไม่ต้องแก้โค้ดหรือ CI

> การเปลี่ยนขั้นเตรียมข้อมูลต้อง register โมเดล version ใหม่ ควรทำพร้อม DE-01 จะได้ register รอบเดียว

**เสร็จเมื่อ:**
- backend โหลดโมเดลผ่าน alias
- ฝั่งเสิร์ฟไม่ต้องอ่าน CSV เพื่อทำ one-hot
- MLflow run มี tag ของ commit และ hash ของข้อมูล

**ผู้รับผิดชอบ:** Saphondanai (หลัก) ดูแล `train.py`, `mlflow_setup.py`, CI และ Puripat ดูแล `model_store.py`, `shap_explain.py`

---

### DE-04 ยังไม่มี data layer และ batch scoring ที่ Superset ต้องใช้

ระดับ: กลาง

**ปัญหา:**
- ข้อมูลพนักงานยังอ่านจาก CSV ส่วน PostgreSQL ใน docker-compose มีแค่ database ของ MLflow
- README หัวข้อ 9 วางไว้ว่า Superset จะ query PostgreSQL ตรง แต่ยังไม่มีตาราง `attrition_predictions`, `shap_explanations`, `company_risk_summary`
- มีสองแผนที่ขัดกันเรื่อง database: README และ TASKS.md วาง dev DB บน Supabase/Neon แต่ docker-compose self-host PostgreSQL
- `/company-summary` คำนวณ SHAP ใหม่ทั้ง 1,470 แถว ทุก request ([backend/routers/company_summary.py:50-52](../../backend/routers/company_summary.py#L50-L52))

**ทำไมต้องแก้:**
- Superset เรียก FastAPI ไม่ได้ ต้องมีตารางใน DB ให้ query ถ้าไม่มี batch job งาน Superset ของ Nanthamon (wk8–9) จะติด
- `/interventions` ของ Yanisa + Nanthamon (wk6–7) ต้องรู้ก่อนว่าจะเขียนลง DB ไหน
- ผลทำนายที่ไม่ได้บันทึก `model_version` จะย้อนตรวจไม่ได้ว่าตัวเลขบน dashboard มาจากโมเดลตัวไหน

**วิธีแก้:**
1. ประชุมตัดสินใจเรื่อง DB (ทั้งทีม ใช้เวลาไม่เกิน 30 นาที)
   - (ก) Supabase/Neon ตามแผนเดิม: ทุกคนต่อเข้าที่เดียวกันได้ง่ายช่วงพัฒนา แต่ข้อมูลอยู่บน cloud ภายนอก
   - (ข) PostgreSQL ใน docker-compose ที่มีอยู่แล้ว: ตรงกับแนวคิด "self-host ข้อมูลไม่ออกนอกบริษัท" ที่โปรเจกต์นำเสนอ แต่แต่ละคนต้องรันของตัวเอง
   - **ข้อเสนอ:** ใช้ (ก) ช่วงพัฒนา และใช้ (ข) ตอน demo/CI โดยใช้ schema SQL ชุดเดียวกัน แล้วสลับด้วย `DATABASE_URL` ใน `.env`
2. เขียน schema เป็นไฟล์: เช่น `db/schema.sql` ให้ครบทุกตารางใน README หัวข้อ 5 และทุกตารางผลทำนายต้องมีคอลัมน์ `model_version` กับ `scored_at`
3. เขียน `src/batch_score.py`: โหลดโมเดล `@champion` → ให้คะแนนพนักงานทุกคน (ใช้ out-of-fold ตาม DE-07) → คำนวณ SHAP → เขียนลง 3 ตาราง รันด้วยมือหรือตั้ง cron จากนั้น `/company-summary` อ่านจากตารางแทนการคำนวณสด
4. `/predict` และ `/whatif` ยังคำนวณสดเหมือนเดิม นี่คือแบบที่ใช้กันทั่วไป: batch สำหรับ dashboard, online สำหรับ interactive

**เสร็จเมื่อ:** ทีมเลือก DB แล้วบันทึกไว้ใน README, มี schema file, `batch_score.py` เขียนตารางได้ และ Superset query ตารางได้

**ผู้รับผิดชอบ:**
- ทั้งทีม: ตัดสินใจเรื่อง DB
- Saphondanai + Puripat: ทำ schema และ `batch_score.py` (เจ้าของ pipeline ข้อมูล→โมเดลตาม TASKS.md)
- Nanthamon (ผู้ใช้ตารางผ่าน Superset) และ Yanisa (`/interventions`) ต้องร่วมรีวิว schema ก่อน merge

---

### DE-05 Dependency ไม่ได้ pin เวอร์ชัน

ระดับ: กลาง

**ปัญหา:**
- [requirements.txt](../../requirements.txt) มี 21 แพ็กเกจแต่ไม่ระบุเวอร์ชันเลย
- [docker/mlflow/Dockerfile:3](../../docker/mlflow/Dockerfile#L3) pin `mlflow v3.16.1` และมี comment ว่า "ต้องตรงกับ client" แต่ฝั่ง client ไม่ได้ pin

**ทำไมต้องแก้:**
- คนที่ติดตั้งทีหลังหรือ CI จะได้เวอร์ชันใหม่กว่า ทำให้ MLflow client กับ server ไม่ตรงกัน
- xgboost หรือ shap คนละเวอร์ชันอาจให้คะแนนหรือค่า SHAP ต่างกัน สุดท้าย "ตัวเลขในรายงานรันซ้ำไม่ได้"
- jupyter, streamlit, catboost ฯลฯ ถูกติดตั้งทุกที่ ทำให้ image ของ backend ใหญ่เกินจำเป็น

**วิธีแก้:**
1. ใช้ `.venv` ที่ทำงานได้อยู่ตอนนี้ รัน `pip freeze` เพื่อดูเวอร์ชันจริงที่ใช้
2. แยกเป็น 2 ไฟล์
   - `requirements.txt` (สำหรับรันจริง) pin `==` เช่น pandas, numpy, scikit-learn, xgboost, shap, `mlflow==3.16.1`, fastapi, uvicorn, python-dotenv
   - `requirements-dev.txt` บรรทัดแรกเป็น `-r requirements.txt` ตามด้วย jupyter, matplotlib, seaborn, optuna, lightgbm, catboost, imbalanced-learn, streamlit, pytest, httpx, ruff, kagglehub
3. แก้ CI และ README ให้ติดตั้ง `requirements-dev.txt`

> **รอบ 2:** วันนี้ CI กับ `.venv` บังเอิญได้เวอร์ชันหลักตรงกัน (xgboost 3.4.1, scikit-learn 1.9.1, numpy 2.5.3, pandas 3.0.6, shap 0.52.0, mlflow 3.16.1) เพราะติดตั้งห่างกันแค่ไม่กี่วัน เครื่องที่ติดตั้งในเดือนหน้าจะไม่ได้เวอร์ชันเดิมถ้าไม่ pin และแม้เวอร์ชันตรงกันก็ยังได้โมเดลต่างกัน (ดู DE-08) การ pin จึงจำเป็นแต่ยังไม่พอ

**เสร็จเมื่อ:** ทุกแพ็กเกจมีเวอร์ชัน, mlflow ตรงกับ Dockerfile และ CI ผ่าน

**ผู้รับผิดชอบ:** Saphondanai ดูแล requirements, CI, docker ทุกคน ต้องติดตั้งใหม่หลัง merge ด้วย `pip install -r requirements-dev.txt`

---

### DE-06 ไฟล์ `data/processed/` ไม่มีใครใช้ และติดตามที่มาของข้อมูลไม่ได้

ระดับ: กลาง

**ปัญหา:**
- `data/processed/attrition_cleaned.csv` และ `attrition_cleaned_S.csv` ไม่มีโค้ดใน `src/` หรือ `backend/` อ่านเลย เพราะ `train.py` และ backend อ่านข้อมูลดิบแล้วคำนวณใหม่ทุกครั้ง มีแค่ `01_cleaning_P.ipynb` ที่อ่าน `_S` ไปเทียบ
- MLflow run ไม่ได้บันทึกว่าเทรนจากข้อมูลชุดไหน (ไม่มี lineage คือการตอบได้ว่า "โมเดลนี้มาจากข้อมูลอะไรและโค้ด commit ไหน")

**ทำไมต้องแก้:**
- คนนอก เช่นอาจารย์หรือกรรมการ จะเข้าใจว่าไฟล์นี้คือ input ของโมเดล
- ถ้าไฟล์ไม่ตรงกับ pipeline ปัจจุบัน มีโอกาสหยิบข้อมูลเก่าไปใช้ผิด
- ถ้าถูกถามว่า "โมเดล v1 เทรนจากข้อมูลอะไร" ตอนนี้ยังตอบจากหลักฐานไม่ได้

**วิธีแก้:**
1. เลือกอย่างใดอย่างหนึ่ง
   - (ก) ลบ `data/processed/` ออก (สร้างใหม่ได้ด้วย `python src/clean_pipeline.py`) แล้วแก้ [data/README.md](../../data/README.md) ให้ตรง
   - (ข) เก็บไว้ แต่เขียนใน `data/README.md` ว่าเป็นตัวอย่างผลลัพธ์ ไม่ได้ใช้เทรน
2. ใน `train.py` เพิ่ม `mlflow.log_input(mlflow.data.from_pandas(df, source=<raw path>, name="ibm-hr-raw"))` หรืออย่างน้อยให้ tag `data_sha256` ทำร่วมกับ DE-03 ได้ ข้อมูล 1,470 แถวยังไม่จำเป็นต้องใช้ DVC

**เสร็จเมื่อ:** ไม่มีไฟล์ข้อมูลที่ไม่รู้ว่ามีไว้ทำอะไร และ MLflow run ใหม่มีข้อมูล input หรือ hash

**ผู้รับผิดชอบ:** Puripat + Saphondanai (เจ้าของ cleaning ไฟล์ละคน) ส่วน `log_input` ใน `train.py` เป็นของ Saphondanai

---

### DE-07 ตัวเลขใน demo ดูดีเกินจริง (in-sample) และ AUC ไม่มีช่วงความเชื่อมั่น

ระดับ: กลาง

**ปัญหา:**
- `/company-summary`, `/shap` และ `/financial-impact` ให้คะแนนพนักงานทั้ง 1,470 คน ซึ่ง 1,176 คน (80%) โมเดลเคยเห็นตอนเทรน เรียกว่า in-sample
- `train.py` log test AUC จาก split เดียว คือ 294 คน มีคนลาออกแค่ 47 คน

**หลักฐาน (รันจริง):**

| ตัววัด | in-sample (แบบที่ระบบทำตอนนี้) | out-of-fold (โมเดลไม่เคยเห็นแถวนั้น) |
| :--- | :--- | :--- |
| AUC | train 0.956 | test 0.814 |
| จำนวนคนในกลุ่ม High (≥ 0.7) | 185 คน | 157 คน |
| ในกลุ่ม High ลาออกจริงกี่ % | 83% | 66% |

bootstrap 95% CI ของ test AUC = 0.73 – 0.88 (10,000 รอบ ใช้ฟังก์ชันและ seed เดียวกับ `train.py` และ notebook 07)

**ทำไมต้องแก้:**
- dashboard จะบอก HR ว่ากลุ่ม High แม่น 83% ทั้งที่กับพนักงานที่โมเดลไม่เคยเห็นจะแม่นราว 66% ถือว่าอ้างเกินจริงใน demo และ Defense
- AUC 0.81 ตัวเลขเดียวทำให้ดูแม่นยำกว่าความจริง ถ้ากรรมการถามว่า "ต่างจากโมเดลที่ได้ 0.79 อย่างมีนัยสำคัญไหม" ต้องตอบด้วยช่วงความเชื่อมั่น

**วิธีแก้:**
1. ใน `batch_score.py` (DE-04) ใช้ `cross_val_predict` แบบ 5-fold ให้คะแนนพนักงานที่อยู่ในชุดข้อมูล IBM (โค้ดตัวอย่างอยู่ในภาคผนวก)
2. ใน `train.py` log `cv_auc_mean`, `cv_auc_std` และ bootstrap CI เพิ่มจาก test AUC
3. ในสไลด์และรายงาน ให้รายงาน AUC เป็นช่วง เช่น "0.81 (95% CI 0.73–0.88)"

> SHAP ของแถวที่อยู่ใน training set ยังใช้ อธิบายพฤติกรรมของโมเดล ได้ ปัญหาหลักอยู่ที่ ระดับคะแนนและจำนวนคนในแต่ละกลุ่มเสี่ยง

> **ความคืบหน้า (รอบ 2):** commit `fc4a969` เพิ่มตารางตัวชี้วัดพร้อม 95% CI จาก bootstrap ใน `notebooks/07_imbalance_S.ipynb` และ `report_business_logic_draft_S.md` หัวข้อ 2.3 แล้ว วิธีแก้ข้อ 3 จึงเสร็จในส่วนรายงาน ที่เหลือคือข้อ 1 (OOF ใน batch) และข้อ 2 (CV metric ใน `train.py`) ข้อสังเกตคือ notebook 07 คำนวณ CI จากโมเดลที่เทรนใหม่ ไม่ได้โหลด v1 มาใช้ ในเครื่องนี้ได้ผลเท่ากันพอดี แต่เครื่องอื่นอาจไม่เท่า (DE-08)

**เสร็จเมื่อ:** dashboard และ `/company-summary` ใช้คะแนน out-of-fold, MLflow มี CV metric และสไลด์ Data Gate รายงาน AUC เป็นช่วง

**ผู้รับผิดชอบ:** Saphondanai + Puripat (เจ้าของโมเดล) ตัวเลขในสไลด์ "Modeling Results & MLflow" เป็นของ Saphondanai

---

### DE-08 เทรนซ้ำด้วยโค้ดและ seed เดียวกัน แต่ได้โมเดลไม่เหมือนกัน

ระดับ: กลาง (เพิ่มในรอบ 2)

**ปัญหา:** [src/train.py](../../src/train.py) ตั้ง `random_state=42` และ `n_jobs=4` ไว้ แต่โมเดลที่ได้ยังขึ้นกับจำนวน thread และระบบปฏิบัติการ ขณะที่เอกสารหลายที่เขียนว่าเทรนใหม่แล้วได้ผลเดิม
- [docs/mlflow_setup.md:87](../mlflow_setup.md#L87) "ผลเหมือนเดิมเพราะใช้ seed คงที่"
- [src/train.py:5](../../src/train.py#L5) "ค่าที่ได้ควรตรงกับ notebook 04"
- notebook 07 หัวข้อ 5 ที่เทรนใหม่แล้วเขียนว่า "= attrition-xgboost-P v1"

**หลักฐาน (รอบ 2 รันจริง):**

| สภาพแวดล้อม | `n_jobs` | test AUC | test F1@0.5 |
| :--- | :--- | :--- | :--- |
| `attrition-xgboost-P` v1 บน DagsHub | 4 | 0.8141 | 0.488 |
| เครื่องนี้ (Windows) เทรนซ้ำ | 4 | 0.8141 (ตรงกับ v1 ทุกแถว) | 0.488 |
| เครื่องนี้ (Windows) เทรนซ้ำ | 1 / 2 / 8 | 0.8047 / 0.8109 / 0.8151 | — |
| CI บน GitHub (Ubuntu) run ของ `45f926a` | 4 | 0.809 | 0.504 |

- CI กับเครื่องนี้ใช้ xgboost, scikit-learn, numpy, pandas เวอร์ชันเดียวกันทุกตัว ความต่างจึงไม่ได้มาจากเวอร์ชันแพ็กเกจ
- รันซ้ำด้วยการตั้งค่าเดิมบนเครื่องเดิมได้ผลเดิมทุกครั้ง

**ทำไมต้องแก้:**
- **CI ทดสอบคนละโมเดลกับที่ใช้จริง:** CI เทรนโมเดลของตัวเอง (AUC 0.809) แล้วรัน test กับโมเดลนั้น ไม่ใช่กับ v1 (0.814) ที่ backend โหลด test ที่ผ่านจึงไม่ได้ยืนยันว่า v1 ผ่าน
- **ตัวเลขในรายงานอาจไม่ตรง:** ถ้าใครเทรนใหม่บนเครื่องที่จำนวน core ต่างกันแล้ว register v2 ตัวเลขในรายงานทุกฉบับจะเพี้ยนโดยไม่มีใครรู้
- **ความต่าง ~0.01 AUC เป็นแค่ผลของสภาพแวดล้อม:** ผลต่างระหว่างการทดลองระดับนี้จึงไม่มีความหมาย ซึ่งยิ่งย้ำว่าต้องรายงานเป็นช่วง (DE-07)

**วิธีแก้:**
1. ใช้ artifact ที่ register แล้วเป็นแหล่งความจริง: ตัวเลขในรายงานและสไลด์ให้คำนวณจากการโหลด `models:/attrition-xgboost-P/1` (หรือ `@champion` ตาม DE-03) ไม่ใช่เทรนใหม่ แก้ notebook 07 หัวข้อ 5 ให้โหลด v1
2. บันทึกสภาพแวดล้อมตอนเทรน: เป็น MLflow tag: `platform.platform()`, `n_jobs`, `os.cpu_count()` (MLflow บันทึกเวอร์ชันแพ็กเกจให้แล้ว แต่ไม่บันทึก OS และ thread)
3. CI ใช้เกณฑ์แบบมีช่วง: เช่น AUC ≥ 0.78 (ผูกกับ H-03) แล้วเขียนให้ชัดว่า CI พิสูจน์ว่า "pipeline สร้างโมเดลที่ผ่านเกณฑ์ได้" ไม่ใช่ "สร้างโมเดลตัวเดียวกับ v1"
4. แก้ข้อความใน `mlflow_setup.md:87` และ docstring ของ `train.py`
5. (ถ้าต้องการผลตรงกันทุกบิต) เทรนตัวจริงใน Docker image เดียวกันเสมอ หรือใช้ `n_jobs=1`

**เสร็จเมื่อ:** เอกสารไม่อ้างว่าเทรนใหม่แล้วได้ผลเดิม, ตัวเลขในรายงานมาจาก artifact และ MLflow run มี tag บอกสภาพแวดล้อม

**ผู้รับผิดชอบ:** Saphondanai (`train.py`, `mlflow_setup.md`, notebook 07, CI)

---

### DE-09 รายงานร่างและเอกสารมีตัวเลขหรือข้อความที่ไม่ตรงกับของจริง

ระดับ: กลาง (เพิ่มในรอบ 2 เพราะเอกสารเหล่านี้จะถูกส่งให้อาจารย์และกรรมการ ตัวเลขที่ไม่ตรงกับระบบจะถูกจับได้ตอน demo)

**หลักฐาน (รอบ 2 เทียบกับข้อมูล โค้ด และโมเดล v1 จริง):**

| ไฟล์:บรรทัด | เขียนว่า | ของจริง | แก้โดย |
| :--- | :--- | :--- | :--- |
| [report_business_logic_draft_S.md:141](../report_business_logic_draft_S.md#L141) | พนักงาน 1,470 คน "High 170 / Medium 313 / Low 987" | v1 ได้ 185 / 274 / 1011 และตารางรายแผนกในไฟล์เดียวกัน (บรรทัด 193–195) ก็รวมได้ 185 / 274 / 1011 | Saphondanai |
| [report_business_logic_draft_S.md:177](../report_business_logic_draft_S.md#L177) | "เมื่อบริษัทไทยใช้ข้อมูลของตัวเอง ตัวเลขจะเป็นบาทโดยอัตโนมัติ" | จริงเฉพาะตัวเลขเงิน ส่วนคะแนนความเสี่ยงจะผิดเพราะโมเดลเห็นเงินเดือนบาทเกินช่วงที่เคยเห็น (DE-01) ต้องเพิ่มข้อจำกัดนี้ | Saphondanai |
| [report_backend_draft_P.md:58](../report_backend_draft_P.md#L58) | ตัวอย่าง `/shap/1` `"risk_score": 0.713` | v1 ได้ 0.691 (ตรงกับตัวอย่าง `/predict` ใน `report_business_logic_draft_S.md:218`) | Puripat |
| [report_backend_draft_P.md:119](../report_backend_draft_P.md#L119) | โมเดลเป็น "ตัวทดลองใน MLflow ในเครื่อง" | ทีมเลือก v1 บน DagsHub เป็นโมเดลสุดท้ายแล้ว (TASKS.md) | Puripat |
| [report_backend_draft_P.md:120](../report_backend_draft_P.md#L120) | `/company-summary` ใช้ "ตารางคำแนะนำชั่วคราว" | ใช้ `src/company_summary.py` แล้ว | Puripat |
| [report_backend_draft_P.md:23](../report_backend_draft_P.md#L23) | ใช้โค้ดชุดเดียวกัน "ป้องกันปัญหา training/serving skew" | ป้องกันได้แค่บางส่วน ยังมี DE-01, DE-02, DE-03 | Puripat |
| [report_backend_draft_P.md:111](../report_backend_draft_P.md#L111) | "Frontend แสดงระดับ ต่ำ/ปานกลาง/สูง แทนเปอร์เซ็นต์" | แสดง "xx / 100" ด้วย และ SHAP Viewer ใช้เกณฑ์คนละชุดกับ API ([UX-01, UX-05](round1-2_ux_ui_S.md)) | Puripat |
| [mlflow_setup.md:3](../mlflow_setup.md#L3) | "โค้ดทุกส่วน … ชี้ MLflow ผ่าน `src/mlflow_setup.py`" | `src/shap_explain.py` และ notebook `05_shap_P` ใช้ sqlite แบบ hardcode (H-02) | Saphondanai |
| [mlflow_setup.md:87](../mlflow_setup.md#L87) | "ผลเหมือนเดิมเพราะใช้ seed คงที่" | ไม่จริง (DE-08) | Saphondanai |
| [README.md:167](../../README.md#L167) | ลาออก 238 คน | 237 คน (H-05) | Saphondanai |

**ตรวจแล้วถูกต้อง:**
- `dataset.md`: 1,470 แถว × 35 คอลัมน์, ~228 KB
- ตัวอย่าง `/financial-impact/1`: 53,937 / 7,192 / 46,745 / ค่าชดเชย 47,944 ตรงตามสูตรและข้อมูล
- ตัวอย่าง `/predict` ของพนักงาน 1: 0.691
- จำนวนช่องปรับใน What-if: 14
- ตาราง threshold 0.5 (เตือน 76, ถูก 30, เตือนผิด 46, หลุด 17)
- CI ใน 2.3 สอดคล้องกับ bootstrap ของรายงานนี้

**ทำไมต้องแก้:** ตัวเลขที่ขัดกันเองในรายงานฉบับเดียว (170 กับ 185) หรือตัวอย่าง response ที่ไม่ตรงกับตอน demo ทำให้กรรมการสงสัยตัวเลขอื่นทั้งหมดไปด้วย

**วิธีแก้:**
1. เจ้าของแต่ละไฟล์แก้ตามตารางข้างบน
2. ระยะยาว ตัวเลขในรายงานควรมาจากสคริปต์หรือ notebook ที่รันกับ artifact จริง (DE-08) และระบุ commit + model version ไว้หัวตาราง (รายงานของ Saphondanai ทำแล้วบางส่วน)

**เสร็จเมื่อ:** ทุกแถวในตารางถูกแก้ หรือมีหมายเหตุอธิบาย

**ผู้รับผิดชอบ:** Saphondanai (`report_business_logic_draft_S.md`, `mlflow_setup.md`, README) และ Puripat (`report_backend_draft_P.md`)

---

## 5. ประเด็นเชิงออกแบบ (ใส่ในรายงานและเตรียมตอบ Defense)

### DS-01 ข้อมูลไม่มีมิติเวลา (point-in-time)

ระดับ: ต่ำ

**ปัญหา:**
- IBM dataset เป็นภาพ snapshot ครั้งเดียวและไม่มีวันที่
- ค่า `YearsAtCompany` ของคนที่ลาออกคือค่า ณ วันที่ออก ส่วนของคนที่ยังอยู่คือค่า ณ วันเก็บข้อมูล
- data model ใน README หัวข้อ 5 วางตาราง `employees` ไว้แบบเขียนทับค่าได้

**ทำไมสำคัญ:**
- ถ้าระบบจริงเขียนทับข้อมูลพนักงาน ตอน retrain จะได้ค่าที่เกิด หลัง เหตุการณ์มาใช้ ซึ่งคือ leakage แบบที่ README 6.2 เตือนไว้เอง
- Survival Analysis ต้องใช้ข้อมูลเวลาจนเกิดเหตุการณ์ (time-to-event) และการตัดข้อมูลของคนที่ยังไม่เกิดเหตุการณ์ (censoring) ซึ่งต้องมาจากโครงแบบ snapshot นี้พอดี

**ข้อเสนอ:**
1. ออกแบบตาราง `employee_snapshots(employee_id, snapshot_date, ...features)` เก็บเป็นรอบ เช่นรายเดือน และห้ามเขียนทับ
2. นิยาม label ให้ชัด เช่น "ลาออกภายใน 12 เดือนหลัง `snapshot_date`" และเทรนเฉพาะ snapshot ที่ผ่านมาครบ 12 เดือนแล้ว
3. แบ่งข้อมูลตามเวลา (train = อดีต, test = อนาคต) ไม่ใช่สุ่ม
4. ในรายงานให้ระบุเป็นข้อจำกัดของ IBM dataset

**ผู้รับผิดชอบ:** Yanisa + Nanthamon (Survival Analysis) และ ทั้งทีม รีวิว data model ใน README หัวข้อ 5

### DS-02 Feedback loop ของขั้น Measure

ระดับ: ต่ำ

**ปัญหา:** ถ้า HR ดูแลคนกลุ่มเสี่ยงสูงแล้วเขาไม่ลาออก ข้อมูลรอบถัดไปจะสอนโมเดลว่า "คนแบบนี้ไม่ลาออก" โมเดลจะแย่ลงเรื่อย ๆ และจะวัดไม่ได้ว่ามาตรการได้ผลจริงหรือไม่

**ข้อเสนอ:**
1. ตาราง `interventions` ต้องมี `employee_id`, `intervention_type`, `started_at` และ field บอกกลุ่ม `treatment`/`control`
2. ตอน retrain ให้ตัดคนที่ได้รับ intervention ออก หรือใส่การได้รับ intervention เป็นฟีเจอร์
3. ถ้าทำไม่ทัน ให้เขียนเป็นข้อจำกัดในรายงาน

**ผู้รับผิดชอบ:** Yanisa + Nanthamon (`/interventions` และ Intervention Tracker)

### DS-03 PDPA, Fairness และความปลอดภัย

ระดับ: ต่ำ

**ปัญหา:**
- `Gender`, `Age`, `MaritalStatus_*` เป็นส่วนหนึ่งของ 50 ฟีเจอร์ที่โมเดลใช้ (ยืนยันจากรายชื่อคอลัมน์) แต่ Fairness check ตาม README 6.4 ยังไม่ได้ทำ
- [src/train.py:43](../../src/train.py#L43) `input_example=Xte.head(3)` คือการอัปโหลดข้อมูลพนักงาน 3 แถวขึ้น DagsHub และยืนยันแล้วว่าคนนอกที่ไม่ได้ login ดาวน์โหลดไฟล์นี้ได้ เพราะ repo บน DagsHub เป็นสาธารณะ (ดู [SEC-12 ในรายงาน Security](round1-2_security_S.md#sec-12-repo-บน-dagshub-เป็นสาธารณะ-ดาวน์โหลดโมเดลและข้อมูลตัวอย่างได้โดยไม่ต้อง-login))
- `/recalibrate` ไม่มี auth ใครรู้ `tenant_id` ก็เขียนทับได้ และผล calibration เก็บเป็นไฟล์ JSON ใน `backend/calibrations/` ถ้าสร้าง container ใหม่ก็หาย

**ทำไมสำคัญ:**
- ข้อมูล HR เป็นข้อมูลส่วนบุคคลตาม PDPA
- การใช้ protected attribute ประกอบการตัดสินใจเสี่ยงต่อการเลือกปฏิบัติ
- ตอนนี้ข้อมูลเป็น synthetic จึงยังไม่เสียหายจริง แต่กรรมการน่าจะถามว่า "ถ้าใช้กับข้อมูลจริงล่ะ"

**ข้อเสนอ:**
1. ทำ Fairness check ตามแผน (Fairlearn `MetricFrame` แยกตาม Gender และช่วงอายุ) และลองเทรนโมเดลที่ตัด `Gender`/`MaritalStatus` ออก แล้วเทียบผล (ตัวเลขตั้งต้นจากรอบ 2 อยู่ใน DS-04)
2. เปลี่ยน `input_example` เป็นแถวสังเคราะห์ เช่นจาก `data/sample/whatif_employees.csv` หรือใช้ signature อย่างเดียว
3. เขียนเรื่อง auth และที่เก็บ calibration เป็น "ข้อจำกัดของ prototype" ในรายงาน และย้าย calibration เข้าตาราง `tenant_calibrations` เมื่อทำ DE-04

**ผู้รับผิดชอบ:**
- Yanisa + Nanthamon: ทำ Fairness check
- Saphondanai: แก้ `input_example`
- Puripat: บันทึกข้อจำกัดเรื่อง auth และ storage ใน `report_backend_draft_P.md`

### DS-04 Fairness เบื้องต้น: โมเดลจับคนลาออกกลุ่มอายุมากและแต่งงานแล้วได้น้อยกว่ามาก

ระดับ: กลาง (เพิ่มในรอบ 2 เป็นตัวเลขตั้งต้น ยังไม่ใช่ Fairness check เต็มรูปแบบ)

**วิธีวัด:**
- ใช้คะแนน out-of-fold 5-fold ทุกคนจึงถูกให้คะแนนโดยโมเดลที่ไม่เคยเห็นตัวเขา
- ใช้ threshold 0.5 ตามที่ทีมตัดสินใจ
- TPR (จับได้) = ในคนที่ลาออกจริง โมเดลเตือนได้กี่ %
- FPR (เตือนผิด) = ในคนที่ไม่ลาออก โมเดลเตือนผิดกี่ %

**หลักฐาน (รอบ 2 รันจริง):**

| กลุ่ม | คน | ลาออกจริง | ถูกเตือน | จับได้ (TPR) | เตือนผิด (FPR) | AUC |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| อายุ 18–29 | 326 | 27.9% | 44.2% | 79.1% | 30.6% | 0.84 |
| อายุ 30–39 | 622 | 14.3% | 17.8% | 64.0% | 10.1% | 0.84 |
| อายุ 40–49 | 349 | 9.7% | 14.3% | 41.2% | 11.4% | 0.78 |
| อายุ 50+ | 173 | 13.3% | 22.0% | 43.5% | 18.7% | 0.70 |
| โสด | 470 | 25.5% | 37.2% | 75.8% | 24.0% | 0.85 |
| แต่งงาน | 673 | 12.5% | 18.4% | 48.8% | 14.1% | 0.75 |
| หย่าร้าง | 327 | 10.1% | 13.5% | 63.6% | 7.8% | 0.89 |
| หญิง | 588 | 14.8% | 22.6% | 67.8% | 14.8% | 0.83 |
| ชาย | 882 | 17.0% | 23.8% | 62.7% | 15.8% | 0.83 |

ช่องว่างของ TPR ระหว่างกลุ่มที่สูงสุดกับต่ำสุด (bootstrap 10,000 รอบ):

| มิติ | ช่องว่าง TPR | 95% CI |
| :--- | :--- | :--- |
| อายุ | 0.38 | 0.25–0.60 |
| สถานภาพ | 0.27 | 0.15–0.41 |
| เพศ | 0.05 | 0.00–0.18 |

**ทดลองสลับค่าเพศอย่างเดียวกับโมเดล v1 (counterfactual):**
- ระดับความเสี่ยงเปลี่ยน 60 จาก 1,470 คน (4.1%)
- คะแนนเปลี่ยนเฉลี่ย 0.020 สูงสุด 0.083
- มี 12 จาก 500 ต้นไม้ของ v1 ที่แตกกิ่งด้วย `Gender`

**อ่านว่า:**
- **อายุและสถานภาพ:** อัตราลาออกจริงต่างกันอยู่แล้ว (คนอายุน้อยและคนโสดลาออกมากกว่า) การที่ "ถูกเตือน" ไม่เท่ากันจึงไม่ใช่ปัญหาในตัวเอง (demographic parity ไม่ใช่เกณฑ์ที่เหมาะกับงานนี้)
  - แต่ความสามารถในการจับคนที่จะลาออกจริง (equal opportunity) ต่างกันมาก และช่วงความเชื่อมั่นไม่คร่อม 0 แปลว่าต่างจริง ไม่ใช่ความบังเอิญ
  - ในทางปฏิบัติ HR ที่ใช้ระบบจะมองไม่เห็นคนอายุ 40 ขึ้นไปที่กำลังจะลาออกเกินครึ่ง กลุ่มนี้จึงได้รับการดูแลน้อยกว่า
- **เพศ:** ภาพรวมใกล้เคียงกัน แต่โมเดลใช้เพศโดยตรง คนสองคนที่ต่างกันแค่เพศอาจได้ระดับความเสี่ยงต่างกัน ซึ่งเป็นประเด็นทั้งทางจริยธรรมและ PDPA แม้ตัวเลขรวมจะดูเท่ากัน

**ข้อจำกัดของตัวเลขชุดนี้:**
- เป็นข้อมูล synthetic ของ IBM
- กลุ่ม 50+ มีคนลาออกจริงแค่ประมาณ 23 คน ช่วงความเชื่อมั่นจึงกว้าง
- ยังไม่ได้ตั้งเกณฑ์ว่าช่องว่างเท่าไรยอมรับได้ และยังไม่ได้ใช้ Fairlearn

**ข้อเสนอ (สำหรับ Fairness check ใน TASKS.md):**
1. ใช้ตัวเลขนี้เป็นจุดตั้งต้น ทำซ้ำด้วย Fairlearn `MetricFrame` โดยใช้ TPR (equal opportunity) เป็นเกณฑ์หลัก เพราะอัตราลาออกจริงต่างกันตามกลุ่ม
2. ทดลองโมเดลที่ตัด `Gender` (และ `MaritalStatus`) ออก แล้วเทียบ AUC กับ TPR รายกลุ่ม การเปลี่ยนนี้เป็นการเปลี่ยนโมเดล จึงต้องตัดสินใจร่วมกับเจ้าของโมเดล
3. ในรายงานและ UI เขียนเตือนการใช้งาน เช่น "โมเดลจับคนลาออกกลุ่มอายุ 40 ขึ้นไปได้น้อยกว่า อย่าใช้การที่คนนั้นไม่ติดกลุ่มเสี่ยงเป็นเหตุผลว่าไม่ต้องดูแล" (ผูกกับ [UX-06](round1-2_ux_ui_S.md#ux-06-แสดงเพศ-อายุ-สถานภาพ-เป็น-เหตุผล-ของความเสี่ยง))

**เสร็จเมื่อ:** Fairness check ของทีมมีตาราง TPR รายกลุ่มพร้อม CI, มีผลการทดลองตัด protected attribute และมีข้อความเตือนในรายงานและ UI

**ผู้รับผิดชอบ:**
- Yanisa + Nanthamon (หลัก): Fairness check ตาม TASKS.md wk6–7
- Saphondanai + Puripat: ทดลองโมเดลที่ตัด protected attribute และตัดสินใจร่วม

---

## 6. เรื่องเล็ก / เก็บงาน

| ID | เรื่อง | ทำไม | วิธีแก้ | ผู้รับผิดชอบ |
| :--- | :--- | :--- | :--- | :--- |
| H-01 | มี `sys.path.append`/`insert` ใน 9 ไฟล์ | import พังเมื่อรันจากโฟลเดอร์อื่น และ linter เตือน E402 ทั้งโปรเจกต์ | เพิ่ม `pyproject.toml` แล้วใช้ `pip install -e .` (ทำเมื่อมีเวลา) | Saphondanai + Puripat |
| H-02 | [src/shap_explain.py:27](../../src/shap_explain.py#L27) hardcode sqlite URI | ไม่ผ่าน `mlflow_setup` จึงไม่เห็นโมเดลบน DagsHub | เรียก `mlflow_setup.setup()` แทน | Puripat |
| H-03 | CI เทรนโมเดลแต่ไม่มีเกณฑ์คุณภาพ และไม่มี test ของ clean/feature pipeline | โมเดลแย่ลงแล้ว CI ก็ยังเขียว | ให้ `train.py` exit ≠ 0 ถ้า AUC < 0.75 และเพิ่ม test ว่าไม่มี NaN, มีคอลัมน์ครบ 50 และค่าหมวดหมู่ใหม่ต้อง error | Saphondanai (CI) + Puripat (test ของ feature) |
| H-04 | [load_raw_data](../../src/clean_pipeline.py#L51-L59) แอบดาวน์โหลดจาก Kaggle เองถ้าไม่มีไฟล์ | backend ไม่ควรมีผลข้างเคียงทางเครือข่ายแบบที่ไม่รู้ตัว | แยกเป็น `download_raw_data()` เรียกเฉพาะตอน setup ส่วน `load_raw_data` ให้ error ชัด ๆ ถ้าไม่มีไฟล์ | Saphondanai + Puripat |
| H-05 | [README.md:3-14](../../README.md#L3-L14) ยังเขียนว่า "v0.1 ยังไม่มีโค้ด" และ [README.md:167](../../README.md#L167) บอกว่าลาออก 238 คน แต่ข้อมูลจริงมี 237 คน (16.1%) | คนตรวจงานอ่านแล้วสับสน และตัวเลขไม่ตรงกับข้อมูล | อัปเดตสถานะ, เวอร์ชัน และตัวเลข | Saphondanai |
| H-06 | `/recalibrate` ใช้ isotonic เป็นค่าเริ่มต้น และขั้นต่ำแค่ 50 แถว ([recalibrate.py:14-19](../../backend/routers/recalibrate.py#L14-L19)) | isotonic กับข้อมูลน้อย overfit ง่าย และ `brier_after` วัดบนข้อมูลชุดเดียวกับที่ fit | ใช้ `platt` เป็นค่าเริ่มต้นเมื่อข้อมูลน้อย หรือวัด brier ด้วย CV | Puripat |
| H-07 | notebook (รอบ 2) 1. ใน 05 "CV F1" ของค่าที่ Optuna เลือกวัดบน fold ชุดเดียวกับที่ใช้จูน (06 แก้ส่วน threshold แล้ว แต่ส่วนการจูนยังเอนเอียง) 2. `05_shap_P` รันได้เฉพาะเครื่องที่มี `mlflow.db` เพราะผ่าน `shap_explain.py` ที่ hardcode sqlite 3. ใน 07 หัวข้อ 5 เทรนใหม่แทนการโหลด v1 | ตัวเลข CV ดูดีกว่าจริงเล็กน้อย, notebook ของเพื่อนรันซ้ำบนเครื่องอื่นไม่ได้, ตัวเลขที่นำเสนออาจไม่ใช่ของ v1 เมื่อรันบนเครื่องอื่น | 1. ใช้ test หรือ nested CV เป็นตัวเลขหลักตอนเทียบโมเดล (รายงานร่างทำอยู่แล้ว) 2. แก้ตาม H-02 3. ให้ 07 โหลด v1 (DE-08) | Saphondanai (05, 07) + Puripat (05_shap_P) |

---

## 7. งานแยกรายคน

ติ๊กเมื่อเสร็จ แล้วใส่ commit hash ต่อท้าย เช่น `- [x] DE-05 ... (a1b2c3d)`

### ทั้งทีม (ประชุมครั้งเดียว ~30 นาที ก่อน 12 ต.ค.)
- [ ] ยืนยันผู้รับผิดชอบและกำหนดเสร็จในเอกสารนี้
- [ ] DE-01 ตกลงหน่วยเงินเดือนที่โมเดลใช้ และอัตราแลกเปลี่ยน
- [ ] DE-04 เลือก DB กลาง (Supabase/Neon หรือ self-host หรือทั้งสองแบบใช้ schema เดียว)

### Saphondanai
- [ ] DE-01 (หลัก) หน่วยเงินเดือนใน config + แปลงที่ API + range guard + React + test
- [ ] DE-02 review schema `LabeledEmployee`
- [x] DE-03 ส่วน tag commit + data hash (`31f4690`)
- [ ] DE-03 (หลัก) feature spec / alias `@champion`
- [ ] DE-04 schema + `batch_score.py` (ร่วมกับ Puripat)
- [x] DE-05 pin requirements + แยก dev (`65f4d13`)
- [x] DE-06 `log_input` ใน `train.py` (`31f4690`)
- [ ] DE-06 จัดการ `attrition_cleaned_S.csv`
- [x] DE-07 ข้อ 3: CI ของ AUC ในรายงานร่าง (`fc4a969`)
- [x] DE-07 ข้อ 2: CV metric + bootstrap CI ใน `train.py` (`31f4690`)
- [ ] DE-07 ตัวเลขในสไลด์ Data Gate
- [x] DE-08 notebook 07 โหลด v1 แทนการเทรนใหม่ + tag สภาพแวดล้อมใน `train.py` + แก้ข้อความใน `mlflow_setup.md:87` และ docstring ของ `train.py` (`31f4690`, `577fab1`, `67cde44`)
- [x] DE-09 แก้ `report_business_logic_draft_S.md` บรรทัด 141 (185/274/1011) และ 177 (ข้อจำกัดหน่วยเงิน) + `mlflow_setup.md:3` (`67cde44`)
- [x] DS-03 เปลี่ยน `input_example` เป็น signature อย่างเดียว (`31f4690`) มีผลตอน register version ถัดไป
- [ ] DS-04 ทดลองโมเดลที่ตัด `Gender`/`MaritalStatus` (ร่วมกับ Puripat) เมื่อทีม Fairness พร้อม
- [x] H-03 CI gate: `train.py` exit ≠ 0 ถ้า test AUC < 0.75 (`31f4690`) · H-05 (`67cde44`) · H-07 (05, 07) (`577fab1`)
- [ ] H-01, H-04

### Puripat
- [ ] DE-02 (หลัก) validate records ใน `/recalibrate` + test
- [ ] DE-01 หน้า Streamlit `whatif_page.py` ใช้หน่วยจาก config กลาง
- [ ] DE-03 `model_store.py` / `shap_explain.py` ใช้ alias และ feature spec
- [x] DE-04 schema + `batch_score.py` (ร่วมกับ Saphondanai) (`267e194`, `48914fe`, `bcfbb8f`) รอ Nanthamon/Yanisa รีวิว schema
- [ ] DE-06 จัดการ `attrition_cleaned.csv`
- [ ] DE-07 out-of-fold ใน batch scoring (ร่วมกับ Saphondanai)
- [x] DS-03 เขียนข้อจำกัดเรื่อง auth/storage ใน `report_backend_draft_P.md` (`bcfbb8f`)
- [x] DE-09 แก้ `report_backend_draft_P.md` บรรทัด 23, 58 (0.691), 111, 119, 120 (`bcfbb8f`)
- [ ] DS-04 ทดลองโมเดลที่ตัด `Gender`/`MaritalStatus` (ร่วมกับ Saphondanai)
- [ ] H-01, H-02, H-03 (test ของ feature), H-04, H-06, H-07 (`05_shap_P`)

### Yanisa
- [ ] DS-01 ใช้โครง time-to-event ใน Survival Analysis และเขียนข้อจำกัดเรื่องมิติเวลา
- [ ] DS-02 ใส่ field `treatment`/`control` ใน schema ของ `/interventions`
- [ ] DS-03 Fairness check (ร่วมกับ Nanthamon)
- [ ] DS-04 (หลัก) ทำซ้ำตัวเลขตั้งต้นด้วย Fairlearn ใช้ TPR เป็นเกณฑ์หลัก ตั้งเกณฑ์ที่ยอมรับได้ และเขียนคำเตือนเรื่องกลุ่มอายุ 40+ (ร่วมกับ Nanthamon)
- [ ] DE-04 รีวิว schema ในส่วนที่ `/interventions` ใช้

### Nanthamon
- [ ] DS-01 Survival Analysis (ร่วมกับ Yanisa)
- [ ] DS-02 schema ของ `/interventions` (ร่วมกับ Yanisa)
- [ ] DS-03 Fairness check (ร่วมกับ Yanisa)
- [ ] DS-04 (หลัก) Fairness check ต่อจากตัวเลขตั้งต้น (ร่วมกับ Yanisa) และพิจารณาแสดง TPR รายกลุ่มใน Superset
- [ ] DE-04 รีวิว schema ในส่วนที่ Superset ใช้ (ตาราง predictions / summary)

---

## 8. ความเห็นทีม

เขียนต่อท้ายได้เลย รูปแบบ: `- [ID] ชื่อ (วันที่): ความเห็น`

- [DE-03] Saphondanai (1 ต.ค. 2026): ไม่ได้เพิ่ม tag `git_commit` เอง เพราะ MLflow ติด `mlflow.source.git.commit` ให้อัตโนมัติอยู่แล้ว ส่วน `data_sha256` ใช้ hash จากค่าในตาราง ไม่ใช่ byte ของไฟล์ เพราะ git เก็บ CSV เป็น LF แต่บน Windows checkout ออกมาเป็น CRLF ถ้า hash จากไฟล์ เครื่องทีมกับ CI จะได้ค่าไม่ตรงกันทั้งที่เป็นข้อมูลเดียวกัน
- [DE-05] Saphondanai (1 ต.ค. 2026): `kagglehub` อยู่ใน `requirements-dev.txt` เพราะ raw CSV อยู่ใน git แล้ว และ `load_raw_data` import เฉพาะตอนไม่มีไฟล์ (จะแยกให้ชัดใน H-04) ทุกคนต้องรัน `pip install -r requirements-dev.txt` หลังดึงโค้ดนี้
- [DS-03] Saphondanai (1 ต.ค. 2026): เลือกใช้ signature อย่างเดียวแทนแถวสังเคราะห์ เพราะแถวสังเคราะห์ต้องสร้าง one-hot ครบ 50 คอลัมน์ ซึ่งเป็นปัญหาเดียวกับ DE-03 ส่วน v1 บน DagsHub ยังมี `input_example` เดิม จะหายเมื่อ register version ถัดไป (ตั้งใจทำพร้อม DE-01/DE-03 ครั้งเดียว)
- [H-03] Saphondanai (1 ต.ค. 2026): ใช้เกณฑ์ 0.75 ไม่ใช่ 0.78 เพราะค่าที่วัดได้จริงคือ 0.805–0.815 ตามสภาพแวดล้อม ถ้าตั้ง 0.78 ระยะเผื่อจะเหลือแค่ ~0.025 และ gate ทำงานก่อน register จึงไม่มีโมเดลที่ไม่ผ่านเกณฑ์เข้า registry

---

## คำศัพท์

| คำ | ความหมายในเอกสารนี้ |
| :--- | :--- |
| Training-serving skew | ข้อมูลตอนใช้งานจริงมีหน่วย รูปแบบ หรือวิธีคำนวณต่างจากตอนเทรน โมเดลไม่ error แต่ตอบผิด |
| Data contract / data dictionary | ข้อตกลงที่เขียนไว้ที่เดียวว่าแต่ละคอลัมน์มีความหมาย หน่วย และค่าที่อนุญาตเป็นอะไร |
| Fail loud at the boundary | ตรวจข้อมูลตั้งแต่จุดที่เข้าระบบ ถ้าผิดให้ปฏิเสธพร้อมบอกเหตุผล ไม่ปล่อยให้ไปพังเงียบ ๆ ข้างใน |
| Lineage | การตอบได้ว่าโมเดลหรือตัวเลขหนึ่ง ๆ มาจากข้อมูลชุดไหน ผ่านโค้ด commit ไหน |
| In-sample / Out-of-fold (OOF) | in-sample = ให้คะแนนแถวที่โมเดลเคยเห็นตอนเทรน (ดูดีเกินจริง), OOF = แบ่ง fold แล้วให้แต่ละ fold ถูกทำนายโดยโมเดลที่ไม่เคยเห็น fold นั้น |
| Batch scoring | ให้คะแนนทุกคนเป็นรอบแล้วเก็บลงตาราง ให้ dashboard อ่าน แทนการคำนวณสดทุกครั้งที่มีคนเปิด |
| Model alias (`@champion`) | ชื่อเล่นที่ชี้ไปยัง version ของโมเดลใน MLflow Registry เปลี่ยน version ได้โดยไม่ต้องแก้โค้ด |
| Point-in-time | ใช้เฉพาะข้อมูลที่ "รู้ได้ ณ วันที่ทำนาย" ไม่เอาค่าที่เกิดทีหลังมาใช้ |
| Artifact | ไฟล์โมเดลที่ register ไว้ใน MLflow ซึ่งเป็นตัวที่ backend โหลดใช้จริง ต่างจากการเทรนใหม่ด้วยโค้ดเดิม |
| Equal opportunity (TPR) | ในคนที่ลาออกจริงของแต่ละกลุ่ม โมเดลจับได้กี่ % ถ้าต่างกันมาก แปลว่าบางกลุ่มถูกมองข้าม |
| Demographic parity | แต่ละกลุ่มถูกเตือนในสัดส่วนเท่ากันไหม ไม่เหมาะเป็นเกณฑ์หลักเมื่ออัตราลาออกจริงของแต่ละกลุ่มต่างกันอยู่แล้ว |
| Counterfactual test | เปลี่ยนค่าแค่ฟีเจอร์เดียว (เช่น เพศ) แล้วดูว่าผลเปลี่ยนไหม ใช้ดูว่าโมเดลพึ่งฟีเจอร์นั้นโดยตรงแค่ไหน |

---

## ภาคผนวก: สคริปต์ตรวจซ้ำ

ตัวเลขทั้งหมดในหัวข้อ 4 มาจากสคริปต์นี้ สคริปต์เทรนโมเดลในเครื่องตามสูตรของ `train.py` (seed เดียวกัน ได้ test AUC 0.814 ตรงกับ v1) และ ไม่ได้ log อะไรขึ้น MLflow

วิธีรัน: คัดลอกโค้ดด้านล่างไปเป็นไฟล์ `verify_review.py` ที่ใดก็ได้ แล้วรันจากรากโปรเจกต์ (activate `.venv` ก่อน)

```bash
python verify_review.py .
```

<details>
<summary>โค้ด verify_review.py</summary>

```python
"""Verification for the data-engineering review (2026-10-01). Runs locally, logs nothing to MLflow."""
import json
import os
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from xgboost import XGBClassifier

ROOT = sys.argv[1]
sys.path.insert(0, os.path.join(ROOT, "src"))
from clean_pipeline import RAW_FILENAME, TARGET_COLUMN, clean_data, load_raw_data  # noqa: E402
from feature_pipeline import SELECTED_FEATURES, add_features  # noqa: E402
from train import PARAMS, bootstrap_auc_ci  # noqa: E402

raw = load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))


def features(r):
    return add_features(clean_data(r), only=SELECTED_FEATURES)


df = features(raw)
X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN]
idx = np.arange(len(y))
tr, te = train_test_split(idx, test_size=0.2, stratify=y, random_state=42)
Xtr, Xte, ytr, yte = X.iloc[tr], X.iloc[te], y.iloc[tr], y.iloc[te]
spw = (ytr == 0).sum() / (ytr == 1).sum()
model = XGBClassifier(**PARAMS, scale_pos_weight=spw, random_state=42, n_jobs=4).fit(Xtr, ytr)
p_te = model.predict_proba(Xte)[:, 1]
p_tr = model.predict_proba(Xtr)[:, 1]
out = {"features_in_model": list(X.columns)}
out["test_auc"] = roc_auc_score(yte, p_te)
out["train_auc"] = roc_auc_score(ytr, p_tr)
out["test_leavers"] = int(yte.sum())
out["test_n"] = len(yte)

# bootstrap CI of test AUC (same function, rounds and seed as src/train.py and notebook 07)
out["test_auc_boot95"] = bootstrap_auc_ci(yte.to_numpy(), p_te).tolist()


def bands(p):
    return {"High": int((p >= 0.7).sum()), "Medium": int(((p >= 0.4) & (p < 0.7)).sum()), "Low": int((p < 0.4).sum())}


# in-sample (what /company-summary does today: score all 1470 with a model trained on 80% of them)
p_all = model.predict_proba(X)[:, 1]
out["in_sample_all_1470_bands"] = bands(p_all)
out["in_sample_mean_score_train_rows"] = float(p_tr.mean())
out["in_sample_mean_score_test_rows"] = float(p_te.mean())
# out-of-fold alternative
oof = cross_val_predict(
    XGBClassifier(**PARAMS, scale_pos_weight=spw, random_state=42, n_jobs=4), X, y,
    cv=StratifiedKFold(5, shuffle=True, random_state=42), method="predict_proba")[:, 1]
out["oof_all_1470_bands"] = bands(oof)
out["actual_leavers"] = int(y.sum())
out["high_band_precision_in_sample"] = float(y[p_all >= 0.7].mean())
out["high_band_precision_oof"] = float(y[oof >= 0.7].mean())

# MonthlyIncome unit: IBM range vs baht-scaled upload (x35 as in whatif_page default rate)
out["monthly_income_range"] = [int(raw.MonthlyIncome.min()), int(raw.MonthlyIncome.max())]
thresholds = []
for tree in model.get_booster().get_dump(dump_format="json"):
    stack = [json.loads(tree)]
    while stack:
        n = stack.pop()
        if n.get("split") == "MonthlyIncome":
            thresholds.append(n["split_condition"])
        stack.extend(n.get("children", []))
out["monthly_income_split_max"] = float(max(thresholds)) if thresholds else None
out["monthly_income_n_splits"] = len(thresholds)
te_raw = raw.iloc[te].copy()
te_baht = te_raw.assign(MonthlyIncome=te_raw.MonthlyIncome * 35)
Xb = features(pd.concat([te_baht, raw], ignore_index=True)).iloc[: len(te)].drop(columns=TARGET_COLUMN)[X.columns]
p_b = model.predict_proba(Xb)[:, 1]
out["baht_rows_above_ibm_max_pct"] = float((te_baht.MonthlyIncome > raw.MonthlyIncome.max()).mean() * 100)
out["test_auc_if_income_uploaded_in_baht"] = roc_auc_score(yte, p_b)
out["distinct_income_effect_values_baht"] = int(
    len(np.unique(np.round(model.predict_proba(Xb.assign(**{c: Xb[c].iloc[0] for c in Xb.columns if c != "MonthlyIncome"}))[:, 1], 6))))
out["spearman_rank_orig_vs_baht"] = float(pd.Series(p_te).corr(pd.Series(p_b), method="spearman"))

# silent bad categories (what /recalibrate accepts today)
bad = raw.iloc[te[:2]].copy()
bad.iloc[0, bad.columns.get_loc("BusinessTravel")] = "Travel_Sometimes"
bad.iloc[1, bad.columns.get_loc("Department")] = "Sales "
fb = features(pd.concat([bad, raw], ignore_index=True))
out["bad_businesstravel_encoded_as"] = str(fb.loc[0, "BusinessTravel"])
out["bad_department_onehot_row"] = fb.loc[1, [c for c in fb.columns if c.startswith("Department_")]].to_dict()
Xbad = fb.iloc[:2].drop(columns=TARGET_COLUMN)[X.columns]
out["bad_rows_score_vs_original"] = [
    [float(a), float(b)] for a, b in zip(model.predict_proba(Xbad)[:, 1], p_te[:2])]

print(json.dumps(out, ensure_ascii=False, indent=1, default=float))
```

</details>

<details>
<summary>ผลที่ได้ ณ วันตรวจ (1 ต.ค. 2026, commit 45f926a บรรทัด bootstrap รันใหม่ด้วย 10,000 รอบ)</summary>

```text
test_auc                             0.8141   (train_auc 0.9564)
test set                             294 คน, ลาออก 47 คน
test_auc bootstrap 95% CI            0.734 – 0.884
in-sample bands (1,470 คน)            High 185 / Medium 274 / Low 1011   → High ลาออกจริง 83.2%
out-of-fold bands (1,470 คน)          High 157 / Medium 334 / Low 979    → High ลาออกจริง 66.2%
ลาออกจริงทั้งชุด                       237 คน
MonthlyIncome range                  1,009 – 19,999   (จุดตัดสูงสุดในโมเดล 17,465 จาก 126 จุด)
อัปโหลดเป็นบาท (×35)                  เกินช่วง 100%, test AUC 0.796, ผลของเงินเดือนเหลือค่าเดียว
BusinessTravel="Travel_Sometimes"    → NaN, คะแนน 0.663 → 0.866
Department="Sales "                  → one-hot 0 ทั้งแถว, คะแนน 0.066 → 0.093
ฟีเจอร์ในโมเดล                         50 คอลัมน์ รวม Gender, Age, MaritalStatus_*
```

</details>

---

## ภาคผนวก รอบ 2

รันจากรากโปรเจกต์ด้วย `.venv` ทุกคำสั่งอ่านอย่างเดียว ไม่แก้ไฟล์ในโปรเจกต์ และไม่เขียนอะไรขึ้น MLflow/DagsHub/GitHub

### A. ผล CI และ test

```bash
gh run list -L 5                                   # run ของ 45f926a: completed/success
gh run view <run-id> --json jobs --jq '.jobs[] | .name, (.steps[] | "  \(.name): \(.conclusion)")'
gh run view <run-id> --log | grep -E "passed|test_auc|registered:|All checks passed"
.venv/Scripts/python.exe -m ruff check .
PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest backend -q
```

ผล ณ วันตรวจ:

| รายการ | ผล |
| :--- | :--- |
| CI run ของ `45f926a` ([ลิงก์](https://github.com/InkSpuDek66/employee-attrition-predictor/actions/runs/36728127930)) | ผ่านทุก step ของทั้ง 2 job |
| ใน log ของ CI | `ruff: All checks passed!` · `train.py: {'test_auc': 0.809, 'test_pr_auc': 0.589, 'test_f1': 0.504}` · `pytest: 17 passed` · `oxlint: 0 warnings and 0 errors` |
| ในเครื่องที่ `fc4a969` | `ruff: All checks passed!` · `pytest: 17 passed, 4 warnings` (warning มาจาก shap/matplotlib ไม่ใช่โค้ดของทีม) |
| เวอร์ชันใน CI เทียบกับ `.venv` | xgboost 3.4.1 · scikit-learn 1.9.1 · numpy 2.5.3 · pandas 3.0.6 · shap 0.52.0 · mlflow 3.16.1 · scipy 1.18.1 ตรงกันทุกตัว (Python 3.13.15 บน CI, 3.13.11 ในเครื่อง) |

### B. จำนวน thread กับโมเดลที่ได้ (DE-08)

```python
import sys; sys.path.insert(0, "src")
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
from clean_pipeline import TARGET_COLUMN, clean_data, load_raw_data, RAW_FILENAME
from feature_pipeline import SELECTED_FEATURES, add_features
from train import PARAMS
df = add_features(clean_data(load_raw_data(f"data/raw/{RAW_FILENAME}")), only=SELECTED_FEATURES)
X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN]
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
spw = (ytr == 0).sum() / (ytr == 1).sum()
for nj in (1, 2, 4, 8):
    aucs = {round(roc_auc_score(yte, XGBClassifier(**PARAMS, scale_pos_weight=spw, random_state=42, n_jobs=nj)
                                 .fit(Xtr, ytr).predict_proba(Xte)[:, 1]), 4) for _ in range(2)}
    print("n_jobs", nj, "test AUC", aucs)
```

ผล: `n_jobs 1 → 0.8047` · `2 → 0.8109` · `4 → 0.8141` · `8 → 0.8151` (รัน 2 รอบต่อค่า ได้ผลเดิมทุกครั้ง)

### C. เทียบ v1 จาก DagsHub กับโมเดลที่เทรนซ้ำ

ต้องมี `.env` ที่ชี้ DagsHub (อ่านอย่างเดียว เหมือนที่ backend ทำ)

```python
import sys; sys.path.insert(0, "src")
import numpy as np, mlflow.xgboost
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
import mlflow_setup
from clean_pipeline import TARGET_COLUMN, clean_data, load_raw_data, RAW_FILENAME
from feature_pipeline import SELECTED_FEATURES, add_features
from train import PARAMS
mlflow_setup.setup()
v1 = mlflow.xgboost.load_model("models:/attrition-xgboost-P/1")
df = add_features(clean_data(load_raw_data(f"data/raw/{RAW_FILENAME}")), only=SELECTED_FEATURES)
X, y = df.drop(columns=TARGET_COLUMN)[v1.feature_names_in_], df[TARGET_COLUMN]
Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
rep = XGBClassifier(**PARAMS, scale_pos_weight=(ytr == 0).sum() / (ytr == 1).sum(), random_state=42, n_jobs=4).fit(Xtr, ytr)
print(np.abs(v1.predict_proba(X)[:, 1] - rep.predict_proba(X)[:, 1]).max())
```

ผล: `0.0` (ตรงกันทั้ง 1,470 แถว) · ระดับความเสี่ยงของ v1 คือ High / Medium / Low = 185 / 274 / 1011 · คะแนนพนักงาน 1 = 0.691 · test AUC 0.8141, F1@0.5 0.488 (เตือน 76 คน)

### D. Fairness เบื้องต้น (DS-04)

<details>
<summary>โค้ด fairness_prelim.py</summary>

```python
"""Preliminary fairness numbers for the DE review (not a replacement for the team's Fairlearn check).

Group metrics use out-of-fold scores (5-fold, same params as src/train.py) so every employee is scored by a model that
did not see them. The counterfactual uses a replica of attrition-xgboost-P v1 (same split/params/seed as src/train.py,
identical to v1 row by row on this machine).
Run from the project root: python fairness_prelim.py
"""
import json
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from xgboost import XGBClassifier

sys.path.insert(0, "src")
from clean_pipeline import RAW_FILENAME, TARGET_COLUMN, clean_data, load_raw_data  # noqa: E402
from feature_pipeline import SELECTED_FEATURES, add_features  # noqa: E402
from train import BOOT_N, BOOT_SEED, PARAMS  # noqa: E402

raw = load_raw_data(f"data/raw/{RAW_FILENAME}")
df = add_features(clean_data(raw), only=SELECTED_FEATURES)
X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN].to_numpy()
spw = (y == 0).sum() / (y == 1).sum()
model = XGBClassifier(**PARAMS, scale_pos_weight=spw, random_state=42, n_jobs=4)
oof = cross_val_predict(model, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=42), method="predict_proba")[:, 1]

groups = {
    "Gender": raw["Gender"],
    "AgeBand": pd.cut(raw["Age"], [0, 29, 39, 49, 100], labels=["18-29", "30-39", "40-49", "50+"]).astype(str),
    "MaritalStatus": raw["MaritalStatus"],
}


def metrics(yy, pp):
    flag = pp >= 0.5
    return {
        "n": len(yy), "attrition_rate": yy.mean(), "mean_score": pp.mean(),
        "selected@0.5": flag.mean(), "selected_High@0.7": (pp >= 0.7).mean(),
        "TPR@0.5": flag[yy == 1].mean(), "FPR@0.5": flag[yy == 0].mean(),
        "precision@0.5": yy[flag].mean() if flag.any() else np.nan,
        "AUC": roc_auc_score(yy, pp) if 0 < yy.sum() < len(yy) else np.nan,
    }


rng = np.random.default_rng(BOOT_SEED)
for name, g in groups.items():
    g = g.to_numpy()
    table = pd.DataFrame({k: metrics(y[g == k], oof[g == k]) for k in sorted(set(g))}).T
    print(f"\n=== {name} (OOF, threshold 0.5 unless stated)")
    print(table.round(3).to_string())
    sel, tpr = table["selected@0.5"], table["TPR@0.5"]
    print(f"selection-rate ratio min/max = {sel.min() / sel.max():.2f} | TPR gap max-min = {tpr.max() - tpr.min():.3f} "
          f"| FPR gap = {table['FPR@0.5'].max() - table['FPR@0.5'].min():.3f}")
    gaps = []  # bootstrap 95% CI of the TPR gap (resample employees)
    for _ in range(BOOT_N):
        i = rng.integers(0, len(y), len(y))
        yi, pi, gi = y[i], oof[i], g[i]
        t = [((pi[(gi == k) & (yi == 1)]) >= 0.5).mean() for k in sorted(set(g)) if ((gi == k) & (yi == 1)).any()]
        gaps.append(max(t) - min(t))
    print(f"TPR gap bootstrap 95% CI: {np.percentile(gaps, 2.5):.3f} - {np.percentile(gaps, 97.5):.3f}")

# counterfactual on the v1 replica: flip Gender for everyone, keep everything else
Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
v1 = XGBClassifier(**PARAMS, scale_pos_weight=(ytr == 0).sum() / (ytr == 1).sum(), random_state=42, n_jobs=4).fit(Xtr, ytr)
p0 = v1.predict_proba(X)[:, 1]
p1 = v1.predict_proba(X.assign(Gender=1 - X["Gender"]))[:, 1]
band = lambda p: np.where(p >= 0.7, 2, np.where(p >= 0.4, 1, 0))  # noqa: E731
print("\n=== Counterfactual on v1 replica: flip Gender only")
print(f"mean |score change| = {np.abs(p1 - p0).mean():.4f} | max = {np.abs(p1 - p0).max():.4f} "
      f"| employees whose risk band changes = {int((band(p0) != band(p1)).sum())} of {len(p0)}")


def splits_on(tree, feature):
    stack, n = [tree], 0
    while stack:
        node = stack.pop()
        n += node.get("split") == feature
        stack.extend(node.get("children", []))
    return n


dumps = [json.loads(t) for t in v1.get_booster().get_dump(dump_format="json")]
print(f"trees splitting on Gender: {sum(splits_on(t, 'Gender') > 0 for t in dumps)} of {len(dumps)}")
```

</details>

ผล ณ วันตรวจ (บรรทัด bootstrap รันใหม่ด้วย 10,000 รอบ):

```text
=== Gender (OOF, threshold 0.5 unless stated)
            n  attrition_rate  mean_score  selected@0.5  selected_High@0.7  TPR@0.5  FPR@0.5  precision@0.5    AUC
Female  588.0           0.148       0.325         0.226              0.109    0.678    0.148          0.444  0.831
Male    882.0           0.170       0.330         0.238              0.109    0.627    0.158          0.448  0.828
selection-rate ratio min/max = 0.95 | TPR gap max-min = 0.051 | FPR gap = 0.011
TPR gap bootstrap 95% CI: 0.003 - 0.178
=== AgeBand (OOF, threshold 0.5 unless stated)
           n  attrition_rate  mean_score  selected@0.5  selected_High@0.7  TPR@0.5  FPR@0.5  precision@0.5    AUC
18-29  326.0           0.279       0.471         0.442              0.258    0.791    0.306          0.500  0.843
30-39  622.0           0.143       0.301         0.178              0.082    0.640    0.101          0.514  0.839
40-49  349.0           0.097       0.259         0.143              0.040    0.412    0.114          0.280  0.781
50+    173.0           0.133       0.296         0.220              0.064    0.435    0.187          0.263  0.704
selection-rate ratio min/max = 0.32 | TPR gap max-min = 0.379 | FPR gap = 0.205
TPR gap bootstrap 95% CI: 0.254 - 0.599
=== MaritalStatus (OOF, threshold 0.5 unless stated)
              n  attrition_rate  mean_score  selected@0.5  selected_High@0.7  TPR@0.5  FPR@0.5  precision@0.5    AUC
Divorced  327.0           0.101       0.240         0.135              0.052    0.636    0.078          0.477  0.890
Married   673.0           0.125       0.290         0.184              0.077    0.488    0.141          0.331  0.747
Single    470.0           0.255       0.444         0.372              0.194    0.758    0.240          0.520  0.847
selection-rate ratio min/max = 0.36 | TPR gap max-min = 0.270 | FPR gap = 0.162
TPR gap bootstrap 95% CI: 0.151 - 0.407
=== Counterfactual on v1 replica: flip Gender only
mean |score change| = 0.0204 | max = 0.0825 | employees whose risk band changes = 60 of 1470
trees splitting on Gender: 12 of 500
```
