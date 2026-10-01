# รายงานตรวจโปรเจกต์ มุมมอง UX/UI

| หัวข้อ | รายละเอียด |
| :--- | :--- |
| วันที่ตรวจ | 1 ต.ค. 2026 (ทีมอยู่ wk2 ช่วง Modeling) |
| เวอร์ชันที่ตรวจ | commit `45f926a` บน `main` (ตรงกับ `dev001-Ink` ณ วันตรวจ) |
| ผู้ตรวจ | Claude Code (AI, Claude Opus 5.5) รับบท senior UX/UI designer ตามคำขอของ Saphondanai |
| ผู้ดูแลเอกสาร | Saphondanai (ถามหรือแย้งได้ที่ Saphondanai) |
| สถานะ | รอทีมยืนยันผู้รับผิดชอบและกำหนดเสร็จ |
| เอกสารชุดเดียวกัน | [Data Engineering](review_data_engineering_S.md) · [Security](review_security_S.md) · UX/UI (ไฟล์นี้) |

**วิธีใช้เอกสารนี้**

1. อ่าน [1. สรุป](#1-สรุป) ก่อน
2. หาชื่อตัวเองใน [6. งานแยกรายคน](#6-งานแยกรายคน) แล้วกดลิงก์ไปอ่านรายละเอียด
3. แก้เสร็จแล้วให้ติ๊ก checkbox พร้อมใส่ commit hash
4. ถ้าไม่เห็นด้วยกับข้อไหน ให้เขียนเหตุผลไว้ใน [7. ความเห็นทีม](#7-ความเห็นทีม)

> ผู้รับผิดชอบที่ระบุในเอกสารนี้เป็นข้อเสนอ อ้างอิงจาก [TASKS.md](../TASKS.md) และผู้เขียนไฟล์ใน git log ทีมต้องยืนยันกันอีกครั้ง
> บัญชี git ที่ใช้อ้างอิง: `Ink-SPU` = Saphondanai, `NungUmSudNaRak` (commit ขึ้นต้น Dev007) = Puripat (อนุมานจาก commit ที่ตรงกับงานของ Puripat ใน TASKS.md)

---

## 1. สรุป

แต่ละ component ทำมาดี ใช้ภาษาไทยทั้งหน้า มีคำเตือนครบ และหน้า Streamlit ที่ใช้ทดสอบมี UX ที่คิดมาดีหลายจุด ปัญหาหลักอยู่ที่ภาพรวมของผลิตภัณฑ์ 3 ข้อ

1. ระบบบอกระดับความเสี่ยงของคนเดียวกันไม่ตรงกันบนหน้าเดียวกัน: พนักงาน 232 จาก 1,470 คน (16%) ได้ระดับต่างกัน (UX-01)
2. ไม่มีจุดเริ่มต้นให้ HR: ต้องรู้รหัสพนักงานก่อนถึงจะใช้งานได้ แต่คำถามแรกของ HR คือ "ใครเสี่ยงบ้าง" (UX-02)
3. ขั้น "Act" ขาดตอน: ต้นทุนของมาตรการกับผลของมาตรการแสดงแยกกัน ผู้ใช้จึงตอบไม่ได้ว่า "มาตรการไหนคุ้ม" ซึ่งเป็นฟีเจอร์หลักที่โปรเจกต์นำเสนอ (UX-03)

| ID | ระดับ | เรื่อง | ผู้รับผิดชอบ (เสนอ) | เสนอให้เสร็จ |
| :--- | :--- | :--- | :--- | :--- |
| [UX-01](#ux-01-ระดับความเสี่ยงของคนเดียวกันไม่ตรงกันระหว่าง-2-panel) | สูง | ระดับความเสี่ยงของคนเดียวกันไม่ตรงกันระหว่าง 2 panel | Puripat, Saphondanai review | ทำได้ทันที (< 1 ชม.) |
| [UX-02](#ux-02-ไม่มีจุดเริ่มต้นสำหรับคำถาม-ใครเสี่ยงบ้าง) | สูง | ไม่มีจุดเริ่มต้นสำหรับคำถาม "ใครเสี่ยงบ้าง" | ยังไม่มีเจ้าของใน TASKS.md ทีมต้องมอบหมาย | ก่อน Model Gate (wk8) |
| [UX-03](#ux-03-ต้นทุนมาตรการกับผลของมาตรการไม่เชื่อมกัน) | สูง | ต้นทุนมาตรการกับผลของมาตรการไม่เชื่อมกัน | Saphondanai | ก่อน Model Gate (wk8) |
| [UX-04](#ux-04-slider-ยอมให้ตั้งค่าที่เป็นไปไม่ได้) | กลาง | slider ยอมให้ตั้งค่าที่เป็นไปไม่ได้ | Saphondanai | ก่อน Model Gate (wk8) |
| [UX-05](#ux-05-การแสดงคะแนนชวนให้เข้าใจผิด) | กลาง | การแสดงคะแนนชวนให้เข้าใจผิด | Puripat + Saphondanai | ก่อน Model Gate (wk8) |
| [UX-06](#ux-06-แสดงเพศ-อายุ-สถานภาพ-เป็น-เหตุผล-ของความเสี่ยง) | กลาง | แสดงเพศ อายุ สถานภาพ เป็น "เหตุผล" ของความเสี่ยง | Puripat + Yanisa/Nanthamon | ก่อน Model Gate (wk8) |
| [UX-07](#ux-07-ปัจจัยแบบ-one-hot-อ่านยาก-และคำแปลซ้ำกัน-2-ที่) | กลาง | ปัจจัยแบบ one-hot อ่านยาก และคำแปลซ้ำกัน 2 ที่ | Puripat + Saphondanai | ก่อน Model Gate (wk8) |
| [UX-08](#ux-08-ตัวเลขไม่มีหน่วย) | กลาง | ตัวเลขไม่มีหน่วย (เงิน ระยะทาง) | Saphondanai | พร้อม DE-01 |
| [UX-09 – UX-12](#5-เรื่องรอง) | ต่ำ | สถานะ loading/error, accessibility, ความสม่ำเสมอ, การใช้คำ | ตามตาราง | ก่อน Product Gate |

**ระดับความรุนแรง**
- สูง: ผู้ใช้ได้ข้อมูลผิด หรือทำงานหลักของระบบไม่ได้
- กลาง: ผู้ใช้เข้าใจผิดหรือสับสนได้ง่าย
- ต่ำ: ขัดเกลาหรือทำให้เข้าถึงได้ดีขึ้น

---

## 2. ขอบเขตและขั้นตอนการตรวจ

### ผู้ใช้ที่ใช้เป็นเกณฑ์

| ผู้ใช้ | คำถามที่ต้องตอบได้ |
| :--- | :--- |
| HR ผู้ดูแลพนักงาน (ผู้ใช้หลัก) | ใครเสี่ยง → ทำไม → ควรทำอะไร → คุ้มไหม (ตรงกับ Predict → Explain → Act → Measure ใน README หัวข้อ 3) |
| ผู้บริหาร HR | ภาพรวมทั้งบริษัท/แผนก (Company Summary, Superset) |
| กรรมการ Defense | ตัวเลขเชื่อถือได้ไหม ระบบใช้อย่างรับผิดชอบไหม |

### ขั้นตอนที่ทำ

1. อ่านโค้ด UI ทุกหน้า
   - React: `frontend/index.html`, `src/App.jsx`, `ShapViewer.jsx`, `WhatIfSimulator.jsx`, `featureLabels.js`, `index.css`
   - Streamlit ทดสอบ: `src/test_app.py`, `src/app_pages/*.py`
   - API ที่ UI เรียกใช้ใน `backend/routers/`
2. เทียบกับหลักการ: [Nielsen's 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), [WCAG 2.2 ระดับ AA](https://www.w3.org/TR/WCAG22/) และหลักการออกแบบหน้าจอที่อธิบายผลของ AI
3. เทียบความสม่ำเสมอ: ระหว่าง React (ตัวผลิตภัณฑ์) กับ Streamlit (หน้าทดสอบ) และระหว่าง frontend กับ backend
4. คำนวณ contrast ของสี: ตามสูตร WCAG ([ภาคผนวก A](#a-contrast-ของสีตาม-wcag))
5. รันสคริปต์ตรวจ ([ภาคผนวก B](#b-เกณฑ์ระดับความเสี่ยงและความสัมพันธ์ระหว่างฟิลด์)) ด้วยโมเดลที่เทรนซ้ำในเครื่องตามสูตร `train.py` (test AUC 0.814 ตรงกับ v1) ไม่ log ขึ้น MLflow โดยวัดว่า:
   - เกณฑ์ที่ต่างกันทำให้ระดับเปลี่ยนกี่คน
   - ข้อมูลจริงมีความสัมพันธ์ระหว่างฟิลด์แบบไหน
   - EmployeeNumber มีช่องว่างเท่าไร

### สิ่งที่ยังไม่ได้ตรวจ (ข้อจำกัด)

- ไม่ได้เปิดแอปจริงและไม่มีภาพหน้าจอ: ผลทั้งหมดมาจากโค้ดและการคำนวณ (ทีมเลือกไว้แบบนี้)
- ไม่ได้ทดสอบกับผู้ใช้จริง (usability test) ไม่ได้ทดสอบด้วย screen reader และไม่ได้ทดสอบบนมือถือจริง
- ยังไม่มี Intervention Tracker, Company Summary panel และ Superset dashboard ให้ตรวจ (อยู่ในแผน wk8–9)

---

## 3. จุดที่ทำได้ดี (ควรรักษาไว้)

- ภาษาไทยทั้งหน้า: และตั้ง `<html lang="th">` ([index.html](../frontend/index.html)) ทำให้ screen reader อ่านเป็นภาษาไทย
- **ฟอร์มเข้าถึงได้:** ทุก input ถูกครอบด้วย `<label>`, error มี `role="alert"` และยังเก็บ focus ring ของ browser ไว้
- มีตารางคู่กับกราฟ SHAP: คนที่แยกสีไม่ออกหรือใช้ screen reader ยังอ่านทิศทางจากข้อความได้
- **What-if ลื่น:**
  - debounce 300ms + `AbortController` ไม่ยิง API ซ้อน
  - ไฮไลต์ช่องที่ถูกปรับ (`.changed`) และมีปุ่มคืนค่าเดิม
  - ไม่ให้ปรับข้อมูลส่วนตัว เช่น อายุ เพศ ([WhatIfSimulator.jsx:4](../frontend/src/WhatIfSimulator.jsx#L4))
- **ซื่อตรงกับผู้ใช้:** มีคำเตือนว่ายังไม่ปรับเทียบ, SHAP ไม่ใช่เหตุและผล, และค่าชดเชยมาตรา 118 ไม่นับเมื่อลาออกเอง
- **หน้า Streamlit ทดสอบมีหลายอย่างที่ควรย้ายเข้า React:**
  - อธิบาย AUC เป็นภาษาคน ("จัดลำดับถูก 81 จาก 100 คู่") และเตือนว่า accuracy ดูดีเกินจริง ([model_page.py:18-28](../src/app_pages/model_page.py#L18-L28))
  - มีปุ่มมาตรการสำเร็จรูป ([whatif_page.py:118-124](../src/app_pages/whatif_page.py#L118-L124))
  - เตือนเมื่อเงินเดือนอยู่นอกช่วงที่โมเดลเคยเห็น ([whatif_page.py:176-181](../src/app_pages/whatif_page.py#L176-L181))
  - แนะนำว่า "ใช้เป็นหัวข้อเริ่มคุยกับพนักงาน แล้วยืนยันจากการพูดคุย" ([common.py:173-174](../src/app_pages/common.py#L173-L174))

---

## 4. รายการที่ต้องแก้

ทุกข้อใช้โครงเดียวกัน: ปัญหา → หลักฐาน → ทำไมต้องแก้ → วิธีแก้ → เสร็จเมื่อ → ผู้รับผิดชอบ

### UX-01 ระดับความเสี่ยงของคนเดียวกันไม่ตรงกันระหว่าง 2 panel

ระดับ: สูง (Nielsen #4 Consistency and standards)

**ปัญหา:**
- [ShapViewer.jsx:6-15](../frontend/src/ShapViewer.jsx#L6-L15) ตัดระดับเองที่ฝั่ง frontend ด้วยเกณฑ์ 0.3 / 0.6 (มี comment ว่า "ponytail … ปรับเมื่อทีมตกลง")
- What-if ใช้ `risk_band` จาก API ซึ่งมาจาก [business_rules.py:22-23](../src/business_rules.py#L22-L23) เกณฑ์ 0.4 / 0.7 ตาม README หัวข้อ 6.1
- ทั้งสอง panel อยู่บนหน้าเดียวกัน ([App.jsx](../frontend/src/App.jsx))

**หลักฐาน (รันจริง):** มีพนักงาน 232 จาก 1,470 คน (16%) ที่สอง panel บอกระดับไม่ตรงกัน

| API / What-if → | SHAP Viewer บอกว่า | จำนวนคน |
| :--- | :--- | :--- |
| ต่ำ | ปานกลาง | 171 |
| ปานกลาง | สูง | 61 |

**ทำไมต้องแก้:**
- HR เปิดดูพนักงานคนเดียวกัน panel บนบอก "สูง" แต่ panel ล่างบอก "ปานกลาง" ความเชื่อถือต่อระบบหายทันที
- ถ้าเกิดตอน demo ต่อหน้ากรรมการ จะตอบยาก

**วิธีแก้:**
1. ให้ `/shap` คืน `risk_band` และ `risk_band_th` จาก server ใช้ `score()` ใน [routers/predict.py](../backend/routers/predict.py) ตัวเดียวกับ What-if (ได้การจัดการ calibration ครบในที่เดียวด้วย)
2. ลบ `LOW`, `HIGH` และ `riskLevel()` ออกจาก `ShapViewer.jsx` แล้วใช้สีตาม `risk_band` แบบเดียวกับ `BAND_COLOR` ใน [WhatIfSimulator.jsx:26](../frontend/src/WhatIfSimulator.jsx#L26)
3. แก้ข้อความ "(เกณฑ์ประมาณ: ต่ำ < 30, สูง > 60)" ที่ [ShapViewer.jsx:85](../frontend/src/ShapViewer.jsx#L85) ให้ใช้ค่าจาก API หรือลบออก
4. **หลักทั่วไป:** frontend ห้ามมีเกณฑ์ธุรกิจของตัวเอง ให้มาจาก `business_rules` ที่เดียว

**เสร็จเมื่อ:** ใน frontend ไม่มีเลข 0.3/0.6/0.4/0.7 และพนักงานคนเดียวกันได้ระดับเดียวกันทุกหน้า รวม Streamlit

**ผู้รับผิดชอบ:** Puripat (เจ้าของ `/shap` และ `ShapViewer.jsx`), Saphondanai review (เจ้าของ `business_rules.py`)

---

### UX-02 ไม่มีจุดเริ่มต้นสำหรับคำถาม "ใครเสี่ยงบ้าง"

ระดับ: สูง (Nielsen #6 Recognition rather than recall)

**ปัญหา:**
- ทุก panel เริ่มจากให้พิมพ์รหัสพนักงานเอง (ค่าเริ่มต้นคือ `1`) ไม่มีรายชื่อ ไม่มีการค้นหา ไม่มีการเรียงตามความเสี่ยง
- SHAP Viewer กับ What-if ยังมีช่องรหัสพนักงานแยกกันคนละช่อง ([ShapViewer.jsx:55-58](../frontend/src/ShapViewer.jsx#L55-L58), [WhatIfSimulator.jsx:134-137](../frontend/src/WhatIfSimulator.jsx#L134-L137))
- EmployeeNumber มีตั้งแต่ 1 ถึง 2068 แต่มีจริงแค่ 1,470 เลข (เช่น 3, 6, 9 ไม่มี) พิมพ์เลขเดาจึงเจอ "ไม่พบพนักงาน" บ่อย
- ใน TASKS.md ยังไม่มีใครรับงาน "หน้ารายชื่อพนักงานเสี่ยง" (Company Summary panel เป็นภาพรวมรายแผนก ไม่ใช่รายคน)

**ทำไมต้องแก้:**
- ขั้น Predict ใน README หัวข้อ 3 คือ "HR รู้ว่าใครเสี่ยง" ถ้าต้องรู้รหัสก่อน ระบบก็ตอบคำถามแรกไม่ได้
- demo จะต้องพิมพ์เลขที่เตรียมไว้ล่วงหน้า ซึ่งดูไม่เป็นผลิตภัณฑ์จริง

**วิธีแก้:**
1. **Backend:** `GET /employees?department=&band=&sort=risk&limit=` คืนรหัส แผนก ตำแหน่ง ระดับ และคะแนน อ่านจากตาราง batch ตาม DE-04 (ใช้คะแนน out-of-fold ตาม DE-07) และต้องผ่าน auth ตาม [SEC-01](review_security_S.md#sec-01-api-ไม่มีการยืนยันตัวตน-และคืนข้อมูลส่วนตัวทั้งก้อน)
2. หน้ารายชื่อ: เป็นตารางเรียงตามความเสี่ยง กรองตามแผนกและระดับได้ เป็นหน้าแรกของแอป
3. หน้ารายละเอียดพนักงาน: คลิกจากตารางแล้วเปิดหน้าเดียวที่มี 3 ส่วนต่อกัน ใช้รหัสพนักงานร่วมกัน:
   1. ระดับ + เหตุผล (SHAP)
   2. What-if
   3. ต้นทุน
   
   แล้วลบช่องรหัสพนักงานที่ซ้ำกันออก

**เสร็จเมื่อ:** HR เปิดแอปแล้วเห็นรายชื่อคนที่ควรดูแลก่อนทันที และคลิกไปดูรายละเอียดได้โดยไม่ต้องพิมพ์รหัส

**ผู้รับผิดชอบ:** ต้องมอบหมายในที่ประชุม ข้อเสนอ:
- Nanthamon + Yanisa: ทำหน้ารายชื่อต่อจาก Company Summary panel เพราะใช้ข้อมูลชุดเดียวกัน
- Saphondanai + Puripat: ทำ `GET /employees` และหน้ารายละเอียด เพราะเป็นเจ้าของ component เดิม

---

### UX-03 ต้นทุนมาตรการกับผลของมาตรการไม่เชื่อมกัน

ระดับ: สูง (Nielsen #2 Match between system and the real world)

**ปัญหา:** ใน React [WhatIfSimulator.jsx:183-209](../frontend/src/WhatIfSimulator.jsx#L183-L209)
- dropdown "มาตรการรักษาคน" (เช่น "ขึ้นเงินเดือน 10%") เปลี่ยนแค่ตัวเลขต้นทุน ไม่เปลี่ยน slider ความเสี่ยงจึงไม่ขยับตาม
- ถ้าลาก slider เอง ต้นทุนก็ไม่เปลี่ยนตาม
- หน้า Streamlit ทดสอบมีปุ่ม "ปิด OT", "ขึ้นเงินเดือน 10%", "เลื่อนตำแหน่ง" ที่เปลี่ยนหลายค่าพร้อมกันอย่างสมเหตุสมผลแล้ว ([whatif_page.py:118-124](../src/app_pages/whatif_page.py#L118-L124)) แต่ไม่ได้ย้ายมาใน React

**ทำไมต้องแก้:**
- คำถามจริงของ HR คือ "ถ้าทำมาตรการนี้ ความเสี่ยงลดเท่าไร และคุ้มกับเงินที่จ่ายไหม" ตอนนี้ต้องต่อสองส่วนเองในหัว
- ขั้น Act ใน README หัวข้อ 3 และ Financial Impact ในหัวข้อ 6.3 คือฟีเจอร์หลักที่โปรเจกต์นำเสนอ

**วิธีแก้:**
1. ให้ preset มาจาก config ที่เดียว: เพิ่มการเปลี่ยนค่าฟีเจอร์ของแต่ละมาตรการใน [config/financial_impact.json](../config/financial_impact.json) เช่น
   ```json
   "salary_raise_10pct": {"label": "...", "months_of_salary": 1.2, "whatif": {"MonthlyIncome": {"multiply": 1.1}}},
   "reduce_overtime":    {"label": "...", "months_of_salary": 2.0, "whatif": {"OverTime": {"set": "No"}}},
   "training_and_promotion_track": {"label": "...", "months_of_salary": 0.5,
                                    "whatif": {"JobLevel": {"add": 1}, "YearsSinceLastPromotion": {"set": 0}}}
   ```
   มาตรการที่ไม่มีฟีเจอร์ในโมเดลรองรับ (เช่น โบนัสรักษาคน) ให้บอกผู้ใช้ตรง ๆ ว่า "โมเดลวัดผลมาตรการนี้ไม่ได้"
2. **React:** ใช้ปุ่มมาตรการแทน dropdown กดแล้วจะตั้ง slider ที่เกี่ยวข้องและเลือกต้นทุนของมาตรการนั้นพร้อมกัน
3. แสดงผลเป็นบรรทัดเดียวที่ตอบคำถาม: เช่น "ปิด OT: ความเสี่ยง 68 → 41 (−27) · ต้นทุนมาตรการ X · มูลค่าความเสี่ยงลดลง Y" พร้อมหมายเหตุว่าใช้เทียบระหว่างมาตรการ ไม่ใช่เงินจริง (ดู DE-07)
4. Streamlit: อ่าน preset จาก config ตัวเดียวกัน

**เสร็จเมื่อ:**
- เลือกมาตรการครั้งเดียวแล้วเห็นทั้ง "ความเสี่ยงหลังทำ" และ "ต้นทุน" ของมาตรการนั้น
- React และ Streamlit ใช้ preset ชุดเดียวกันจาก config

**ผู้รับผิดชอบ:** Saphondanai (เจ้าของ What-if, `business_rules`, config) ส่วน Puripat ปรับหน้า Streamlit ให้อ่าน config

---

### UX-04 Slider ยอมให้ตั้งค่าที่เป็นไปไม่ได้

ระดับ: กลาง (Nielsen #5 Error prevention)

**ปัญหา:**
- slider "ตั้งแต่เลื่อนตำแหน่งล่าสุด" ตั้งได้ 0–15 ปีเสมอ ([WhatIfSimulator.jsx:17](../frontend/src/WhatIfSimulator.jsx#L17)) แม้พนักงานจะอยู่บริษัทมาแค่ 2 ปี
- backend ([schemas.py](../backend/schemas.py)) ตรวจทีละฟิลด์เท่านั้น ไม่ได้ตรวจความสัมพันธ์ระหว่างฟิลด์

**หลักฐาน (รันจริง):** ในข้อมูลจริง 1,470 แถว ไม่มีแถวไหนเลยที่ฝ่าฝืนกฎต่อไปนี้
- `YearsSinceLastPromotion ≤ YearsAtCompany`
- `YearsInCurrentRole ≤ YearsAtCompany`
- `YearsWithCurrManager ≤ YearsAtCompany`
- `YearsAtCompany ≤ TotalWorkingYears`

**ทำไมต้องแก้:** โมเดลไม่เคยเห็นข้อมูลแบบนี้ คะแนนที่ได้จึงเป็นการเดาเกินขอบเขตของข้อมูล (extrapolation) แต่ UI แสดงเหมือนเป็นผลที่เชื่อได้

**วิธีแก้:**
1. เพิ่ม `@model_validator(mode="after")` ใน `EmployeeInput` ตรวจ 4 กฎข้างบน ถ้าผิดให้ตอบ 422 พร้อมข้อความไทยที่บอกว่าผิดเพราะอะไร
2. ใน React ตั้ง `max` ของ slider ให้สัมพันธ์กับค่าอื่น เช่น `YearsSinceLastPromotion` ไม่เกิน `YearsAtCompany` ของคนนั้น

**เสร็จเมื่อ:** ตั้งค่าที่เป็นไปไม่ได้ผ่าน UI ไม่ได้ ถ้ายิง API ตรงก็ได้ 422 และมี test ครอบ

**ผู้รับผิดชอบ:** Saphondanai (เจ้าของ `schemas.py` และ What-if)

---

### UX-05 การแสดงคะแนนชวนให้เข้าใจผิด

ระดับ: กลาง (Nielsen #2 และหลักการออกแบบหน้าจอที่อธิบายผลของ AI)

**ปัญหา:**
- คะแนนแสดงเป็น "68 / 100" ([ShapViewer.jsx:81](../frontend/src/ShapViewer.jsx#L81), [WhatIfSimulator.jsx:46](../frontend/src/WhatIfSimulator.jsx#L46)) คนส่วนใหญ่จะอ่านว่า "โอกาสลาออก 68%" ทั้งที่ยังไม่ได้ปรับเทียบ และ README หัวข้อ 6.5 บอกว่าใช้ จัดอันดับ เท่านั้น ส่วนคำอธิบายเป็นตัวอักษรเล็กสีจาง
- กราฟ SHAP แสดงตัวเลข log-odds ดิบบนแกน X และใน tooltip ("0.352") ([ShapViewer.jsx:96-101](../frontend/src/ShapViewer.jsx#L96-L101)) ซึ่ง HR ไม่มีทางรู้ความหมาย
- คำเตือนว่ายังไม่ปรับเทียบอยู่ใต้ตัวเลข ผู้ใช้จึงอ่านตัวเลขก่อนเห็นคำเตือน

**ทำไมต้องแก้:** ตัวเลขที่ดูเหมือนความน่าจะเป็นจะถูกนำไปพูดต่อว่า "คนนี้มีโอกาสออก 68%" ซึ่งไม่จริงและอาจนำไปสู่การตัดสินใจที่ไม่เป็นธรรม

**วิธีแก้:**
1. แสดง ระดับ (สูง/ปานกลาง/ต่ำ) เป็นตัวหลัก และเปลี่ยนตัวเลขเป็นอันดับเทียบกับคนอื่น เช่น "เสี่ยงกว่า 85% ของพนักงานในบริษัท" ซึ่งตรงกับความหมายจริงของคะแนน
   - backend คำนวณ percentile จากคะแนนของทุกคน (ตาราง batch ใน DE-04)
2. กราฟ SHAP:
   - ซ่อนตัวเลขบนแกน (`tick={false}`) และให้ความยาวแท่งสื่อ "มากหรือน้อยเมื่อเทียบกัน"
   - tooltip ใช้คำว่า "ดันความเสี่ยงขึ้นมาก / เล็กน้อย" แทนตัวเลข
3. ย้ายคำเตือนว่ายังไม่ปรับเทียบไปไว้เหนือคะแนน

**เสร็จเมื่อ:** หน้าจอไม่มีตัวเลขที่อ่านเป็นเปอร์เซ็นต์โอกาสลาออกได้ และกราฟไม่มี log-odds ดิบ

**ผู้รับผิดชอบ:** Puripat (`ShapViewer.jsx`) + Saphondanai (`ScoreBox` ใน What-if และ percentile ใน batch)

---

### UX-06 แสดงเพศ อายุ สถานภาพ เป็น "เหตุผล" ของความเสี่ยง

ระดับ: กลาง (ความเป็นธรรม (ผูกกับ DS-03 ใน[รายงาน DE](review_data_engineering_S.md#ds-03-pdpa-fairness-และความปลอดภัย)))

**ปัญหา:**
- SHAP Viewer แสดงทุกปัจจัยเหมือนกันหมด เช่น "เพศ (ชาย) · ชาย · เพิ่มความเสี่ยง" หรือ "สถานภาพสมรส: Single · ใช่ · เพิ่มความเสี่ยง" โดยไม่มีคำเตือน ([ShapViewer.jsx:109-124](../frontend/src/ShapViewer.jsx#L109-L124))
- ขณะที่หน้า Streamlit ติดป้ายไว้แล้วว่า "ข้อมูลส่วนตัว/ประวัติ บริษัทปรับไม่ได้" ([common.py:164](../src/app_pages/common.py#L164))
- และ backend ก็มีรายการคำแนะนำ [`RECOMMENDATIONS`](../src/company_summary.py#L19) กับข้อความ [`NOT_ACTIONABLE`](../src/company_summary.py#L45) พร้อมใช้อยู่แล้ว

**ทำไมต้องแก้:**
- การวาง "เพศ" เป็นเหตุผลของความเสี่ยงบนหน้าจอ HR เท่ากับชี้นำให้ใช้เพศประกอบการตัดสินใจ ซึ่งเป็นการเลือกปฏิบัติ
- เรื่องนี้ขัดกับหลักการที่ทีมเขียนไว้เองใน `NOT_ACTIONABLE` และ README หัวข้อ 6.4

**วิธีแก้:**
1. ให้ `/shap` คืน `actionable` และ `recommendation` ของแต่ละปัจจัย ใช้ `feature_group` + `RECOMMENDATIONS` ตัวเดียวกับ `company_summary`
2. UI แบ่งเป็น 2 กลุ่ม
   - "ปัจจัยที่บริษัทปรับได้": แสดงคำแนะนำคู่กัน
   - "ข้อมูลส่วนตัว/ประวัติ (ห้ามใช้ตัดสินใจ)": พับไว้เป็นค่าเริ่มต้น และไม่แสดงค่าจริงของ protected attribute (ผูกกับ [SEC-01](review_security_S.md#sec-01-api-ไม่มีการยืนยันตัวตน-และคืนข้อมูลส่วนตัวทั้งก้อน))
3. ให้ Yanisa/Nanthamon (Fairness check) รีวิวถ้อยคำของกลุ่มที่สอง

**เสร็จเมื่อ:** protected attribute ไม่ปรากฏเป็น "เหตุผล" ในมุมมองหลัก และปัจจัยที่ปรับได้มีคำแนะนำกำกับ

**ผู้รับผิดชอบ:** Puripat (`/shap` และ `ShapViewer.jsx`) + Yanisa, Nanthamon (รีวิวถ้อยคำ)

---

### UX-07 ปัจจัยแบบ one-hot อ่านยาก และคำแปลซ้ำกัน 2 ที่

ระดับ: กลาง (Nielsen #2 และ #4)

**ปัญหา:**
- one-hot แสดงทีละคอลัมน์ เช่น "ตำแหน่งงาน: Sales Representative · ไม่ใช่ · ลดความเสี่ยง" ([featureLabels.js:56-63](../frontend/src/featureLabels.js#L56-L63)) ผู้ใช้ต้องแปลในหัวว่า "การที่เขา*ไม่ได้*เป็นพนักงานขายช่วยลดความเสี่ยง" และชื่อหมวดยังเป็นภาษาอังกฤษ
- คำแปลภาษาไทยมี 2 ชุด คือ [featureLabels.js](../frontend/src/featureLabels.js) กับ [app_pages/common.py](../src/app_pages/common.py) และเริ่มไม่ตรงกัน:
  - Streamlit ใส่หน่วย "(กม.)" ให้ระยะทาง ([common.py:86](../src/app_pages/common.py#L86)) แต่ React ไม่มี และ IBM ไม่ได้ระบุหน่วยไว้
  - key `"Human Resources "` (มีเว้นวรรคท้าย) ที่ [common.py:76](../src/app_pages/common.py#L76) ไม่เคยถูกใช้ ตำแหน่ง HR จึงแสดงเป็น "ฝ่ายทรัพยากรบุคคล" ซึ่งเป็นชื่อแผนก

**วิธีแก้:**
1. รวม SHAP ของ one-hot กลับเป็นฟีเจอร์เดิมที่ฝั่ง server: ใช้ [`feature_group`](../src/company_summary.py#L51) ตัวเดียวกับ Company Summary (รวมได้เพราะค่า SHAP บวกกันได้) ผลคือ "ตำแหน่งงาน: พนักงานขาย · เพิ่มความเสี่ยง" หนึ่งบรรทัด
2. ให้คำแปลมีแหล่งเดียว: ย้ายไปไฟล์ เช่น `config/labels_th.json` ให้ API คืน `label_th`/`value_th` มาเลย แล้วลบ dictionary ที่ซ้ำใน React ส่วน Streamlit อ่านไฟล์เดียวกัน
3. แก้ key ที่มีเว้นวรรค และใส่หน่วยตามที่ตกลงใน DE-01/UX-08

**เสร็จเมื่อ:** ไม่มีแถว "ใช่/ไม่ใช่" ของ one-hot, ไม่มีชื่อหมวดภาษาอังกฤษบนหน้าจอ และคำแปลอยู่ไฟล์เดียว

**ผู้รับผิดชอบ:** Puripat (`/shap`, `ShapViewer.jsx`, Streamlit) + Saphondanai (ไฟล์ label กลาง, What-if)

---

### UX-08 ตัวเลขไม่มีหน่วย

ระดับ: กลาง (ผูกกับ DE-01 ใน[รายงาน DE](review_data_engineering_S.md#de-01-หน่วยเงินเดือนไม่มีนิยามกลาง))

**ปัญหา:**
- ตารางต้นทุนแสดงตัวเลขเปล่า ([WhatIfSimulator.jsx:27](../frontend/src/WhatIfSimulator.jsx#L27), [:196-201](../frontend/src/WhatIfSimulator.jsx#L196-L201)) HR คนไทยจะอ่านเป็นบาท
- slider รายได้ 1,000–20,000 ([WhatIfSimulator.jsx:7](../frontend/src/WhatIfSimulator.jsx#L7)) และ slider ระยะทาง 1–30 ไม่มีหน่วย
- บรรทัดที่บอกหน่วย (`currency_note`) อยู่ท้ายตารางเป็นตัวอักษรเล็ก

**ทำไมต้องแก้:** ผู้ใช้จะเข้าใจว่าต้นทุนหาคนแทน "5,993" คือ 5,993 บาท ซึ่งผิดทั้งหน่วยและขนาด

**วิธีแก้:** หลังทีมตกลงหน่วยใน DE-01 ให้แสดงหน่วยข้างตัวเลขทุกจุด (เช่น "฿" หรือ "บาท") และใช้ `Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })` กับค่าที่แปลงแล้ว ค่าไหนที่ไม่รู้หน่วยจริง ให้เขียนว่า "หน่วยตามข้อมูลต้นฉบับ"

**เสร็จเมื่อ:** ตัวเลขเงินและระยะทางทุกตัวบนหน้าจอมีหน่วยกำกับ

**ผู้รับผิดชอบ:** Saphondanai

---

## 5. เรื่องรอง

| ID | เรื่อง | หลักฐาน | วิธีแก้ | ผู้รับผิดชอบ |
| :--- | :--- | :--- | :--- | :--- |
| UX-09 | สถานะ loading/error ไม่ชัด ตอนคำนวณใหม่อัตโนมัติหลังลาก slider ไม่มีสัญญาณว่ากำลังโหลด, ถ้า error ผลเก่ายังแสดงอยู่เหมือนเป็นผลล่าสุด, error 422 ที่ `detail` เป็น list แสดงแค่ "เรียก API ไม่สำเร็จ (422)", `/whatif` กับ `/financial-impact` ใช้กล่อง error เดียวกัน, และข้อความสำหรับนักพัฒนา "เปิด uvicorn ที่ port 8000 หรือยัง" ขึ้นให้ HR เห็น | [WhatIfSimulator.jsx:29-38](../frontend/src/WhatIfSimulator.jsx#L29-L38), [:83-114](../frontend/src/WhatIfSimulator.jsx#L83-L114), [ShapViewer.jsx:38](../frontend/src/ShapViewer.jsx#L38) | 1. มีสถานะ pending ที่ทำให้ผลจางลงพร้อม `aria-busy` 2. บอกชัดว่า "ผลด้านบนยังเป็นค่าก่อนหน้า" 3. แปลง `detail[]` เป็นข้อความไทยรายช่อง 4. แยก error ของแต่ละส่วน 5. ข้อความสำหรับนักพัฒนาให้แสดงเฉพาะ `import.meta.env.DEV` | Saphondanai (What-if) + Puripat (SHAP Viewer) |
| UX-10 | Accessibility สีข้อความ "เพิ่ม/ลดความเสี่ยง" ในตาราง SHAP มี contrast 4.38:1 และ 4.11:1 ต่ำกว่า 4.5:1 ของ WCAG AA ([ภาคผนวก A](#a-contrast-ของสีตาม-wcag)), คะแนนใหม่หลังลาก slider ไม่ถูกประกาศให้ screen reader, และความกว้างแกน Y อ่านจาก `window.innerWidth` ตอน render จึงไม่ปรับตามขนาดหน้าจอที่เปลี่ยน | [ShapViewer.jsx:8-9](../frontend/src/ShapViewer.jsx#L8-L9), [:97](../frontend/src/ShapViewer.jsx#L97), [:118](../frontend/src/ShapViewer.jsx#L118) | 1. ข้อความในตารางใช้สีที่มีอยู่แล้วและผ่านเกณฑ์: `--bad` #c62828 (5.62:1) และ #2f5bd3 (5.90:1) ส่วนแท่งกราฟใช้สีเดิมได้ (กราฟิกต้องการแค่ 3:1) 2. ใส่ `aria-live="polite"` ที่กล่องคะแนน 3. คำนวณความกว้างจาก container แทน `window` | Puripat (SHAP Viewer) + Saphondanai (What-if, CSS) |
| UX-11 | ความสม่ำเสมอของผลิตภัณฑ์ หัวข้อ `<h1>` และ `<title>` เป็นภาษาอังกฤษ, UX ที่ดีกว่าหลายอย่างอยู่ในหน้า Streamlit ทดสอบ ([จุดที่ทำได้ดี](#3-จุดที่ทำได้ดี-ควรรักษาไว้)), ช่อง "รหัสบริษัท" โผล่ให้ผู้ใช้พิมพ์เอง ([SEC-02](review_security_S.md#sec-02-ไม่ได้แยกข้อมูลของแต่ละบริษัท-tenant-isolation)), และประกาศฟอนต์ Sarabun ไว้แต่ไม่ได้โหลด | [App.jsx:8](../frontend/src/App.jsx#L8), [index.html:7](../frontend/index.html#L7), [index.css:10](../frontend/src/index.css#L10) | 1. ตั้งชื่อผลิตภัณฑ์ภาษาไทย 2. ประกาศว่า React คือตัวผลิตภัณฑ์ แล้วย้ายคำอธิบายภาษาคน preset และคำเตือนนอกช่วงจาก Streamlit มาใช้ 3. ลบช่องรหัสบริษัท 4. โหลด Sarabun จาก Google Fonts หรือเอาออกจาก font stack | Saphondanai + Puripat |
| UX-12 | การใช้คำและจริยธรรม ป้าย "ความเสี่ยงที่จะลาออก: สูง" ติดกับตัวบุคคล ถ้าหัวหน้างานเห็นอาจเกิดอคติหรือกลายเป็นคำทำนายที่เป็นจริงเอง, และคำแนะนำ "ใช้เป็นหัวข้อเริ่มคุย แล้วยืนยันจากการพูดคุย" ยังมีแค่ใน Streamlit | [common.py:173-174](../src/app_pages/common.py#L173-L174) | 1. ให้เห็นเฉพาะ role HR (ผูกกับ SEC-01) 2. พิจารณาคำที่เน้นการดูแล เช่น "ควรได้รับการดูแลก่อน" 3. ย้ายข้อความแนะนำมาไว้ใต้ผลทุกครั้ง 4. เขียนหลักว่า "ห้ามใช้คะแนนตัดสินเรื่องเงินเดือนหรือเลิกจ้างโดยอัตโนมัติ" ในรายงาน | ทั้งทีม (ตกลงถ้อยคำ) + Saphondanai (รายงาน) |

---

## 6. งานแยกรายคน

ติ๊กเมื่อเสร็จ แล้วใส่ commit hash ต่อท้าย

### ทั้งทีม (รวมในประชุมเดียวกับ DE-04 / SEC-01)
- [ ] ยืนยันผู้รับผิดชอบและกำหนดเสร็จในเอกสารนี้
- [ ] UX-02 มอบหมายงานหน้ารายชื่อพนักงานเสี่ยงและหน้ารายละเอียดพนักงาน
- [ ] UX-11 ยืนยันว่า React คือตัวผลิตภัณฑ์ ส่วน Streamlit เป็นแค่หน้าทดสอบ
- [ ] UX-12 ตกลงถ้อยคำที่ใช้เรียกระดับความเสี่ยง

### Saphondanai
- [ ] UX-01 review การย้ายเกณฑ์ไปที่ server
- [ ] UX-03 preset มาตรการใน config + ปุ่มมาตรการใน React + สรุป "ความเสี่ยงลดเท่าไร vs ต้นทุน"
- [ ] UX-04 `model_validator` ใน `EmployeeInput` + `max` ของ slider
- [ ] UX-05 `ScoreBox` แสดงระดับ + percentile (ร่วมกับ batch ใน DE-04)
- [ ] UX-07 ไฟล์ label กลาง (ร่วมกับ Puripat)
- [ ] UX-08 หน่วยเงินและระยะทาง (หลัง DE-01)
- [ ] UX-09 loading/error ใน What-if
- [ ] UX-10 `aria-live` ใน What-if
- [ ] UX-11 ชื่อไทย, ฟอนต์, ลบช่องรหัสบริษัทใน What-if
- [ ] UX-12 หัวข้อหลักการใช้คะแนนในรายงาน

### Puripat
- [ ] UX-01 (หลัก) `/shap` คืน `risk_band` + ลบเกณฑ์ใน `ShapViewer.jsx`
- [ ] UX-03 หน้า Streamlit อ่าน preset จาก config
- [ ] UX-05 กราฟ SHAP ไม่มี log-odds ดิบ + ย้ายคำเตือนขึ้นบน
- [ ] UX-06 (หลัก) `/shap` คืน `actionable`/`recommendation` + แบ่ง 2 กลุ่มใน UI
- [ ] UX-07 (หลัก) รวม one-hot ด้วย `feature_group` + ใช้ label กลาง
- [ ] UX-09 loading/error ใน SHAP Viewer
- [ ] UX-10 สีข้อความในตาราง SHAP + ความกว้างแกน Y
- [ ] UX-11 ลบช่องรหัสบริษัทใน SHAP Viewer

### Yanisa
- [ ] UX-06 รีวิวถ้อยคำกลุ่ม "ข้อมูลส่วนตัว (ห้ามใช้ตัดสินใจ)" (ต่อจาก Fairness check)
- [ ] UX-02 (ถ้าทีมมอบหมาย) หน้ารายชื่อพนักงานเสี่ยง
- [ ] Intervention Tracker: ใช้หลักเดียวกับ UX-09/UX-10 ตั้งแต่ต้น (loading, error รายช่อง, `aria-live`)

### Nanthamon
- [ ] UX-06 รีวิวถ้อยคำ (ร่วมกับ Yanisa)
- [ ] UX-02 (ถ้าทีมมอบหมาย) หน้ารายชื่อพนักงานเสี่ยง ต่อจาก Company Summary panel
- [ ] Company Summary panel และ Superset: ใช้ระดับความเสี่ยงและคำแปลจาก API (UX-01, UX-07) ไม่ตั้งเกณฑ์เอง

---

## 7. ความเห็นทีม

เขียนต่อท้ายได้เลย รูปแบบ: `- [ID] ชื่อ (วันที่): ความเห็น`

-

---

## คำศัพท์

| คำ | ความหมายในเอกสารนี้ |
| :--- | :--- |
| Nielsen's heuristics | หลักการ 10 ข้อสำหรับประเมินความใช้งานง่ายของหน้าจอ เช่น ความสม่ำเสมอ การป้องกันความผิดพลาด |
| WCAG 2.2 AA | มาตรฐานการเข้าถึงเว็บ ข้อความปกติต้องมี contrast ≥ 4.5:1 ข้อความใหญ่ (≥ 24px หรือ ≥ 18.66px ตัวหนา) และกราฟิกต้อง ≥ 3:1 |
| Contrast ratio | อัตราส่วนความสว่างระหว่างสีตัวอักษรกับพื้นหลัง ยิ่งสูงยิ่งอ่านง่าย |
| `aria-live` | attribute ที่บอก screen reader ให้อ่านออกเสียงเมื่อเนื้อหาในส่วนนั้นเปลี่ยน |
| Percentile rank | ตำแหน่งเทียบกับคนอื่น เช่น "สูงกว่า 85% ของพนักงาน" |
| Extrapolation | ให้โมเดลทำนายข้อมูลที่อยู่นอกรูปแบบที่เคยเห็นตอนเทรน ผลจึงเชื่อถือไม่ได้ |
| Protected attribute | ลักษณะที่ห้ามใช้เป็นเกณฑ์เลือกปฏิบัติ เช่น เพศ อายุ สถานภาพสมรส |

---

## ภาคผนวก: สคริปต์ตรวจซ้ำ

รันจากรากโปรเจกต์ด้วย `.venv` ทั้งสองสคริปต์ไม่แก้ไฟล์และไม่ log ขึ้น MLflow

### A. Contrast ของสีตาม WCAG

<details>
<summary>โค้ด contrast.py</summary>

```python
"""WCAG 2.x contrast ratios for the colours used in frontend/src (index.css, ShapViewer.jsx)."""


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    channels = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(fg: str, bg: str) -> float:
    a, b = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


# (where it is used, foreground, background, text size -> required ratio)
CASES = [
    ("SHAP 'เพิ่มความเสี่ยง' ในตาราง (0.9rem)", "#d64545", "#ffffff", 4.5),
    ("SHAP 'ลดความเสี่ยง' ในตาราง (0.9rem)", "#3b7dd8", "#ffffff", 4.5),
    ("ข้อความ error (--bad, ขนาดปกติ)", "#c62828", "#ffffff", 4.5),
    ("ข้อความ muted เล็ก (0.85rem)", "#667085", "#ffffff", 4.5),
    ("ระดับ 'ต่ำ' (--ok, 2rem ตัวหนา)", "#1f8a4c", "#ffffff", 3.0),
    ("ระดับ 'ปานกลาง' (--warn, 2rem ตัวหนา)", "#c77700", "#ffffff", 3.0),
    ("ระดับ 'สูง' (--bad, 2rem ตัวหนา)", "#c62828", "#ffffff", 3.0),
    ("ปุ่มหลัก: ตัวขาวบน #2f5bd3", "#ffffff", "#2f5bd3", 4.5),
    ("ปุ่มรอง: #2f5bd3 บนขาว", "#2f5bd3", "#ffffff", 4.5),
    ("กล่องคำเตือน: ข้อความบน #fff6e5", "#1c2330", "#fff6e5", 4.5),
    ("ช่องที่ถูกปรับ: ข้อความบน #eef3ff", "#1c2330", "#eef3ff", 4.5),
]

for name, fg, bg, need in CASES:
    r = ratio(fg, bg)
    print(f"{name:<42} {fg} on {bg}  {r:5.2f}:1  need {need}:1  {'PASS' if r >= need else 'FAIL'}")
```

</details>

ผล ณ วันตรวจ:

| ใช้ที่ | สี | Contrast | ต้องการ | ผล |
| :--- | :--- | :--- | :--- | :--- |
| ตาราง SHAP "เพิ่มความเสี่ยง" (0.9rem) | #d64545 บนขาว | 4.38:1 | 4.5:1 | ไม่ผ่าน |
| ตาราง SHAP "ลดความเสี่ยง" (0.9rem) | #3b7dd8 บนขาว | 4.11:1 | 4.5:1 | ไม่ผ่าน |
| ข้อความ error | #c62828 บนขาว | 5.62:1 | 4.5:1 | ผ่าน |
| ข้อความ muted เล็ก | #667085 บนขาว | 4.97:1 | 4.5:1 | ผ่าน |
| ระดับ "ต่ำ" (2rem ตัวหนา) | #1f8a4c บนขาว | 4.38:1 | 3:1 | ผ่าน |
| ระดับ "ปานกลาง" (2rem ตัวหนา) | #c77700 บนขาว | 3.46:1 | 3:1 | ผ่าน (ใช้กับข้อความเล็กไม่ได้) |
| ระดับ "สูง" (2rem ตัวหนา) | #c62828 บนขาว | 5.62:1 | 3:1 | ผ่าน |
| ปุ่มหลัก / ปุ่มรอง | ขาว ↔ #2f5bd3 | 5.90:1 | 4.5:1 | ผ่าน |
| กล่องคำเตือน | #1c2330 บน #fff6e5 | 14.68:1 | 4.5:1 | ผ่าน |
| ช่องที่ถูกปรับ | #1c2330 บน #eef3ff | 14.18:1 | 4.5:1 | ผ่าน |

### B. เกณฑ์ระดับความเสี่ยงและความสัมพันธ์ระหว่างฟิลด์

<details>
<summary>โค้ด check_ux_data.py</summary>

```python
"""UX-01 (threshold mismatch), UX-02 (ID gaps), UX-04 (cross-field rules). Local model, nothing logged to MLflow."""
import sys

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

sys.path.insert(0, "src")
from clean_pipeline import RAW_FILENAME, TARGET_COLUMN, clean_data, load_raw_data  # noqa: E402
from feature_pipeline import SELECTED_FEATURES, add_features  # noqa: E402
from train import PARAMS  # noqa: E402

raw = load_raw_data(f"data/raw/{RAW_FILENAME}")
print("YSLP>YAC", int((raw.YearsSinceLastPromotion > raw.YearsAtCompany).sum()),
      "| YICR>YAC", int((raw.YearsInCurrentRole > raw.YearsAtCompany).sum()),
      "| YWCM>YAC", int((raw.YearsWithCurrManager > raw.YearsAtCompany).sum()),
      "| YAC>TWY", int((raw.YearsAtCompany > raw.TotalWorkingYears).sum()))
print("EmployeeNumber", raw.EmployeeNumber.min(), "-", raw.EmployeeNumber.max(), "count", raw.EmployeeNumber.nunique())

df = add_features(clean_data(raw), only=SELECTED_FEATURES)
X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN]
Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
model = XGBClassifier(**PARAMS, scale_pos_weight=(ytr == 0).sum() / (ytr == 1).sum(), random_state=42, n_jobs=4)
p = model.fit(Xtr, ytr).predict_proba(X)[:, 1]
api = np.where(p >= 0.7, "High", np.where(p >= 0.4, "Medium", "Low"))      # business_rules.py
viewer = np.where(p >= 0.6, "High", np.where(p >= 0.3, "Medium", "Low"))   # ShapViewer.jsx
print("labelled differently:", int((api != viewer).sum()), "of", len(p))
print(pd.crosstab(pd.Series(api, name="API"), pd.Series(viewer, name="ShapViewer")))
```

</details>

ผล ณ วันตรวจ:

```text
YSLP>YAC 0 | YICR>YAC 0 | YWCM>YAC 0 | YAC>TWY 0
EmployeeNumber 1 - 2068 count 1470
labelled differently: 232 of 1470
ShapViewer  High  Low  Medium
API
High         185    0       0
Low            0  840     171
Medium        61    0     213
```
