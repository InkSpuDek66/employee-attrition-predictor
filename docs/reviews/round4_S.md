# รายงานตรวจโปรเจกต์ รอบ 4: ตรวจซ้ำหลังรวมงานของ dev007-NungUm

| หัวข้อ | รายละเอียด |
| :--- | :--- |
| วันที่ตรวจ | 10 ต.ค. 2026 (ช่วงค่ำ) |
| เวอร์ชันที่ตรวจ | branch `dev001-Ink` @ `5996e50` = `main` ล่าสุด (`5fbc799`) + `dev007-NungUm` (`3ef5035`, 10 commit) ที่ merge แล้ว **ยังไม่ได้เข้า `main`** |
| ฐานข้อมูลที่ใช้ทดสอบ | PostgreSQL 17.11 ใน `docker compose` (volume เดิมจากรอบ 3 ต้องรัน schema ใหม่ก่อน ดู [QA-06](#qa-06-pull-schema-ใหม่แล้ว-db-เก่าทำให้บันทึกไฟล์ได้-500)) |
| ผู้ตรวจ | Claude Code (AI, Claude Opus 5.5) รับบท senior engineer 4 สาย (Security, Data Engineering, UX/UI, Backend/QA) และลองใช้แทนลูกค้า 3 ฝ่าย (HR, การเงิน, ผู้ดูแลระบบ) ตามคำขอของ Saphondanai |
| ผู้ดูแลเอกสาร | Saphondanai |
| ต่อจาก | [รอบ 3](round3_S.md) · รายงานทุกรอบดูที่ [สารบัญ](README.md) |
| สถานะ | รอทีมยืนยันผู้รับผิดชอบและลำดับการแก้ |

**วิธีใช้เอกสารนี้**

1. อ่าน [1. สรุป](#1-สรุป) ก่อน
2. สถานะของข้อจากรอบ 3 อยู่ใน [3](#3-สถานะข้อจากรอบก่อน) ข้อที่ปิดแล้วไปติ๊กในรายงานรอบ 3 ได้เลย
3. ข้อใหม่ของรอบนี้อยู่ใน [4](#4-ข้อใหม่รอบนี้) เลข ID ต่อจากรอบ 3 (DE-17, QA-05)
4. หาชื่อตัวเองใน [7. งานแยกรายคน](#7-งานแยกรายคน)

> ผู้รับผิดชอบที่ระบุเป็นข้อเสนอจาก git log (`Ink-SPU` = Saphondanai, `NungUmSudNaRak` / Dev007 = Puripat) ทีมต้องยืนยันอีกครั้ง

---

## 1. สรุป

### ดีขึ้นแค่ไหน

ดีขึ้นชัดเจน โดยเฉพาะฝั่งผู้ดูแลระบบ หน้าใหม่ "ปรับเทียบโมเดล" เป็นส่วนที่ทำดีที่สุดของรอบนี้: มีไฟล์ทดลอง กราฟสูตรแปลงคะแนน ตัวอย่าง "80 → 56" ประวัติ และปุ่มยกเลิกที่มีหน้าต่างยืนยัน ข้อที่รอบ 3 ให้แก้ก่อนนำเสนอก็ปิดไปแล้ว 2 ข้อ คือเมนูซ้ายหายบนโน้ตบุ๊ก (UX-13) และหน้าอื่นไม่อัปเดตหลังบันทึกไฟล์ (UX-18) test เพิ่มจาก 32 เป็น 41 ข้อ (ฝั่งหน้าเว็บจาก 4 เป็น 10) ผ่านหมด และ JavaScript ของหน้า SHAP เล็กลงจาก 362 KB เหลือ 9 KB หลังเลิกใช้ recharts

ที่ยังไม่ดีขึ้นคือตัวเลขที่ลูกค้าเห็น และมีเรื่องใหม่ 2 เรื่องที่ควรรู้ก่อน merge เข้า `main`

- **CI จะแดงทันทีที่เปิด PR:** `ruff check .` ไม่ผ่าน 6 จุด ในสคริปต์แปลงโลโก้ที่เพิ่มมาใหม่ ([QA-05](#qa-05-ruff-ไม่ผ่านเพราะสคริปต์แปลงโลโก้))
- **ปรับเทียบแล้วหน้าภาพรวมไม่เปลี่ยน ทั้งที่หน้าปรับเทียบบอกว่าเปลี่ยน:** ปรับเทียบด้วยไฟล์ทดลองแล้ว DB มีคนเสี่ยงสูง 41 คน แต่การ์ดยังแสดง 185 คน และมูลค่าความเสี่ยงยังเป็น 975 ล้านบาท แทนที่จะเป็นราว 458 ล้าน (DE-11)
- **ช่องแบบสำรวจที่เว้นว่างทำให้ความเสี่ยงต่ำกว่าจริงแบบไม่มีใครรู้:** ถ้าบริษัทไม่มีข้อมูลแบบสำรวจ จำนวนคนเสี่ยงสูงลดจาก 185 เหลือ 105 และคนที่ลาออกจริงที่ระบบจับได้ลดจาก 154 เหลือ 91 คน โดยไม่มีคำเตือน ([DE-17](#de-17-ช่องแบบสำรวจที่ว่างถูกเติม-3-ทำให้ความเสี่ยงต่ำกว่าจริง))
- ค้างจากรอบ 3: สูตร "ส่วนต่างถ้ารักษาไว้ได้" (UX-15), อายุยังเป็น "สาเหตุหลัก" (UX-06), หน้าภาพรวมล้นจอบนมือถือ (UX-14), token ภาษาไทยทำให้ 500 (SEC-16)

### ต้องแก้อะไรก่อน

| ลำดับ | ทำเมื่อ | ข้อ | เรื่อง | แรง (ประมาณ) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | ก่อนเปิด PR เข้า `main` | [QA-05](#qa-05-ruff-ไม่ผ่านเพราะสคริปต์แปลงโลโก้) | แก้ ruff 6 จุด หรือย้ายสคริปต์โลโก้ออกจาก repo | 10 นาที |
| 2 | ก่อนโชว์ฟีเจอร์ปรับเทียบ | DE-11 | หน้าภาพรวมและตาราง `company_risk_summary` ใช้คะแนนที่ปรับเทียบแล้ว (หรือแก้ข้อความในหน้าปรับเทียบไม่ให้บอกว่าทุกหน้าเปลี่ยน) | ครึ่งวัน |
| 3 | ก่อนให้ใครลองนำเข้าไฟล์ของตัวเอง | [DE-17](#de-17-ช่องแบบสำรวจที่ว่างถูกเติม-3-ทำให้ความเสี่ยงต่ำกว่าจริง) | เตือนเมื่อระบบเติมค่าแบบสำรวจให้ | 1–2 ชั่วโมง |
| 4 | ก่อนนำเสนอ (ค้างจากรอบ 3) | UX-15, UX-06, UX-14, SEC-16 | สูตรส่วนต่าง, ไม่ยกข้อมูลส่วนตัวเป็นเหตุผล, การ์ดล้นจอมือถือ, token ภาษาไทย | ตามรอบ 3 |
| 5 | ก่อนให้ทีมใช้ DB ร่วมกัน | [QA-06](#qa-06-pull-schema-ใหม่แล้ว-db-เก่าทำให้บันทึกไฟล์ได้-500), [DE-18](#de-18-ระยะทางที่ปรับตาม-wfh-แสดงเหมือนเป็นระยะทางจริง) | DB เก่าทำให้บันทึกได้ 500, ระยะทางที่ปรับตาม WFH แสดงเหมือนระยะทางจริง | อย่างละ 1–2 ชั่วโมง |
| 6 | ก่อน deploy | SEC-01, SEC-08, SEC-10, SEC-11, SEC-14, SEC-15, SEC-17, SEC-18 | เหมือนรอบ 3 ไม่มีข้อไหนเปลี่ยน และ SEC-15 หนักขึ้น | หลายวัน |

### ภาพรวมแยกตามมุม

| มุม | ผลรอบนี้ |
| :--- | :--- |
| Security | endpoint ใหม่ 5 ตัวของการปรับเทียบผ่าน login และจำกัดสิทธิ์ admin ถูกต้อง ไฟล์ zip bomb ถูกปฏิเสธในเส้นทางปรับเทียบด้วย แต่ข้อค้างจากรอบ 3 ยังอยู่ครบ และการบันทึกไฟล์ 10,000 แถวทำให้ API ค้างนานขึ้นเป็น 4.7 วินาที |
| Data Engineering | ปรับเทียบผ่านไฟล์ตรวจข้อมูลทีละแถวแล้ว (แก้ DE-02 ในเส้นทางหน้าเว็บ) และหน้าเว็บตั้ง Platt เป็นค่าเริ่มต้น แต่ตัวเลขภาพรวมยังไม่ใช้คะแนนปรับเทียบ ช่องแบบสำรวจถูกเติมเงียบๆ, WFH เป็นการประมาณที่หน้าจอแสดงเหมือนข้อมูลจริง และ batch รันเองทุกครั้งที่ข้อมูลเปลี่ยน ทำให้ DB โตเร็วขึ้น |
| UX/UI | หน้าปรับเทียบดีมาก, เมนูครบบนจอเตี้ย, บันทึกแล้วหน้าอื่นอัปเดต, ระดับตำแหน่งเป็นคำไทย, กราฟ SHAP ไม่มีตัวเลข log-odds แล้ว ส่วน UX-06, UX-07, UX-14, UX-15, UX-17 ยังเหมือนเดิม |
| Backend/QA | test 41 ข้อผ่าน (ต่อ DB) แต่ `ruff check .` ไม่ผ่าน CI ยังไม่รัน test ของ DB และ schema ใหม่ต้องรันเองบน DB เก่า ไม่งั้นบันทึกไฟล์ได้ 500 |

---

## 2. ขอบเขตและวิธีตรวจ

1. ดู diff ทั้งหมดจาก `5c505a6` (รอบ 3) ถึง `5996e50`: 48 ไฟล์, +4,253 / −895 บรรทัด อ่านละเอียดส่วน backend (`auth.py`, `model_store.py`, `schemas.py`, `calibration.py`, `batch_score.py`, `routers/recalibrate.py`, `routers/employee_upload.py`, schema SQL, CI) และไล่ส่วนหน้าเว็บที่เกี่ยวกับข้อจากรอบ 3
2. รันชุดตรวจของทีม: `pytest backend` (ต่อ DB), `ruff check .`, `pip-audit`, `npm audit`, `npm run lint`, `npm test`, `npm run build`
3. ยิง API แบบ in-process ด้วย login จริง โหมด CSV ค่าปรับเทียบเขียนลงโฟลเดอร์ชั่วคราว ([ภาคผนวก A](#a-สคริปต์ยิง-api-แบบ-in-process))
4. ยิง backend จริงที่ port 8000 แบบต่อ DB: นำเข้า, ปรับเทียบ, batch ที่รันเอง, เวลาตอบระหว่างงานหนัก, rate limit ผ่าน `X-Forwarded-For` และทดสอบ schema เก่าใน database ชั่วคราว `attrition_mig` (ลบทิ้งแล้ว) ([ภาคผนวก B](#b-ทดสอบกับ-postgresql))
5. ใช้หน้าเว็บจริงผ่าน Playwright ในบัญชี `hr_demo` และ `admin_demo` ที่ 1366×768, 1366×650, 1440×900 และ 390×844 ทั้งโหมดสว่างและมืด วัด contrast จากสีที่ browser วาดจริง (รอบนี้แปลงสีผ่าน canvas จึงแม่นกว่ารอบ 3 ที่อ่านค่า oklab ผิด)
6. หลังทดสอบลบข้อมูลทดสอบทั้งหมด ยกเลิกค่าปรับเทียบ คืนค่าพนักงานจาก IBM และรัน batch ใหม่ 1 รอบ

**ข้อจำกัด**

| ข้อจำกัด | ผล |
| :--- | :--- |
| ตรวจ branch ที่ยังไม่เข้า `main` | ถ้า merge แบบอื่นหรือแก้เพิ่มก่อน merge ผลอาจต่างจากนี้ |
| ไม่ได้ทดสอบโหมดไม่ต่อ DB ผ่านหน้าเว็บ | UX-16 ข้อ 1–2 (ข้อความ `DATABASE_URL` และตำแหน่ง error) ยังไม่ได้ลองซ้ำ |
| ทดสอบแบบลูกค้าทำโดย AI สวมบทบาท, เฉพาะ Chromium, DB เครื่องเดียว process เดียว | เหมือนรอบ 3 |
| ระหว่างตรวจ Docker Desktop ค้างที่สถานะ "starting" 8 นาที (engine ตอบ 500) ต้องปิดแล้ว `wsl --shutdown` ก่อนเปิดใหม่ | เป็นปัญหาของ Docker ในเครื่อง ไม่เกี่ยวกับโปรเจกต์ ถ้าเพื่อนเจอให้ใช้วิธีเดียวกัน |

---

## 3. สถานะข้อจากรอบก่อน

ปิดแล้ว = ทดสอบแล้วว่าแก้ครบ · บางส่วน = ดีขึ้นแต่ยังเหลือ · ยังเปิด = เหมือนเดิม

### Security

| ID | สถานะ | หลักฐานรอบนี้ |
| :--- | :--- | :--- |
| SEC-01 | ยังเปิด | ทั้ง 16 endpoint ตอบ 401 เมื่อไม่มี token (รวม 5 endpoint ใหม่ของการปรับเทียบ) แต่บัญชีทดลองยังอยู่ในโค้ดและใน bundle (ย้ายไปซ่อนใต้ปุ่ม "บัญชีทดลอง" มุมซ้ายล่าง) · `/shap?top_n=100` ยังคืน `Age`, `Gender`, `MaritalStatus_*` ครบ ไม่มี rate limit (200 คนใช้ 7.5 วินาที ทั้งบริษัทราว 1 นาที) · `/whatif` คืนข้อมูลดิบ 31 ฟิลด์ |
| SEC-08 | ยังเปิด | `/docs`, `/redoc`, `/openapi.json` ยังได้ 200 โดยไม่ login |
| SEC-11 | ยังเปิด | `main` ยังไม่มีการป้องกัน ไม่มี ruleset |
| SEC-06 | บางส่วน | Dependabot เปิด PR #2 อัปเดต GitHub Actions เป็น v7 และ merge แล้ว CI บน `main` ผ่าน แต่ Dependabot alerts ยังปิด (`vulnerability-alerts` ได้ 404) |
| SEC-14 | ยังเปิด | ยิง backend จริงด้วย `X-Forwarded-For` ต่างกัน 13 ครั้ง ได้ 401 ทั้งหมด ไม่มี 429 |
| SEC-15 | ยังเปิด และหนักขึ้น | บันทึก 10,000 แถวใช้ 5.5 วินาที `/auth/me` ระหว่างนั้นรอ 4,729 ms (รอบ 3: 2,378 ms) · `/recalibrate/upload` เป็น `async def` ที่ fit โมเดลใน event loop `/auth/me` รอ 140–359 ms · `/employees/validate` 25 ครั้งติดได้ 200 หมด |
| SEC-16 | ยังเปิด | `Bearer abc.ไทย` ยังได้ 500 |
| SEC-17 | ยังเปิด | ไม่มี logout ฝั่ง server |
| SEC-18 | ยังเปิด | `docker-compose.yml` ไม่เปลี่ยน แอปยังต่อด้วย superuser |

ใหม่ที่ทำได้ดี: endpoint ใหม่จำกัดสิทธิ์ถูก (HR เรียก `/recalibrate/template`, `/recalibrate/upload`, `DELETE /recalibrate` ได้ 403 ดูประวัติได้ 200) และ xlsx zip bomb ที่ส่งเข้า `/recalibrate/upload` ได้ 413

### Data Engineering

| ID | สถานะ | หลักฐานรอบนี้ |
| :--- | :--- | :--- |
| DE-01 | บางส่วน | อัตรา 35 ย้ายไปอยู่ที่ `business_rules.THB_PER_USD` ที่เดียว backend ส่งให้หน้าเว็บตอน login และมี test เช็กว่าตรงกัน แต่ยังไม่ได้ตัดสินหน่วย เงินเดือนมัธยฐานยังเป็น 172,165 บาท/เดือน |
| DE-02 | บางส่วน | เส้นทางหน้าเว็บ (`/recalibrate/upload`) ตรวจทีละแถวแล้ว: ไฟล์ที่แผนกเป็น "Marketing" 10 แถวถูกปฏิเสธ (n_invalid 10) · เส้นทาง JSON (`POST /recalibrate`) ยังรับ `Department="Marketing"` และ `Age=999` ได้ 200 |
| DE-07 | ยังเปิด | โมเดลตัวเดิม AUC บนหน้าจอยัง 0.930 |
| DE-10 | ยังเปิด | ไฟล์ที่อายุ 95, เงินเดือน 25 บาท, อยู่บริษัท 40 ปี ยังผ่านขั้นตรวจ |
| DE-11 | ยังเปิด และขัดกับข้อความในหน้าเว็บ | ปรับเทียบด้วยไฟล์ทดลองผ่านหน้าเว็บ (Platt) แล้ว: ตาราง `attrition_predictions` มี High 41 / Medium 163 / Low 1,266 คะแนนเฉลี่ย 0.168 แต่การ์ดหน้าภาพรวมยังเป็น 1,470 คน / เฉลี่ย 33 / เสี่ยงสูง 185 คน / 974,910,884 บาท ขณะที่รายชื่อด้านล่างเปลี่ยนเป็นคะแนนปรับเทียบ (77, 75) ส่วนหน้าปรับเทียบเขียนว่า "ทุกหน้า (ภาพรวม / SHAP / What-if) ใช้คะแนนที่ปรับแล้วตั้งแต่ตอนนี้" ถ้าใช้คะแนนปรับเทียบ มูลค่าความเสี่ยงรวมจะเป็นราว 457,926,827 บาท |
| DE-12 | บางส่วน | หน้าเว็บตั้ง "แบบเส้นตรง" (Platt) เป็นค่าเริ่มต้นพร้อมคำแนะนำว่าเหมาะกับ 50–300 คน คะแนนสูงสุดหลังปรับ 0.77 · API ยังใช้ isotonic เป็นค่าเริ่มต้น ไฟล์ทดลองเดียวกันทำให้ 77 คนได้ 1.000 (ตัวอย่าง 0.8 → 0.905) · `load()` ยังไม่กรอง `model_version` |
| DE-13 | บางส่วน | ปรับเทียบจากหน้าเว็บได้ครบ ด้วยไฟล์ที่มีคอลัมน์ "ลาออกแล้วหรือยัง" · ไฟล์นำเข้าปกติยังไม่บันทึกผลลาออก และยังไม่มี API ของ `interventions` |
| DE-14 | ยังเปิด | ยังรับแค่ 3 แผนกของ IBM |
| DE-15 | ยังเปิด | ลบพนักงาน 10,003 คนด้วย SQL แล้ว `/shap/1000001` และ `/shap/990501` ยังได้ 200 |
| DE-16 | ยังเปิด และโตเร็วขึ้น | batch รันเองหลังนำเข้า ปรับเทียบ และยกเลิกปรับเทียบทุกครั้ง (ใช้ 4 วินาทีที่ 1,473 คน และ 21 วินาทีที่ ~11,500 คน) ทดสอบไป 5 รอบ DB โตเป็น 128 MB (`shap_explanations` 367,500 แถว) |

### UX/UI

| ID | สถานะ | หลักฐานรอบนี้ |
| :--- | :--- | :--- |
| UX-13 | ปิดแล้ว | เมนูเห็นครบ 4 จาก 4 ที่ 1366×768 และ 1366×650 (admin มี 5 แท็บ) |
| UX-14 | ยังเปิด | ที่ 390px หน้าภาพรวมยังกว้าง 475px การ์ด 2 ใบเดิมล้นจอ |
| UX-15 | ยังเปิด | พนักงาน #1804 ความเสี่ยง 1/100 ยังขึ้น "ส่วนต่างถ้ารักษาไว้ได้ 1,573,026 บาท" |
| UX-16 | บางส่วน | ตัวอย่างแถวแสดงค่าตามที่ผู้ใช้กรอกแล้ว รหัสพนักงานไม่มีจุลภาคแล้ว และหลังบันทึกมีลิงก์ไปดูพนักงานที่เพิ่งนำเข้า · "45,000" ยังได้ "ต้องเป็นตัวเลขจำนวนเต็ม" · ข้อ 1–2 ยังไม่ได้ทดสอบซ้ำ |
| UX-17 | ยังเปิด | หน้าภาพรวมยังไม่มีคำเตือนเรื่องปรับเทียบหรือ in-sample |
| UX-18 | ปิดแล้ว | บันทึก 2 คนแล้วกลับไปหน้าภาพรวม เห็น 1,472 คน / เสี่ยงสูง 187 ทันทีโดยไม่ต้องรีเฟรช |
| UX-04 | ยังเปิด | `/whatif` ยังรับค่าที่เป็นไปไม่ได้ เพิ่มอีกแบบคือ WFH ทุกวันกับบ้านห่าง 5,000 กม. |
| UX-05 | บางส่วน | กราฟ SHAP เปลี่ยนเป็นแท่ง CSS ไม่มีแกนตัวเลข log-odds แล้ว ยังไม่มี percentile |
| UX-06 | ยังเปิด | พนักงาน #811 ยังขึ้น "สาเหตุหลัก... อายุ 23 ปี" (ทั้งบริษัท 230 คน) |
| UX-07 | ยังเปิด | ยังมี "อัตราค่าจ้างรายวัน: 1,243" เป็นเหตุผลที่ช่วยให้อยู่ต่อ |
| UX-10 | ส่วนใหญ่ปิดแล้ว | สีชุดใหม่ผ่านเกือบหมด เหลือหัวข้อ "เครื่องมือวิเคราะห์" 3.07:1 (โหมดสว่าง) / 4.49:1 (โหมดมืด) และป้าย "สูง" 4.41:1 |
| UX-11 | บางส่วน | ระดับตำแหน่งเป็นคำไทย (จูเนียร์, พนักงานระดับกลาง, ซีเนียร์, ...) และหัวคอลัมน์ "เดินทางไปทำงานนอกสถานที่" ชัดขึ้น · ชื่อแท็บและแผนก/ตำแหน่งยังเป็นภาษาอังกฤษ |

### Backend/QA

| ID | สถานะ | หลักฐานรอบนี้ |
| :--- | :--- | :--- |
| QA-01 | ยังเปิด | ในเครื่องรัน test ของ DB ได้ (41 passed) แต่ `ci.yml` ยังไม่ตั้ง `DATABASE_URL` |
| QA-02 | ยังเปิด | `to_features` ยังต่อพนักงานทั้งบริษัททุกคำขอ |
| QA-03 | ยังเปิด | คำขอแรกหลังเปิด server ใช้ 5–6 วินาที |
| QA-04 | บางส่วน | test เพิ่ม 9 ข้อฝั่ง backend และ 6 ข้อฝั่งหน้าเว็บ แต่ยังไม่มี test ของข้อที่รอบ 3 พบ (SEC-14, SEC-16, DE-10, DE-11, UX-15) |

---

## 4. ข้อใหม่รอบนี้

| ID | มุม | ตอนนี้ | ก่อน deploy | เรื่อง | ผู้รับผิดชอบ (เสนอ) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [QA-05](#qa-05-ruff-ไม่ผ่านเพราะสคริปต์แปลงโลโก้) | QA | สูง (บล็อก merge) | สูง | `ruff check .` ไม่ผ่านจากสคริปต์แปลงโลโก้ | Puripat |
| [DE-17](#de-17-ช่องแบบสำรวจที่ว่างถูกเติม-3-ทำให้ความเสี่ยงต่ำกว่าจริง) | Data | กลาง | สูง | ช่องแบบสำรวจที่ว่างถูกเติม 3 ทำให้ความเสี่ยงต่ำกว่าจริงโดยไม่เตือน | Puripat + Saphondanai (ถ้อยคำ) |
| [DE-18](#de-18-ระยะทางที่ปรับตาม-wfh-แสดงเหมือนเป็นระยะทางจริง) | Data / UX | ต่ำ | กลาง | ระยะทางที่ปรับตาม WFH แสดงเหมือนระยะทางจริง | Puripat |
| [QA-06](#qa-06-pull-schema-ใหม่แล้ว-db-เก่าทำให้บันทึกไฟล์ได้-500) | QA / Data | กลาง | กลาง | DB ที่ยังไม่รัน schema ใหม่ทำให้บันทึกไฟล์ได้ 500 | Puripat + Saphondanai (run guide) |

### QA-05 ruff ไม่ผ่านเพราะสคริปต์แปลงโลโก้

**ปัญหา** commit `ce98012` เพิ่ม `frontend/logo/vectorize_logo.py` (สคริปต์ใช้ครั้งเดียวสำหรับแปลงรูปเป็น SVG) และรูปต้นฉบับ `logo-source.png` 1.26 MB สคริปต์นี้ทำให้ `ruff check .` ไม่ผ่าน ซึ่ง CI รันทุก PR

**หลักฐาน** `ruff check .` เจอ 6 จุดในไฟล์นี้ (E731 × 3, E402 × 2, F541 × 1) exit 1 · CI ของ `dev007-NungUm` ไม่เคยรัน เพราะ CI ทำงานเฉพาะ push เข้า `main` และ PR

**ทำไมต้องแก้** PR จาก `dev001-Ink` หรือ `dev007-NungUm` เข้า `main` จะแดงทันที

**วิธีแก้** ทางใดทางหนึ่ง: แก้ 6 จุดตามคำแนะนำของ ruff (`ruff check --fix` แก้ได้ 1 จุด ที่เหลือเปลี่ยน lambda เป็น `def` และย้าย import ขึ้นบน), ใส่ `exclude = ["frontend/logo"]` ใน `ruff.toml`, หรือย้ายสคริปต์กับรูปต้นฉบับออกจาก repo เพราะแอปใช้แค่ `logo.svg` / `Logo.jsx`

**เสร็จเมื่อ** `ruff check .` ผ่านที่รากโปรเจกต์

### DE-17 ช่องแบบสำรวจที่ว่างถูกเติม 3 ทำให้ความเสี่ยงต่ำกว่าจริง

**ปัญหา** ไฟล์นำเข้ารอบนี้ให้ช่องแบบสำรวจ 5 ช่อง (`JobSatisfaction`, `EnvironmentSatisfaction`, `RelationshipSatisfaction`, `JobInvolvement`, `WorkLifeBalance`) เว้นว่างหรือไม่มีคอลัมน์ได้ แล้วระบบเติม 3 ให้เอง (`SURVEY_DEFAULT` ใน `employee_upload.py`) ซึ่งในสเกลนี้ 3 แปลว่า "สูง"/"ดี" และเป็นค่าที่ทำให้ความเสี่ยงต่ำ ผลตรวจไฟล์ไม่บอกว่าเติมให้กี่คน (comment ในโค้ดยอมรับไว้แล้วว่า "ไม่ได้สะท้อนตัวคนจริง")

**หลักฐาน** ให้คะแนนพนักงาน IBM ทั้ง 1,470 คนสองแบบ: ใช้ค่าแบบสำรวจจริง กับเติม 3 ทั้ง 5 ช่อง (จำลองบริษัทที่ไม่มีแบบสำรวจ)

| | แบบสำรวจจริง | เติม 3 ทุกช่อง |
| :--- | :--- | :--- |
| คะแนนเฉลี่ย | 0.326 | 0.259 |
| เสี่ยงสูง / กลาง / ต่ำ | 185 / 274 / 1,011 | 105 / 232 / 1,133 |
| คนที่ลาออกจริงที่อยู่ในกลุ่มเสี่ยงสูง | 154 | 91 |
| AUC (in-sample) | 0.930 | 0.893 |

ใน 185 คนที่เสี่ยงสูงตามแบบสำรวจจริง เหลือเสี่ยงสูงแค่ 99 คน ส่วน 1,078 คนที่ตอบแบบสำรวจได้ 1 หรือ 2 อย่างน้อยหนึ่งช่อง คะแนนเฉลี่ยลดจาก 0.353 เหลือ 0.257 · อัปโหลดไฟล์ที่ไม่มีคอลัมน์แบบสำรวจเลยได้ "ผ่าน 5 / 5" โดยไม่มีคำเตือน

**ทำไมต้องแก้** บริษัทไทยส่วนใหญ่ไม่มีแบบสำรวจความพึงพอใจทุกคน กลุ่มนี้จะเห็นว่าพนักงานเสี่ยงน้อยกว่าความจริงเกือบครึ่ง และ HR จะไม่รู้ว่าเป็นเพราะข้อมูลไม่ครบ

**วิธีแก้**
1. ผลตรวจไฟล์บอกจำนวนคนที่ถูกเติมค่า และหน้า SHAP/What-if ของคนนั้นขึ้นป้าย "ไม่มีข้อมูลแบบสำรวจ ผลอาจต่ำกว่าจริง"
2. เก็บใน DB ว่าค่าไหนเป็นค่าที่เติม (เช่นคอลัมน์ `survey_imputed`) จะได้กรองออกจากสรุปหรือแสดงแยก
3. ระยะยาว: เทรนโมเดลอีกตัวที่ไม่ใช้ฟีเจอร์แบบสำรวจ แล้วใช้กับคนที่ไม่มีข้อมูล แทนการเติมค่ากลาง

**เสร็จเมื่อ** อัปโหลดไฟล์ที่ไม่มีคอลัมน์แบบสำรวจแล้วเห็นคำเตือนพร้อมจำนวนคน

### DE-18 ระยะทางที่ปรับตาม WFH แสดงเหมือนเป็นระยะทางจริง

**ปัญหา** ฟีเจอร์ WFH ใหม่ (`model_store.commute_adjusted`) ลดระยะทางจากบ้านตามสัดส่วนวันเข้าออฟฟิศก่อนส่งเข้าโมเดล (`ระยะทาง × วัน / 5` ต่ำสุด 1) โค้ดเขียนไว้ชัดว่าเป็นการประมาณ เพราะโมเดลไม่เคยเรียนเรื่อง WFH แต่หน้า SHAP แสดงค่าที่ปรับแล้วในช่อง "ระยะทางจากบ้าน" เหมือนเป็นระยะทางจริง

**หลักฐาน** นำเข้าพนักงาน 3 คน บ้านห่าง 24 กม. เท่ากัน ทำ OT ทุกคน ต่างกันแค่วันเข้าออฟฟิศ

| เข้าออฟฟิศ | คะแนน | ค่า `DistanceFromHome` ที่ `/shap` ส่งให้หน้าเว็บ |
| :--- | :--- | :--- |
| 5 วัน | 0.905 | 24 |
| 1 วัน | 0.818 | 5 |
| 0 วัน | 0.691 | 1 |

ใน What-if พนักงาน #19 ปรับ WFH ทุกวันคะแนนลดจาก 0.957 เหลือ 0.829 ผลขนาดนี้มาจากสูตรประมาณล้วนๆ

**ทำไมต้องแก้** HR จะอ่านว่าพนักงานบ้านห่าง 1 กม. และอาจเชื่อว่าให้ WFH แล้วลดความเสี่ยงได้จริงตามตัวเลข ทั้งที่ยังไม่มีข้อมูลยืนยัน

**วิธีแก้** หน้า SHAP แสดงระยะทางจริงคู่กับ "คิดเป็นการเดินทาง X กม./วัน ตาม WFH" ในหน้า What-if ใต้ตัวเลือก WFH บอกว่าเป็นสมมติฐาน (มีอยู่แล้วใน hint ของ What-if ให้ยกขึ้นมาใกล้ผลลัพธ์) และใส่ในรายงานว่าเป็น heuristic ที่ต้องตรวจกับข้อมูลจริงก่อนใช้ตัดสินใจ

**เสร็จเมื่อ** หน้า SHAP ของคนที่ WFH แสดงระยะทางจริงและบอกว่าค่าที่โมเดลใช้ถูกปรับ

### QA-06 pull schema ใหม่แล้ว DB เก่าทำให้บันทึกไฟล์ได้ 500

**ปัญหา** รอบนี้ตาราง `employees` มีคอลัมน์ใหม่ `office_days_per_week` ไฟล์ `02-app-schema.sql` มี `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ไว้แล้ว แต่ไฟล์นี้รันเองแค่ตอนสร้าง volume ใหม่ คนที่มี DB อยู่แล้ว (ทุกคนที่ทำตาม run guide รอบก่อน) ต้องรันเอง และ run guide บอกให้รันซ้ำเฉพาะกรณี "volume เก่าที่สร้างก่อนมี schema"

**หลักฐาน** สร้าง database ชั่วคราวด้วย schema ของ `5c505a6` แล้วรัน backend ใหม่: `/shap/1` ได้ 200 ตามปกติ แต่ `/employees/import` ได้ `500 Internal Server Error` (psycopg ไม่เจอคอลัมน์ ซึ่งโค้ดจับแค่ `IntegrityError`) DB ในเครื่องที่ใช้ตรวจก็ไม่มีคอลัมน์นี้จนกว่าจะรัน schema ซ้ำ

**ทำไมต้องแก้** เพื่อนในทีมจะเจอ 500 ตอนลองบันทึกไฟล์ โดยหน้าอื่นใช้ได้ปกติจนไม่มีใครนึกถึง schema และทุกครั้งที่แก้ schema จะเกิดซ้ำ

**วิธีแก้**
1. ตอน backend เปิด ให้รัน `02-app-schema.sql` เอง (ไฟล์เขียนให้รันซ้ำได้อยู่แล้ว) หรือเช็กคอลัมน์ที่ต้องมีแล้วแจ้งข้อความชัดๆ ใน log
2. จับ `psycopg.errors.UndefinedColumn` ใน import แล้วตอบ 503 "ฐานข้อมูลยังไม่อัปเดต ให้ผู้ดูแลรันคำสั่ง ..."
3. แก้ run guide ให้บอกว่าหลัง pull ที่แก้ `docker/postgres/init/` ให้รันคำสั่งนี้ทุกครั้ง

**เสร็จเมื่อ** DB ที่ยังไม่มีคอลัมน์ใหม่ไม่ทำให้เกิด 500 และ run guide บอกขั้นตอนหลัง pull

### ข้อเดิมที่หนักขึ้นจากงานรอบนี้

- **SEC-15:** endpoint ใหม่ `/recalibrate/upload` เป็น `async def` ที่ fit โมเดลใน event loop เหมือนกัน วิธีแก้เดียวกับรอบ 3 (เปลี่ยนเป็น `def` หรือ `run_in_threadpool`)
- **DE-16:** batch ที่รันเองหลังนำเข้า/ปรับเทียบ/ยกเลิกทำให้ cache กลับมาเร็ว (ดี) แต่ทุกรอบเก็บ SHAP ครบทุกคน ควรทำ retention พร้อมกัน หรือให้รอบอัตโนมัติเก็บแค่ตารางสรุป
- **DE-11:** หน้าปรับเทียบบอกผู้ใช้ว่าทุกหน้าเปลี่ยนแล้ว ถ้ายังไม่แก้ฝั่ง summary ให้แก้ข้อความนี้ก่อน

---

## 5. ทดสอบแบบลูกค้า

### 5.1 ฝ่ายบุคคล (HR)

| งานที่ลอง | ผล |
| :--- | :--- |
| เข้าสู่ระบบ | ผ่าน หน้า login ใหม่ดูเป็นผลิตภัณฑ์มากขึ้น มีปุ่มแสดงรหัสผ่าน · ชื่อ accessible ของช่องรหัสผ่านอ่านเป็น "รหัสผ่าน แสดงรหัสผ่าน" (ป้ายของปุ่มปนเข้ามา เรื่องเล็ก) |
| ใครเสี่ยงบ้าง | ผ่าน เมนูเห็นครบบนโน้ตบุ๊กแล้ว ระดับตำแหน่งเป็นคำไทย |
| ทำไมคนนี้เสี่ยง | ผ่าน แต่ยังยกอายุเป็นสาเหตุหลัก (UX-06) และระยะทางของคนที่ WFH ไม่ใช่ระยะทางจริง (DE-18) |
| ลองมาตรการ | ผ่าน มีปุ่ม "ให้ WFH 3 วัน" ใหม่ |
| ดูพนักงานที่เพิ่งนำเข้า | ผ่าน กดชื่อจากผลบันทึกไปหน้า SHAP ได้ |

**ผลสำหรับ HR: ใช้ได้ดีสำหรับ demo** ดีขึ้นจากรอบ 3 ที่จุดสะดุดเรื่องเมนูหายไปแล้ว เหลือเรื่องเหตุผลที่เป็นข้อมูลส่วนตัว

### 5.2 ฝ่ายการเงิน

| งานที่ลอง | ผล |
| :--- | :--- |
| ต้นทุนการลาออกทั้งบริษัท | ยังเป็น 974,910,884 บาท ทั้งก่อนและหลังปรับเทียบ (ควรเหลือราว 458 ล้านหลังปรับเทียบ) |
| เทียบมาตรการของ 1 คน | สูตรยังโปร่งใส แต่ "ส่วนต่างถ้ารักษาไว้ได้" ยังเป็นบวกทุกคน (UX-15) |
| เงินเดือนพื้นฐาน | ยังคูณ 35 จาก IBM มัธยฐาน 172,165 บาท/เดือน |

**ผลสำหรับการเงิน: ยังใช้ตัดสินใจไม่ได้** ไม่มีอะไรเปลี่ยนในมุมนี้ และหลังปรับเทียบตัวเลขยิ่งขัดกันเอง

### 5.3 ผู้ดูแลระบบ

| งานที่ลอง | ผล |
| :--- | :--- |
| ปรับเทียบโมเดล | ผ่าน และใช้ง่ายที่สุดในระบบ: ดาวน์โหลดไฟล์ทดลอง 300 คน อัปโหลดกลับ ได้ Brier 0.099 → 0.069 กราฟสูตรแปลง ตัวอย่าง 20 → 6, 40 → 15, 60 → 32, 80 → 56 และประวัติ บอกตรงๆ ว่าตัวเลขวัดบนข้อมูลชุดเดียวกันจึงดูดีกว่าจริง |
| ยกเลิกการปรับเทียบ | ผ่าน มีหน้าต่างยืนยันก่อนลบ · ยกเลิกแล้วประวัติหายทั้งหมด ไม่เหลือร่องรอยว่าเคยปรับเทียบ (ควรเก็บไว้สำหรับ audit ใน SEC-09) |
| บันทึกไฟล์พนักงาน | ผ่าน หน้าอื่นอัปเดตเอง มีลิงก์ไปดูคนที่เพิ่งนำเข้า · ไฟล์ที่ไม่มีคอลัมน์แบบสำรวจผ่านเงียบๆ (DE-17) |
| อัปเดตระบบหลัง pull | DB เดิมต้องรัน schema เอง ไม่งั้นบันทึกไฟล์ได้ 500 (QA-06) |
| จัดการผู้ใช้ / ประวัติการเข้าถึง | ยังทำไม่ได้ (SEC-01, SEC-09) |

**ผลสำหรับผู้ดูแลระบบ: ดีขึ้นมาก** ปรับเทียบและนำเข้าทำได้เองครบจากหน้าเว็บ ที่ขาดคือระบบผู้ใช้และคำเตือนเรื่องข้อมูลไม่ครบ

---

## 6. จุดที่ทำได้ดีรอบนี้

- หน้าปรับเทียบอธิบายเรื่องยากให้ผู้ดูแลระบบเข้าใจได้จริง มีข้อมูลทดลอง กราฟ ตัวอย่างก่อน/หลัง ประวัติ และเลือก Platt เป็นค่าเริ่มต้นที่เหมาะกับข้อมูลน้อย
- แก้ข้อจากรอบ 3 ตรงจุด: UX-13 ด้วย layout ที่รองรับจอเตี้ย, UX-18 ด้วยตัวนับ `dataVersion`, DE-01 ย้ายอัตราไปที่เดียวพร้อม test, DE-02 ตรวจทีละแถวในเส้นทางหน้าเว็บ
- endpoint ใหม่ทุกตัวผ่าน login, จำกัดสิทธิ์ admin และกันไฟล์ใหญ่/zip bomb เหมือนเส้นทางเดิม
- batch ที่รันเองใช้ lock กันรันซ้อน และ log แค่ชนิด error ไม่มีข้อมูลพนักงาน
- ถอด recharts ออก หน้า SHAP โหลดเบาลงมาก (362 KB → 9 KB)
- Dependabot ทำงานจริงแล้ว (PR #2 merge แล้ว CI ผ่าน)

---

## 7. งานแยกรายคน

### ทั้งทีม

- [ ] ยืนยันลำดับในเอกสารนี้ และวิธี merge `dev001-Ink` / `dev007-NungUm` เข้า `main` ผ่าน PR (หลังแก้ QA-05)
- [ ] DE-17 ตกลงว่าไม่มีแบบสำรวจแล้วจะทำอย่างไร (เตือนอย่างเดียว หรือแยกโมเดล)
- [ ] DE-18 ตกลงว่า WFH จะอยู่ในเดโมแบบไหน และเขียนเป็นสมมติฐานในรายงาน

### Saphondanai

- [ ] UX-15 สูตรผลคุ้มทุน (ค้างจากรอบ 3)
- [ ] DE-11 ข้อ 1: `predict.py`, `whatif.py`, `financial_impact.py` ใช้ tenant จาก token (ค้างจากรอบ 3)
- [ ] UX-04 / DE-10 `model_validator` ใน `schemas.py` รวม `OfficeDaysPerWeek`
- [ ] QA-01 ตั้ง `DATABASE_URL` ใน CI, QA-06 แก้ run guide เรื่องรัน schema หลัง pull
- [ ] SEC-11 ruleset ของ `main` และเปิด Dependabot alerts

### Puripat

- [ ] QA-05 ruff ของ `frontend/logo/vectorize_logo.py` (ก่อนเปิด PR)
- [ ] DE-11 ข้อ 2–3: summary ใช้คะแนนปรับเทียบ หรือแก้ข้อความในหน้าปรับเทียบ
- [ ] DE-17 คำเตือนเมื่อเติมค่าแบบสำรวจ, DE-18 แสดงระยะทางจริงในหน้า SHAP
- [ ] QA-06 รัน schema ตอนเปิด backend หรือจับ `UndefinedColumn`
- [ ] SEC-15 `/employees/*` และ `/recalibrate/upload` ออกจาก event loop + limit ของ validate
- [ ] DE-12 ค่าเริ่มต้นของ API เป็น Platt เหมือนหน้าเว็บ + กรอง `model_version`
- [ ] ข้อค้างจากรอบ 3: UX-06, UX-14, SEC-16, DE-15, DE-16

### Yanisa / Nanthamon

- [ ] DE-13 API ของ `interventions` และการบันทึกผลลาออก
- [ ] DE-17 ใช้ตัวเลขในหัวข้อนี้ประกอบ Fairness / ข้อจำกัดในรายงาน (กลุ่มที่ไม่มีแบบสำรวจได้คะแนนต่ำกว่าจริง)

---

## 8. ความเห็นทีม

(เขียนเหตุผลถ้าไม่เห็นด้วยกับข้อไหน ระบุ ID)

---

## ภาคผนวก

### A. สคริปต์ยิง API แบบ in-process

บันทึกเป็นไฟล์นอก repo แล้วรันจากโฟลเดอร์ `backend/` ด้วย `.venv` ของโปรเจกต์ (ใช้โหมด CSV และโฟลเดอร์ชั่วคราวสำหรับค่าปรับเทียบ ไม่แตะ DB)

```bash
cd backend
PYTHONIOENCODING=utf-8 MLFLOW_DISABLE_AGENT_HINT=1 ../.venv/Scripts/python.exe path/to/r4probe.py
```

<details>
<summary>r4probe.py (กดเพื่อเปิด)</summary>

```python
"""Round-4 in-process probes (run from backend/): real auth, CSV mode, calibration files in a temp dir."""
import base64, io, json, os, sys, tempfile, time, zipfile  # noqa: E401

os.environ["DATABASE_URL"] = ""
sys.path.insert(0, os.getcwd())
import calibration  # noqa: E402
calibration.STORE = tempfile.mkdtemp(prefix="cal_")

import pandas as pd  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sklearn.metrics import roc_auc_score  # noqa: E402
import auth, business_rules, model_store as ms  # noqa: E402,E401
from main import app  # noqa: E402
from routers import employee_upload as eu  # noqa: E402

c = TestClient(app, raise_server_exceptions=False)
PW = {"hr_demo": "hr-demo-1234", "admin_demo": "admin-demo-1234"}
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
def login(u): return {"Authorization": "Bearer " + c.post("/auth/login", json={"username": u, "password": PW[u]}).json()["access_token"]}
def reset(): [lim.reset() for lim in [auth.login_limit, *auth.LIMITS.values()]]
HR, AD = login("hr_demo"), login("admin_demo"); reset()
c.get("/shap/1", headers=HR)

# 1-2. routes without token, role checks on the new calibration endpoints
for path, ops in app.openapi()["paths"].items():
    for m in ops:
        print(m.upper(), path, c.request(m.upper(), path.replace("{employee_id}", "1")).status_code)
print("HR template/upload/delete/history:", c.get("/recalibrate/template", headers=HR).status_code,
      c.post("/recalibrate/upload", headers=HR, files={"file": ("a.csv", b"x\n1")}).status_code,
      c.delete("/recalibrate", headers=HR).status_code, c.get("/recalibrate/history", headers=HR).status_code)

# 3. SEC-16
print("non-ascii signature:", c.get("/auth/me", headers=[(b"authorization", "Bearer abc.ไทย".encode())]).status_code)

# 7. files without survey columns pass silently (DE-17)
raw = ms.raw_employees(); cols = [f for f, _, _ in eu.COLUMNS if f in raw]
r = c.post("/employees/validate", headers=HR, files={"file": ("s.csv", raw[[f for f in cols if f not in eu.SURVEY_FIELDS]].head(5).to_csv(index=False).encode())}).json()
print("no survey columns:", r["n_valid"], "valid,", r["missing_columns"], r["note"])

# 9. WFH effect (DE-18)
for d in (5, 3, 1, 0):
    print("office days", d, c.post("/whatif", headers=HR, json={"employee_id": 19, "changes": {"OfficeDaysPerWeek": d}}).json()["after"]["risk_score"])

# 10. DE-02: JSON path vs file upload path
good = raw.sample(300, random_state=0)
reset(); print("JSON Marketing:", c.post("/recalibrate", headers=AD, json={"records": json.loads(good.assign(Department="Marketing").to_json(orient="records"))}).status_code)
demo = c.get("/recalibrate/template", params={"demo": True}, headers=AD).content
bad = pd.read_excel(io.BytesIO(demo), sheet_name="พนักงาน"); bad.loc[:9, "แผนก"] = "Marketing"
buf = io.BytesIO(); bad.to_excel(buf, index=False)
reset(); print("upload with bad rows:", c.post("/recalibrate/upload", headers=AD, files={"file": ("b.xlsx", buf.getvalue(), XLSX)}).json()["check"]["n_invalid"])

# 11. API default (isotonic) with the demo file: how many people end up at 1.0 (DE-12)
reset(); res = c.post("/recalibrate/upload", headers=AD, files={"file": ("demo.xlsx", demo, XLSX)}).json()["result"]
X = ms.employee_features(); p = ms.risk_scores(X); pc = calibration.apply(calibration.load("ibm_demo"), p)
print(res["method"], "examples", [(e["before"], round(e["after"], 3)) for e in res["examples"]], "| at 1.0:", int((pc >= 0.999).sum()))
reset(); c.delete("/recalibrate", headers=AD)

# 12. survey left empty -> 3 (DE-17)
y = (raw.set_index("EmployeeNumber").loc[X.index, "Attrition"] == "Yes").astype(int)
imp = raw.copy()
for f in eu.SURVEY_FIELDS: imp[f] = eu.SURVEY_DEFAULT
p3 = ms.risk_scores(ms.to_features(imp))
bands = lambda s: pd.Series([business_rules.risk_band(v) for v in s]).value_counts().to_dict()  # noqa: E731
print(f"real: mean {p.mean():.3f} {bands(p)} AUC {roc_auc_score(y, p):.3f} leavers in High {int(y[p >= .7].sum())}")
print(f"all 3: mean {p3.mean():.3f} {bands(p3)} AUC {roc_auc_score(y, p3):.3f} leavers in High {int(y[p3 >= .7].sum())}")
```

</details>

### B. ทดสอบกับ PostgreSQL

ใช้ Git Bash จากรากโปรเจกต์ (activate `.venv` แล้ว และ `.env` มี `DATABASE_URL`)

```bash
# DB ที่สร้างก่อนรอบนี้ต้องรัน schema ซ้ำ (QA-06) ไม่งั้นบันทึกไฟล์ได้ 500
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U attrition -d attrition < docker/postgres/init/02-app-schema.sql

q() { docker compose exec -T postgres psql -U attrition -d attrition -tAc "$1"; }
# DE-11: หลังปรับเทียบผ่านหน้าเว็บ (batch รันเองหลังปรับเทียบ) เทียบตารางผลทำนายกับตารางสรุป
q "select risk_band, count(*) from attrition_predictions where scored_at = (select max(scored_at) from attrition_predictions) group by 1"
q "select risk_bands from company_risk_summary where department is null order by generated_at desc limit 1"
# DE-16: จำนวนรอบ batch ที่เก็บไว้และขนาด DB
q "select count(distinct generated_at) from company_risk_summary"; q "select pg_size_pretty(pg_database_size('attrition'))"

# QA-06: จำลอง DB ที่ยังเป็น schema รอบก่อนใน database ชั่วคราว แล้วลบทิ้ง
docker compose exec -T postgres psql -U attrition -d attrition -c "CREATE DATABASE attrition_mig;"
git show 5c505a6:docker/postgres/init/02-app-schema.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U attrition -d attrition_mig -q
# รัน src/db.py และเรียก /employees/import ด้วย DATABASE_URL ที่ชี้ .../attrition_mig แล้วจะได้ 500
docker compose exec -T postgres psql -U attrition -d attrition -c "DROP DATABASE attrition_mig;"

# ล้างข้อมูลทดสอบ (รหัสเกิน 2068 = ไม่ใช่ IBM) ค่าปรับเทียบ และผล batch แล้วโหลด IBM กลับ
q "delete from employees where tenant_id = 'ibm_demo' and employee_id > 2068"
q "delete from tenant_calibrations"
q "truncate attrition_predictions, shap_explanations, financial_impact_estimates, company_risk_summary cascade"
python src/db.py && python backend/batch_score.py      # แล้ว restart backend (DE-15: ข้อมูลเก่าค้างใน memory)
```
