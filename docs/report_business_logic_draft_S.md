# ร่างรายงาน: Business Logic / Financial Impact / Model Localization — Saphondanai

> **สถานะ: ร่าง** เขียนจากโค้ดใน repo ณ วันที่ 30 ก.ย. 2026 (branch `dev001-Ink`)
> ตัวเลขผลโมเดลมาจาก `notebooks/04_tuning_S.ipynb` ก่อนใส่รายงานจริงต้องอัปเดตให้ตรงกับโมเดลสุดท้ายที่ทีมเลือก

## 1. ภาพรวมส่วนที่รับผิดชอบ

| ส่วน | ไฟล์ | README |
| :--- | :--- | :--- |
| MLflow กลางของทีม | `src/mlflow_setup.py`, `.env.example`, `docs/mlflow_setup.md` | 8 |
| Train + tune XGBoost (คู่ขนานกับ Puripat) | `notebooks/04_tuning_S.ipynb` | 10.3 wk2–3 |
| Risk Banding + Financial Impact | `src/business_rules.py`, `config/financial_impact.json` | 6.1, 6.3 |
| Company-wide Aggregate Summary | `src/company_summary.py` | 6.6 |
| API | `POST /predict`, `POST /whatif`, `GET /financial-impact/{id}`, `GET /company-summary/departments` | 7 |
| Frontend | `frontend/src/WhatIfSimulator.jsx` | 3 (Act) |

## 2. Train + Tune XGBoost (คู่ขนานกับ Puripat)

ใช้ split เดียวกับ Puripat (80/20, seed 42) แต่ค้นคนละทาง: (1) ทดลองตัดฟีเจอร์ตาม Localization (2) tune ด้วย **PR-AUC** แทน ROC AUC เพราะคนลาออกมีแค่ 16% (3) เทียบสองโมเดลบน test ชุดเดียวกัน

**ชุดฟีเจอร์ (CV 5-fold x 3 รอบบน train, hyperparameter ตั้งต้น):**

| ชุด | จำนวนฟีเจอร์ | CV AUC | CV PR-AUC |
| :--- | ---: | ---: | ---: |
| P_selected (ชุดของ Puripat) | 50 | 0.799 | 0.591 |
| localized (ตัด BusinessTravel, StockOptionLevel) | 48 | 0.788 | 0.556 |
| localized_lean (ตัดอัตราค่าจ้าง 3 คอลัมน์เพิ่ม) | 45 | 0.793 | 0.570 |

กติกาที่ตั้งก่อนดูผล: เลือกชุด localized ถ้าแพ้ไม่เกิน 0.01 PR-AUC ผลคือแพ้ 0.02–0.036 จึง **ยืนยันชุดของ Puripat** ความเสี่ยงเรื่องใช้ในไทยจัดการด้วย recalibration และคำแนะนำแบบไทยแทน

**เทียบโมเดล (หลัง tune):**

| โมเดล | CV AUC | CV PR-AUC | test AUC | test PR-AUC | test F1 | recall@top20% |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| P (tune ด้วย AUC) | 0.827 | 0.636 | 0.814 | 0.609 | 0.488 | 0.596 |
| S (tune ด้วย PR-AUC) | 0.824 | 0.631 | 0.807 | 0.592 | 0.496 | 0.574 |

- tune สองทางได้ hyperparameter ใกล้กันมาก (max_depth 2, min_child_weight 10, colsample ~0.53)
- ต่างกันไม่เกิน 0.017 อยู่ในระดับ noise (test มีคนลาออกแค่ 47 คน) **เสนอใช้โมเดล P เป็นโมเดลสุดท้าย** รอยืนยันกับ Puripat
- ถ้า HR ดูแลได้ 20% ของพนักงานที่คะแนนสูงสุด โมเดลจะครอบคลุมคนที่ลาออกจริงประมาณ 60%

## 3. Risk Banding (README 6.1)

```
risk_score >= 0.7        -> High   (สูง)
0.4 <= risk_score < 0.7  -> Medium (ปานกลาง)
risk_score < 0.4         -> Low    (ต่ำ)
```

- ถ้าบริษัท recalibrate แล้ว ระบบแบ่งระดับจาก `calibrated_risk_score` แทน `risk_score` ดิบ
- ค่า 0.4/0.7 เป็นค่าตั้งต้นตาม README ยังไม่ได้ปรับตามการกระจายคะแนนจริง ด้วยโมเดลปัจจุบัน พนักงาน 1,470 คนแบ่งเป็น High 170 / Medium 313 / Low 987 คน

## 4. Financial Impact (README 6.3, อิงกฎหมายแรงงานไทย)

### 4.1 สูตร

```
daily_wage        = MonthlyIncome / 30
severance_pay     = daily_wage x วันค่าชดเชยตามอายุงาน (มาตรา 118)
hiring_cost       = MonthlyIncome x 12 x ตัวคูณตาม JobLevel
replacement_cost  = hiring_cost (+ severance_pay เมื่อ include_severance = true)
retain_cost       = MonthlyIncome x จำนวนเดือนตามมาตรการที่เลือก
net_benefit       = replacement_cost - retain_cost          (README: ROI)
expected_loss     = risk_score x replacement_cost
```

### 4.2 ตารางค่าชดเชย มาตรา 118 (พ.ร.บ.คุ้มครองแรงงาน ฉบับที่ 7 พ.ศ. 2562)

| อายุงาน | ค่าจ้าง |
| :--- | :--- |
| ครบ 120 วัน แต่ไม่ครบ 1 ปี | 30 วัน |
| ครบ 1 ปี แต่ไม่ครบ 3 ปี | 90 วัน |
| ครบ 3 ปี แต่ไม่ครบ 6 ปี | 180 วัน |
| ครบ 6 ปี แต่ไม่ครบ 10 ปี | 240 วัน |
| ครบ 10 ปี แต่ไม่ครบ 20 ปี | 300 วัน |
| ครบ 20 ปีขึ้นไป | 400 วัน |

### 4.3 การตัดสินใจเชิงออกแบบ

1. **ไม่รวมค่าชดเชยในต้นทุนการลาออกโดยค่าเริ่มต้น** ค่าชดเชยตามมาตรา 118 จ่ายเมื่อ *นายจ้างเลิกจ้าง* ส่วนพนักงานที่ *ลาออกเอง* ไม่มีสิทธิ์ได้รับ การบวกค่าชดเชยเข้าไปทุกกรณีจะทำให้ต้นทุนสูงเกินจริง จึงแยกเป็นตัวเลือก `include_severance` ใช้ในกรณีที่บริษัทพิจารณาเลิกจ้างแทนการรักษาไว้
2. **ตัวเลขทั้งหมดอยู่ใน `config/financial_impact.json`** แยกจากโค้ดตาม README 6.3 เมื่อกฎหมายหรือสมมติฐานของบริษัทเปลี่ยน แก้ไฟล์เดียวโดยไม่ต้อง retrain หรือแก้โค้ด
3. **ตัวคูณต้นทุนหาคนแทนไล่ตาม JobLevel (0.5–2.0 เท่าของเงินเดือนปี)** ตามเบนช์มาร์กสากลใน README เพราะตำแหน่งสูงหาคนแทนยากและใช้เวลาเรียนรู้นานกว่า
4. **อายุงาน 0 ปีนับค่าชดเชยเป็น 0 วัน** `YearsAtCompany` ใน dataset เป็นจำนวนเต็ม แยกไม่ได้ว่าครบ 120 วันหรือยัง จึงประมาณต่ำไว้ก่อน

### 4.4 ข้อจำกัด

- **หน่วยเงิน:** IBM dataset ไม่ระบุสกุลเงินของ `MonthlyIncome` ตัวเลขจึงเป็น "หน่วยตามข้อมูล" ไม่ใช่บาท เมื่อบริษัทไทยใช้ข้อมูลของตัวเอง ตัวเลขจะเป็นบาทโดยอัตโนมัติ
- **`expected_loss` สูงเกินจริงก่อน recalibrate:** โมเดลเทรนด้วย `scale_pos_weight` ทำให้คะแนนสูงกว่าความน่าจะเป็นจริง ใช้จัดลำดับความสำคัญได้ แต่ไม่ควรอ่านเป็นยอดเงินที่จะเสียจริง
- **ต้นทุนมาตรการเป็นสมมติฐาน** (เช่น ขึ้นเงินเดือน 10% = 1.2 เดือน/ปี) ยังไม่มีข้อมูลต้นทุนจริงของบริษัทไทย

## 5. Company-wide Aggregate Summary (README 6.6)

- จัดอันดับปัจจัยด้วย `mean(|SHAP|)` **โดยรวมคอลัมน์ one-hot กลับเป็นฟีเจอร์เดิม** (เช่น `JobRole_Sales Executive`, `JobRole_Manager`, … → `JobRole`) ทำได้เพราะ SHAP บวกกันได้ ถ้าไม่รวม ฟีเจอร์หมวดหมู่จะถูกแบ่งเป็นชิ้นเล็กและดูสำคัญน้อยกว่าความจริง
- ทุกปัจจัยมีธง `actionable` ปัจจัยที่บริษัทปรับได้ (OT, เงินเดือน, ความพึงพอใจ ฯลฯ) มีคำแนะนำเชิงนโยบาย ส่วนข้อมูลส่วนตัว (อายุ, สถานภาพ, เพศ) ระบุชัดว่า **ห้ามใช้เป็นเกณฑ์คัดเลือกหรือเลือกปฏิบัติ** เชื่อมกับ Fairness check (README 6.4)
- คำแนะนำใช้ถ้อยคำเชิงทิศทาง ("น่าจะช่วย") เพราะ SHAP บอกความสัมพันธ์กับโมเดล ไม่ใช่เหตุและผล
- `StockOptionLevel` แนะนำ "สวัสดิการระยะยาว เช่น สมทบกองทุนสำรองเลี้ยงชีพ" แทนสิทธิ์ซื้อหุ้น ซึ่งพบน้อยในบริษัทไทย
- `GET /company-summary/departments` สรุปทุกแผนกในครั้งเดียว เรียงตามมูลค่าความเสี่ยงรวม ให้ HR เห็นว่าควรเริ่มจากแผนกไหน

**ผลทั้งบริษัท (โมเดล `attrition-xgboost-S` v1):** ปัจจัยเด่น 5 อันดับ ได้แก่ `StockOptionLevel`, `JobRole`, `AvgSatisfaction`, `OverTime`, `OverTimeXDistance` (สัดส่วน 6–7% ต่อตัว) ถ้าไม่รวม one-hot กลับ `JobRole` จะไม่ติด 5 อันดับแรกเลย

| แผนก | คน | คะแนนเฉลี่ย | High / Medium / Low | ปัจจัยเด่น 3 อันดับ |
| :--- | ---: | ---: | :--- | :--- |
| Research & Development | 961 | 0.302 | 89 / 178 / 694 | JobRole, StockOptionLevel, AvgSatisfaction |
| Sales | 446 | 0.415 | 73 / 121 / 252 | StockOptionLevel, AvgSatisfaction, OverTime |
| Human Resources | 63 | 0.361 | 8 / 14 / 41 | StockOptionLevel, OverTime, MonthlyIncome |

Sales มีคะแนนเฉลี่ยสูงสุด แต่ R&D มีมูลค่าความเสี่ยงรวมสูงสุดเพราะคนมากกว่า 2 เท่า

## 6. Model Localization (README 6.5)

กลไกหลักคือ `POST /recalibrate` (Puripat) ส่วนที่เพิ่มในงานนี้:

1. **เลือกโมเดลโดยคำนึงถึงการใช้ในไทยตั้งแต่ตอนเทรน** ทดลองตัด `BusinessTravel` และ `StockOptionLevel` (README 4) และคอลัมน์อัตราค่าจ้างที่ไม่มีความหมาย ดูผลในหัวข้อ 2
2. **ทุก endpoint ที่คืนคะแนน** (`/predict`, `/whatif`, `/financial-impact`) รับ `tenant_id` ถ้าบริษัท recalibrate แล้วจะใช้คะแนนที่ปรับเทียบในการแบ่งระดับและคำนวณเงิน ถ้ายังไม่ได้ปรับจะแนบ `warning` ตาม README 6.5 ทุกครั้ง
3. **กฎหมายไทยอยู่ใน config** (มาตรา 118) ไม่ผูกกับโมเดล

## 7. API ส่วนของ Saphondanai

### 7.1 `POST /predict`

ระบุพนักงานได้สองแบบ (อย่างใดอย่างหนึ่ง): `employee_id` ของพนักงานที่มีในระบบ หรือ `employee` ข้อมูลทั้งก้อน (30 ฟิลด์ ตรวจชนิดและช่วงค่าด้วย Pydantic ค่าหมวดหมู่ที่โมเดลไม่รู้จักตอบ `422`)

```json
POST /predict  {"employee_id": 1}
```

```json
{"risk_score": 0.710, "calibrated_risk_score": null, "risk_band": "High", "risk_band_th": "สูง",
 "employee_id": 1, "warning": "ยังไม่ได้ปรับเทียบกับข้อมูลจริงของบริษัท — ..."}
```

### 7.2 `POST /whatif`

ส่ง `changes` เฉพาะฟิลด์ที่ต้องการเปลี่ยน คืนคะแนนก่อน/หลัง, `delta` (ติดลบ = เสี่ยงลดลง), ฟิลด์ที่เปลี่ยนจริง และข้อมูลหลังเปลี่ยน **ไม่บันทึกลง database**

```json
POST /whatif  {"employee_id": 1, "changes": {"OverTime": "No", "WorkLifeBalance": 4}}
```

```json
{"before": {"risk_score": 0.710, "risk_band": "High"},
 "after":  {"risk_score": 0.383, "risk_band": "Low"},
 "delta": -0.327, "changes_applied": {"OverTime": "No", "WorkLifeBalance": 4},
 "note": "ผลจำลองจากโมเดล ไม่ได้บันทึกลงระบบ และไม่รับประกันว่าทำจริงแล้วความเสี่ยงจะลดตามนี้"}
```

ตัวอย่าง `/financial-impact/1` (ขึ้นเงินเดือน 10%): ต้นทุนหาคนแทน 53,937, ต้นทุนมาตรการ 7,192, ส่วนต่าง 46,745 (อายุงาน 6 ปี ถ้าเป็นการเลิกจ้างจะมีค่าชดเชย 240 วัน = 47,944 แยกไว้ไม่รวม)

การตรวจข้อมูล: ฟิลด์ที่ไม่รู้จัก หรือค่าหลังเปลี่ยนผิดช่วง (เช่น `WorkLifeBalance: 9`) ตอบ `422` เพราะตรวจข้อมูลหลังรวมการเปลี่ยนแปลงด้วย schema เดียวกับ `/predict`

### 7.3 `GET /financial-impact/{employee_id}`

พารามิเตอร์: `retention` (มาตรการ ดูรายการใน `retention_options` ของ response), `include_severance`, `tenant_id`

### 7.4 `GET /company-summary/departments`

สรุปทุกแผนก (จำนวนคน, คะแนนเฉลี่ย, จำนวนตามระดับความเสี่ยง, มูลค่าความเสี่ยงรวม, ปัจจัยเด่น) เรียงตามมูลค่าความเสี่ยงรวม

## 8. What-if Simulator (React)

- โหลดพนักงานด้วยรหัส แล้วปรับเฉพาะ **ปัจจัยที่ HR ทำได้จริง** 14 ตัว (เงินเดือน, OT, การเดินทาง, ความพึงพอใจ, การอบรม ฯลฯ) ไม่เปิดให้ปรับข้อมูลส่วนตัว เช่น อายุ เพศ สถานภาพ
- คำนวณใหม่อัตโนมัติหลังหยุดปรับ 300ms (debounce) และยกเลิก request เก่าที่ยังไม่ตอบ (`AbortController`) ผลจึงไม่สลับลำดับเมื่อลากแถบเลื่อนเร็ว ๆ
- แสดงระดับความเสี่ยงก่อน/หลัง, คะแนนที่เปลี่ยน, ฟิลด์ที่ปรับแล้วไฮไลต์ และตาราง Retain vs Replace เลือกมาตรการได้

## 9. การทดสอบ

- `python -m pytest backend` ครอบคลุม: `/predict` ทั้งสองแบบให้ผลตรงกัน, input ผิด 5 แบบ, `/whatif` ไม่เปลี่ยนอะไรต้องเท่ากับ `/predict`, เลิก OT แล้วความเสี่ยงลด, ใช้ผล recalibrate ในการคำนวณ `delta`, สูตรเงินและตารางมาตรา 118 ทุกช่วงอายุงาน, การรวม one-hot ใน company summary
