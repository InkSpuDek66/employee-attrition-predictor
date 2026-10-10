# รายงานตรวจโปรเจกต์ มุมมอง Cyber Security

| หัวข้อ | รายละเอียด |
| :--- | :--- |
| วันที่ตรวจ | 1 ต.ค. 2026 (ทีมอยู่ wk2 ช่วง Modeling) |
| รอบการตรวจ | รอบ 1 อ่านโค้ดและ config · รอบ 2 (วันเดียวกัน) ทดสอบจริงในส่วนที่รอบ 1 ระบุเป็นข้อจำกัด: ยิง API, สแกน dependency, ตรวจการตั้งค่า GitHub/DagsHub, สแกน notebook |
| เวอร์ชันที่ตรวจ | โค้ด: commit `45f926a` บน `main` (ตรงกับ `dev001-Ink` ณ วันตรวจ) commit `fc4a969` ที่ตามมาแก้แค่ notebook/เอกสาร/requirements ไม่ได้แก้โค้ดที่ตรวจ · การตั้งค่า GitHub/DagsHub: ค่าจริง ณ วันตรวจ |
| ผู้ตรวจ | Claude Code (AI, Claude Opus 5.5) รับบท senior security engineer ตามคำขอของ Saphondanai |
| ผู้ดูแลเอกสาร | Saphondanai (ถามหรือแย้งได้ที่ Saphondanai) |
| สถานะ | รอทีมยืนยันผู้รับผิดชอบและกำหนดเสร็จ |
| เอกสารชุดเดียวกัน | [Data Engineering](round1-2_data_engineering_S.md) · Security (ไฟล์นี้) · [UX/UI](round1-2_ux_ui_S.md) |

**วิธีใช้เอกสารนี้**

1. อ่าน [1. สรุป](#1-สรุป) ก่อน
2. หาชื่อตัวเองใน [6. งานแยกรายคน](#6-งานแยกรายคน) แล้วกดลิงก์ไปอ่านรายละเอียด
3. แก้เสร็จแล้วให้ติ๊ก checkbox พร้อมใส่ commit hash
4. ถ้าไม่เห็นด้วยกับข้อไหน ให้เขียนเหตุผลไว้ใน [7. ความเห็นทีม](#7-ความเห็นทีม)

> ผู้รับผิดชอบที่ระบุในเอกสารนี้เป็นข้อเสนอ อ้างอิงจาก [TASKS.md](../../TASKS.md) และผู้เขียนไฟล์ใน git log ทีมต้องยืนยันกันอีกครั้ง
> บัญชี git ที่ใช้อ้างอิง: `Ink-SPU` = Saphondanai, `NungUmSudNaRak` (commit ขึ้นต้น Dev007) = Puripat (อนุมานจาก commit ที่ตรงกับงานของ Puripat ใน TASKS.md)

---

## 1. สรุป

ตอนนี้ระบบรันแค่ในเครื่องและใช้ข้อมูล synthetic ความเสียหายจริงจึงยังต่ำ แต่ README หัวข้อ 8 วางแผนจะ deploy ขึ้น Render (อินเทอร์เน็ตสาธารณะ) และขายเรื่อง "ใช้กับข้อมูลพนักงานไทยจริงผ่าน `/recalibrate`" เมื่อถึงจุดนั้น 2 ข้อแรกจะกลายเป็นช่องโหว่ร้ายแรงทันที

- **SEC-01:** API ไม่มีการยืนยันตัวตนเลย และคืนข้อมูลส่วนตัวของพนักงานทั้งก้อน ทดสอบจริงแล้ว ไม่ต้อง login ก็ดึงข้อมูลได้ครบ 1,470 คน คนละ 30 ฟิลด์ ใน 76 วินาที
- **SEC-02:** ไม่ได้แยกข้อมูลของแต่ละบริษัท (tenant) ออกจากกัน ทดสอบจริงแล้ว ใครก็เขียนทับค่าปรับเทียบของบริษัทอื่นได้ จน "ลำดับความเสี่ยงกลับหัว" (AUC จาก 0.93 เหลือ 0.07)

รอบ 2 เจอเพิ่มอีก 3 ข้อ:
- **SEC-11:** branch `main` บน GitHub ไม่มีการป้องกัน
- **SEC-12:** repo บน DagsHub เป็นสาธารณะ คนที่ไม่ได้ login ดาวน์โหลดโมเดลและแถวข้อมูลตัวอย่างได้
- **SEC-13:** output ของ notebook มี path ในเครื่องหลุดอยู่

ส่วนพื้นฐานที่ทีมทำไว้ดีแล้ว: ไม่มี secret หลุดเข้า git (GitHub เปิด secret scanning + push protection ไว้ด้วย), port ผูกไว้ที่ localhost, มีการตรวจ input ด้วย Pydantic และ dependency ทั้ง Python (195 ตัว) และ npm (106 ตัว) ยังไม่มีช่องโหว่ที่รู้จัก ณ วันตรวจ

ระดับความรุนแรงแยกเป็น 2 บริบท:
- ตอนนี้ คือรันในเครื่องด้วยข้อมูล synthetic
- ก่อน deploy คือขึ้น Render หรือใช้ข้อมูลจริง

| ID | ตอนนี้ | ก่อน deploy | เรื่อง | ผู้รับผิดชอบ (เสนอ) | เสนอให้เสร็จ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [SEC-01](#sec-01-api-ไม่มีการยืนยันตัวตน-และคืนข้อมูลส่วนตัวทั้งก้อน) | กลาง | สูง | API ไม่มี auth และคืนข้อมูลส่วนตัวทั้งก้อน | ทั้งทีมเลือกวิธี แล้ว Saphondanai + Puripat ทำ | ก่อน deploy (ไม่ช้ากว่า wk8–9 ช่วง integration) |
| [SEC-02](#sec-02-ไม่ได้แยกข้อมูลของแต่ละบริษัท-tenant-isolation) | กลาง | สูง | ไม่แยกข้อมูลแต่ละบริษัท `tenant_id` มาจากผู้ใช้เอง | Puripat (หลัก), Saphondanai | พร้อม SEC-01 |
| [SEC-03](#sec-03-ไม่จำกัดขนาดข้อมูลและจำนวนครั้งที่เรียก) | ต่ำ | กลาง | ไม่จำกัดขนาดข้อมูลและจำนวนครั้งที่เรียก | Puripat | ก่อน deploy |
| [SEC-04](#sec-04-backend-ถือ-token-ส่วนตัวที่เขียน-mlflow-ได้) | ต่ำ | กลาง | backend ถือ DagsHub token ส่วนตัวที่เขียนได้ | Saphondanai | ก่อน deploy |
| [SEC-05](#sec-05-ความเสี่ยงจากไฟล์โมเดล-model-supply-chain) | ต่ำ | กลาง | ความเสี่ยงจากไฟล์โมเดล (model supply chain) | Saphondanai | ตอนตัดสินใจ DE-03 |
| [SEC-06](#sec-06-dependency-และ-ci-ยังไม่ได้ป้องกันเรื่อง-supply-chain) | ต่ำ | กลาง | dependency และ CI ยังไม่ป้องกัน supply chain | Saphondanai | พร้อม DE-05 (ก่อน Data Gate) |
| [SEC-07](#sec-07-หน้า-streamlit-เปิดให้ทุกเครื่องใน-network-เดียวกันเข้าได้) | ต่ำ | ต่ำ | หน้า Streamlit เปิดให้เครื่องอื่นใน network เดียวกันเข้าได้ | Puripat | ทำได้ทันที |
| [SEC-08](#sec-08-error-เปิดเผยรายละเอียดภายใน-และเปิดหน้า-docs-สาธารณะ) | ต่ำ | ต่ำ | error เปิดเผยรายละเอียดภายใน และ `/docs` เปิดสาธารณะ | Puripat + Saphondanai | ก่อน deploy |
| [SEC-09](#sec-09-pdpa-ไม่มีบันทึกการเข้าถึงและนโยบายข้อมูล) | ต่ำ | กลาง | PDPA: ไม่มีบันทึกการเข้าถึงและนโยบายข้อมูล | เจ้าของ backend + Saphondanai (รายงาน) | audit log หลัง DE-04, รายงานก่อน Model Gate |
| [SEC-10](#sec-10-สิ่งที่ต้องตั้งค่าตอน-deploy) | ไม่เกี่ยว | กลาง | สิ่งที่ต้องตั้งค่าตอน deploy (CORS, HTTPS, Superset) | Puripat + Nanthamon | ตอน deploy |
| [SEC-11](#sec-11-branch-main-บน-github-ไม่มีการป้องกัน) (รอบ 2) | กลาง | กลาง | branch `main` ไม่มีการป้องกัน push ตรงหรือ force-push ได้ | Saphondanai (admin ของ repo) | ทำได้ทันที (~10 นาที) |
| [SEC-12](#sec-12-repo-บน-dagshub-เป็นสาธารณะ-ดาวน์โหลดโมเดลและข้อมูลตัวอย่างได้โดยไม่ต้อง-login) (รอบ 2) | ต่ำ | สูง ถ้าใช้ข้อมูลจริง | repo บน DagsHub เป็นสาธารณะ ดาวน์โหลดโมเดลและข้อมูลตัวอย่างได้โดยไม่ต้อง login | Saphondanai | ก่อนใช้ข้อมูลจริงใด ๆ |
| [SEC-13](#sec-13-output-ของ-notebook-มี-path-ในเครื่องหลุดอยู่) (รอบ 2) | ต่ำ | ต่ำ | output ของ notebook มี path ในเครื่องหลุดอยู่ | Puripat + Saphondanai | ถ้ามีเวลา |

**ระดับความรุนแรง**
- สูง: เปิดทางให้ข้อมูลส่วนบุคคลรั่วหรือถูกแก้โดยคนที่ไม่มีสิทธิ์
- กลาง: ช่องโหว่ที่ต้องปิดก่อน deploy
- ต่ำ: เป็นการเสริมความแข็งแรง (hardening) หรือเอกสาร
- ไม่เกี่ยว: ข้อนี้ยังไม่มีผลในบริบทนั้น

---

## 2. ขอบเขตและขั้นตอนการตรวจ

### สิ่งที่ต้องปกป้อง และใครอาจโจมตี (threat model แบบย่อ)

| สิ่งที่ต้องปกป้อง | ทำไมสำคัญ |
| :--- | :--- |
| ข้อมูลพนักงาน (อายุ เพศ สถานภาพ เงินเดือน ความพึงพอใจ ผลประเมิน) | ข้อมูลส่วนบุคคลตาม PDPA บางส่วนอ่อนไหว |
| คะแนนความเสี่ยงรายคน | ถ้าหลุด อาจถูกใช้กดดันหรือเลือกปฏิบัติต่อพนักงาน |
| ค่าปรับเทียบ (calibration) ของแต่ละบริษัท | ถ้าถูกแก้ ทุกคำทำนายของบริษัทนั้นจะเพี้ยน |
| โมเดลใน MLflow Registry | ถ้าถูกเปลี่ยน backend จะโหลดโมเดลที่ไม่ได้ตั้งใจ |
| DagsHub token และรหัส PostgreSQL | ถ้าหลุดจะเข้าถึง registry และ database ได้ |

**ผู้โจมตีที่พิจารณา:**
- คนทั่วไปบนอินเทอร์เน็ต (หลัง deploy)
- คนใน Wi-Fi เดียวกัน เช่นในมหาวิทยาลัย
- ผู้ใช้ของบริษัทอื่นในระบบเดียวกัน
- บัญชี collaborator ที่ถูกยึด

**ช่องทางเข้า:** FastAPI 6 router, หน้า Streamlit ทดสอบ, MLflow/DagsHub, dependency และ CI

### ขั้นตอนที่ทำ

1. อ่านโค้ดทุกช่องทางเข้า: `backend/main.py`, `backend/routers/*.py`, `backend/schemas.py`, `backend/calibration.py`, `backend/model_store.py`, `src/mlflow_setup.py`, `src/test_app.py`, `frontend/src/*.jsx`, `frontend/vite.config.js`
2. ตรวจ config และ infrastructure: `docker-compose.yml`, `docker/`, `.github/workflows/ci.yml`, `.env.example`, `.gitignore`, `requirements.txt`, `frontend/package.json`
3. เทียบกับ checklist: [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) เป็นหลัก
4. ค้นหารูปแบบที่อันตราย: ทั้ง repo: `dangerouslySetInnerHTML`, `innerHTML`, `unsafe_allow_html`, `eval(`, `pickle`, `CORSMiddleware`, `token`, `password`
5. ตรวจ git history หา secret: ดูว่าเคยมี `.env` ถูก commit ไหม และเคยมีค่า `MLFLOW_TRACKING_PASSWORD=`/`POSTGRES_PASSWORD=` จริงอยู่ในทุก commit ของทุก branch ไหม ([ภาคผนวก](#ภาคผนวก-คำสั่งที่ใช้ตรวจ))
6. ตรวจค่า default ของเครื่องมือ: รัน `streamlit config show` ดูค่า `server.address`
7. วัดต้นทุนการคำนวณ: SHAP 1,470 แถวใช้เวลา 0.14 วินาที ใช้ประเมินความเสี่ยงเรื่อง DoS

**รอบ 2: ทดสอบจริงในส่วนที่รอบ 1 ยังไม่ได้ทำ**

8. ยิง API จริงแบบ in-process: ใช้ FastAPI `TestClient` (วิธีเดียวกับ `backend/test_api.py`) กับแอปจริงใน `backend/main.py`
   - สลับโมเดลจาก MLflow เป็นโมเดลที่เทรนซ้ำในเครื่องตามสูตร `train.py` จึงไม่ต้องเปิด server และไม่ต่อ DagsHub
   - ไฟล์ calibration เขียนลงโฟลเดอร์ชั่วคราวที่ลบทิ้งหลังรัน
   - ทดสอบ SEC-01, 02, 03, 08 และทดสอบกรณีที่ต้องถูกปฏิเสธ (path traversal) ([ภาคผนวก 5](#5-สคริปต์ยิง-api-แบบ-in-process-รอบ-2))
9. สแกน dependency หาช่องโหว่ที่รู้จัก
   - `npm audit` ใน `frontend/`
   - `pip-audit` กับแพ็กเกจที่ติดตั้งจริงใน `.venv` (ได้จาก `pip freeze`) โดยติดตั้ง `pip-audit` ใน venv ชั่วคราวนอกโปรเจกต์
10. ตรวจการตั้งค่า GitHub: ผ่าน `gh api` แบบอ่านอย่างเดียว ด้วยบัญชี InkSpuDek66 (เจ้าของ repo): การมองเห็น, collaborator, branch protection, rulesets, สิทธิ์ของ Actions, secret scanning, Dependabot, deploy keys
11. ตรวจ DagsHub: ผ่าน API แบบอ่านอย่างเดียว ดูการมองเห็นของ repo, collaborator และทดลองดาวน์โหลดโมเดลโดยไม่ใส่ credential เพื่อดูว่าคนนอกเห็นอะไรบ้าง (ไฟล์ที่ดาวน์โหลดลบทิ้งแล้ว)
12. สแกน notebook และ `docs/`: ทุกไฟล์ที่ track ใน git ทั้ง source และ output ของทุก cell หา secret, token, รหัสผ่าน, path ในเครื่อง, email, credential ใน URL และลิงก์ MLflow run

### สิ่งที่ยังไม่ได้ตรวจ (ข้อจำกัด)

รอบ 2 ปิดข้อจำกัดของรอบ 1 ไปได้เกือบหมด ที่เหลือมีดังนี้

| ข้อจำกัด | เหตุผล |
| :--- | :--- |
| ยังไม่ได้ทดสอบผ่าน network จริง (uvicorn + HTTP) | รอบ 2 ยิงแบบ in-process ซึ่งเป็นโค้ด route และ validation ชุดเดียวกับของจริง แต่ไม่ได้ทดสอบชั้น HTTP server เช่น TLS หรือ header ส่วนนี้ขึ้นกับตอน deploy (SEC-10) |
| ไม่ได้ตรวจ webhook ของ GitHub | token ของ `gh` ไม่มี scope `admin:repo_hook` ถ้าจะดูต้องรัน `gh auth refresh -s admin:repo_hook` ก่อน |
| DagsHub API ไม่บอกระดับสิทธิ์ของ collaborator | เห็นแค่รายชื่อ ต้องเข้าไปดูในหน้า Settings → Collaborators เอง |
| ไม่ได้สแกน Docker image (`ghcr.io/mlflow/mlflow:v3.16.1`, `postgres:17-alpine`) | ต้องใช้เครื่องมืออย่าง Trivy ซึ่งไม่มีในเครื่อง |
| ไม่ได้ตรวจ config ของ Render | ยังไม่ได้ deploy |
| ผลสแกน dependency ใช้ได้แค่ ณ วันตรวจ | ฐานข้อมูลช่องโหว่อัปเดตทุกวัน และ `requirements.txt` ไม่ได้ pin เครื่องที่ติดตั้งใหม่จึงอาจได้เวอร์ชันที่ต่างจากที่สแกน (SEC-06) |

---

## 3. จุดที่ทำได้ดี (ควรรักษาไว้)

- **ไม่มี secret ใน git:** `.env` อยู่ใน `.gitignore` และตรวจ history แล้วไม่เคยถูก commit ส่วน [.env.example](../../.env.example) ใช้แค่ placeholder
- **GitHub ช่วยกันอีกชั้น (ตรวจรอบ 2):** เปิด secret scanning และ push protection ไว้ (มี alert 0 รายการ), สิทธิ์เริ่มต้นของ workflow เป็น `read`, ไม่มี deploy key และ CI ไม่ได้ใช้ secret ใด ๆ
- **dependency ยังไม่มีช่องโหว่ที่รู้จัก (ตรวจรอบ 2):** `pip-audit` 195 แพ็กเกจ และ `npm audit` 106 แพ็กเกจ ผลเป็น 0 ทั้งคู่ ณ วันตรวจ
- **token แยกรายคน:** [docs/mlflow_setup.md](../mlflow_setup.md) ให้แต่ละคนสร้าง DagsHub token ของตัวเองและห้ามแชร์
- **service ไม่เปิดสู่ network ภายนอก:**
  - [docker-compose.yml](../../docker-compose.yml) bind PostgreSQL/MLflow ที่ `127.0.0.1` เท่านั้น
  - บังคับให้ตั้ง `POSTGRES_PASSWORD`
  - MLflow ตั้ง `--allowed-hosts` กัน DNS rebinding
- **ตรวจ input ที่ขอบระบบ:**
  - `EmployeeInput` ใช้ `Literal` + `extra="forbid"` ([schemas.py](../../backend/schemas.py))
  - `tenant_id` ผ่าน regex กัน path traversal ([calibration.py:17](../../backend/calibration.py#L17)) และมี test ครอบ (รอบ 2 ยิงจริงด้วย `tenant_id="../x"` ได้ 422)
- **frontend ปลอดภัยจาก XSS:** React escape output ให้เอง และไม่มี `dangerouslySetInnerHTML`
- **ค่า default ปลอดภัย:**
  - uvicorn bind `127.0.0.1` เป็นค่าเริ่มต้น
  - Vite proxy ทำให้ไม่ต้องเปิด CORS ช่วงพัฒนา
  - โมเดลโหลดผ่าน `mlflow.xgboost` ซึ่งเป็น native format ไม่ใช่ pickle
- **ตรวจแล้วไม่ใช่ปัญหา:** [docs/model_lab_S/index.html](../model_lab_S/index.html) ใช้ `innerHTML` แต่ข้อมูลมาจาก `results.json` ที่ทีมสร้างเอง ไม่ใช่ input จากผู้ใช้

---

## 4. รายการที่ต้องแก้ก่อน deploy

ทุกข้อใช้โครงเดียวกัน: ปัญหา → หลักฐาน → ทำไมต้องแก้ → วิธีแก้ → เสร็จเมื่อ → ผู้รับผิดชอบ

### SEC-01 API ไม่มีการยืนยันตัวตน และคืนข้อมูลส่วนตัวทั้งก้อน

ระดับ: ตอนนี้ กลาง, ก่อน deploy สูง (ตรงกับ OWASP API1 Broken Object Level Authorization + API3 Broken Object Property Level Authorization)

**ปัญหา:**
- ทุก endpoint ใน [backend/main.py](../../backend/main.py) ไม่มีการยืนยันตัวตน (authentication) และไม่มีการตรวจสิทธิ์ (authorization)
- `employee_id` เป็นเลขเรียง (EmployeeNumber 1–2068 มีจริง 1,470 เลข) จึงไล่เลขได้
- หลาย endpoint คืนข้อมูลเกินกว่าที่หน้าจอใช้:

| Endpoint | สิ่งที่คืน |
| :--- | :--- |
| `POST /whatif` | `employee` ทั้งก้อน ([whatif.py:31](../../backend/routers/whatif.py#L31)) รวม `Age`, `Gender`, `MaritalStatus`, `MonthlyIncome`, คะแนนความพึงพอใจ, ผลประเมิน |
| `GET /shap/{id}?top_n=100` | ค่าของทุกฟีเจอร์ของคนนั้น |
| `GET /financial-impact/{id}` | `monthly_income`, `years_at_company`, `job_level` |

**หลักฐาน (รอบ 2 ยิงจริงด้วย `TestClient` ไม่ส่ง token ใด ๆ):**

| ทดสอบ | ผล |
| :--- | :--- |
| `POST /whatif {"employee_id": 1}` | 200 ได้ `employee` มา 30 ฟิลด์ เช่น `Age 41, Gender "Female", MaritalStatus "Single", MonthlyIncome 5993, JobSatisfaction 4, PerformanceRating 3` |
| วน `employee_id` 1–2068 ที่ `/whatif` | ได้ข้อมูล ครบ 1,470 คน ใน 75.9 วินาที (หญิง 588 ชาย 882) |
| `GET /shap/1?top_n=100` | 200 ได้ค่าของทั้ง 50 ฟีเจอร์ รวม `Age 41`, `Gender 0`, `MaritalStatus_Single 1` |
| `GET /financial-impact/1` | 200 ได้ `monthly_income 5993` |

ตัวอย่างคำสั่งแบบ `curl` สำหรับ server จริงและสคริปต์ที่ใช้ อยู่ใน[ภาคผนวก](#ภาคผนวก-คำสั่งที่ใช้ตรวจ)

**ทำไมต้องแก้:**
- หลัง deploy ขึ้น Render ใครมี URL ก็ดึงข้อมูลพนักงานทั้งบริษัทได้ ถ้าเป็นข้อมูลจริงถือเป็นการละเมิด PDPA
- `/whatif` ที่รับ `employee` ทั้งก้อนยังเปิดให้ query โมเดลได้ไม่จำกัด (เสี่ยงถูกลอกโมเดล หรือ model extraction)

**วิธีแก้ (เรียงจากงานน้อยไปมาก):**
1. ตัดข้อมูลที่ไม่จำเป็นออกจาก response (ทำได้ทันที ไม่ต้องรอ auth)
   - ให้ `/whatif` คืนเฉพาะฟิลด์ที่ปรับได้ใน What-if ([WhatIfSimulator.jsx:6-25](../../frontend/src/WhatIfSimulator.jsx#L6-L25) ใช้แค่ชุดนี้)
   - ให้ `/shap` ไม่คืนค่าจริงของ protected attribute (Gender, Age, MaritalStatus)
   - ข้อควรระวัง: หน้า Streamlit [whatif_page.py](../../src/app_pages/whatif_page.py) เรียกฟังก์ชัน `whatif` ตรง ๆ และใช้ `result.employee` ทั้งก้อน ต้องเปลี่ยนไปใช้ `resolve_employee` ของ `routers/predict.py` แทน
2. ใส่ authentication ที่ระดับ router: ใช้ FastAPI dependency ตัวเดียว ครอบทุก router ใน `main.py` เช่น `app.include_router(predict.router, dependencies=[Depends(require_user)])`
   - ขั้นต่ำสำหรับ demo: login ด้วย username/password ของ HR แล้วได้ token (JWT หรือ session)
   - ห้ามใส่ API key ไว้ใน frontend: เพราะทุกคนที่เปิดเว็บเห็นได้
3. **แยก role:** HR ทั่วไปดูได้ ส่วน `/recalibrate` ให้เฉพาะ admin ของบริษัท (ดู SEC-02)
4. (ถ้ามีเวลา) ใช้ ID แบบสุ่ม (UUID) แทนเลขเรียงใน URL

**เสร็จเมื่อ:**
- request ที่ไม่มี token ได้ 401
- response ของ `/whatif` และ `/shap` ไม่มีฟิลด์ส่วนตัวที่หน้าจอไม่ได้ใช้
- มี test ครอบทั้งสองข้อใน `backend/test_*.py`

**ผู้รับผิดชอบ:**
- ทั้งทีม: เลือกวิธี auth (ประชุมเดียวกับเรื่อง DB ใน DE-04)
- Saphondanai: ทำ `/predict`, `/whatif`, `/financial-impact` และ `schemas.py`
- Puripat: ทำ `/shap`, `/recalibrate`, `/company-summary` และหน้า Streamlit

---

### SEC-02 ไม่ได้แยกข้อมูลของแต่ละบริษัท (tenant isolation)

ระดับ: ตอนนี้ กลาง, ก่อน deploy สูง (ตรงกับ OWASP API1 และ API5 Broken Function Level Authorization)

**ปัญหา:**
- `tenant_id` มาจากผู้ใช้เองผ่าน body หรือ query ([schemas.py:65](../../backend/schemas.py#L65), `/shap`, `/financial-impact`)
- หน้า React มีช่องให้พิมพ์ "รหัสบริษัท" เอง ([ShapViewer.jsx:59-62](../../frontend/src/ShapViewer.jsx#L59-L62), [WhatIfSimulator.jsx:138-141](../../frontend/src/WhatIfSimulator.jsx#L138-L141))
- `POST /recalibrate` เขียนทับไฟล์ calibration ของ `tenant_id` ใดก็ได้ ([recalibrate.py](../../backend/routers/recalibrate.py))
- ข้อมูลพนักงานเป็น CSV ชุดเดียว ไม่ได้ผูกกับ tenant

**หลักฐาน (รอบ 2 ยิงจริง):**
1. "บริษัท B" ปรับเทียบด้วยข้อมูลที่ถูกต้อง 300 แถว (`tenant_id="company_b"`, Platt) ได้ 200
2. "ผู้โจมตี" ไม่มี token ส่งข้อมูล 300 แถวเดียวกันแต่สลับ label ลาออก/ไม่ลาออก ไปที่ `tenant_id="company_b"` ได้ 200 และไฟล์ของบริษัท B ถูกเขียนทับ (สัมประสิทธิ์ Platt กลายเป็นค่าลบ −5.17)
3. ผลต่อบริษัท B (วัดบนพนักงานทั้ง 1,470 คน):

| ตัววัด | ก่อนถูกโจมตี | หลังถูกโจมตี |
| :--- | :--- | :--- |
| AUC ของคะแนนหลังปรับเทียบ | 0.93 | 0.07 (ลำดับกลับหัว) |
| คนที่เสี่ยงสูงสุด 10% (147 คน) อยู่ในระดับ "สูง" | 50 คน | 0 คน |
| คนที่เสี่ยงสูงสุด 10% ถูกจัดเป็นระดับ "ต่ำ" | — | 107 คน |

พูดง่าย ๆ คือ หลังถูกโจมตี ระบบจะบอก HR ของบริษัท B ว่าคนที่เสี่ยงที่สุด "ไม่ต้องห่วง" โดยไม่มีสัญญาณเตือนใด ๆ

**ทำไมต้องแก้:**
- ผู้ใช้บริษัท A พิมพ์ `tenant_id` ของบริษัท B ก็ใช้ calibration ของ B ได้
- ที่แย่กว่านั้นคือเรียก `/recalibrate` ด้วยข้อมูลขยะเพื่อทำให้คะแนนของบริษัท B เพี้ยนทั้งหมดโดยไม่มีใครรู้
- README หัวข้อ 6.5 ขายเรื่อง per-tenant calibration จึงน่าจะถูกถามตอน Defense

**วิธีแก้:**
1. เอา `tenant_id` มาจากตัวตนที่ login แล้ว (claim ใน token จาก SEC-01) ไม่รับจาก request อีก
2. ลบช่อง "รหัสบริษัท" ออกจาก UI (ผูกกับ UX-11 ใน [รายงาน UX/UI](round1-2_ux_ui_S.md))
3. ให้ `/recalibrate` เรียกได้เฉพาะ role admin ของ tenant นั้น
4. ตอนย้ายไป DB (DE-04) ทุกตารางที่เป็นข้อมูลของบริษัทต้องมีคอลัมน์ `tenant_id` และทุก query ต้องกรองด้วยค่านี้

**เสร็จเมื่อ:**
- request ที่ส่ง `tenant_id` ของคนอื่นมาจะถูกเพิกเฉยหรือได้ 403
- UI ไม่มีช่องรหัสบริษัท
- มี test ว่า user ของ tenant A เรียก `/recalibrate` ให้ tenant B ไม่ได้

**ผู้รับผิดชอบ:**
- Puripat (หลัก): ดูแล `calibration.py`, `/recalibrate`, `/shap`, `ShapViewer.jsx`
- Saphondanai: ดูแล `schemas.py`, `WhatIfSimulator.jsx`

---

### SEC-03 ไม่จำกัดขนาดข้อมูลและจำนวนครั้งที่เรียก

ระดับ: ตอนนี้ ต่ำ, ก่อน deploy กลาง (ตรงกับ OWASP API4 Unrestricted Resource Consumption)

**ปัญหา:**
- `records: list[dict] = Field(min_length=MIN_ROWS)` กำหนดแค่ขั้นต่ำ ไม่มีขั้นสูง ([recalibrate.py:21](../../backend/routers/recalibrate.py#L21)) และ FastAPI/uvicorn ไม่จำกัดขนาด body ให้เอง
- ทุก endpoint ไม่มี rate limit

**หลักฐาน:**
- วัดแล้วว่า `/company-summary` ที่คำนวณ SHAP 1,470 แถวใช้แค่ 0.14 วินาที จุดนี้จึงเสี่ยงต่ำ
- รอบ 2 ส่ง `/recalibrate` ขนาด 50,000 แถว (41.3 MB) ระบบรับไว้และตอบ 200 ใน 1.4 วินาที (in-process) แปลว่าไม่มีเพดานเลย
- request เดียวขนาดนี้ยังไม่ทำให้ระบบล่ม ความเสี่ยงจริงอยู่ที่การส่งซ้ำ ๆ หรือส่ง payload ใหญ่กว่านี้หลายเท่าไปที่ instance ฟรีของ Render ที่หน่วยความจำน้อย

**ทำไมต้องแก้:**
- ส่ง JSON หลายร้อย MB ครั้งเดียวก็ทำให้ instance ฟรีของ Render หน่วยความจำเต็มได้
- `/whatif` ที่เรียกได้ไม่จำกัดยังเปิดทางให้ลอกโมเดลได้

**วิธีแก้:**
1. เพิ่ม `max_length` ให้ `records` (เช่น 50,000 แถว) และตั้งเพดานขนาด body ที่ reverse proxy หรือ middleware
2. ใส่ rate limit เช่น [slowapi](https://github.com/laurentS/slowapi) ที่ `/whatif` และ `/recalibrate` แยกตามผู้ใช้ที่ login (หลัง SEC-01)
3. (หลัง DE-04) ให้ `/company-summary` อ่านจากตาราง batch แทนการคำนวณสด

**เสร็จเมื่อ:** body ที่เกินขนาดได้ 413 หรือ 422, เรียกถี่เกินได้ 429 และมี test ครอบ

**ผู้รับผิดชอบ:** Puripat

---

### SEC-04 backend ถือ token ส่วนตัวที่เขียน MLflow ได้

ระดับ: ตอนนี้ ต่ำ, ก่อน deploy กลาง ตามหลัก least privilege คือให้สิทธิ์น้อยที่สุดเท่าที่งานต้องใช้

**ปัญหา:**
- [backend/model_store.py:21](../../backend/model_store.py#L21) import `mlflow_setup` ซึ่ง [load `.env` ทั้งไฟล์](../../src/mlflow_setup.py#L17)
- process ที่เสิร์ฟ API จึงถือ `MLFLOW_TRACKING_PASSWORD` ซึ่งเป็น DagsHub token ส่วนตัว ที่มีสิทธิ์ Write ไฟล์เดียวกับที่ใช้เทรน

**ทำไมต้องแก้:**
- backend ต้องการแค่ "อ่านโมเดล" แต่ถือสิทธิ์ "เขียน registry"
- ถ้าเครื่อง deploy ถูกเจาะ หรือ token หลุดจาก environment ของ Render ผู้โจมตีจะเขียน registry ได้ และต่อยอดเป็น SEC-05 ได้
- token ส่วนตัวผูกกับบัญชีของสมาชิกในทีม

**วิธีแก้:**
1. ตอน deploy ใช้บัญชีหรือ token แยกสำหรับ backend ที่มีสิทธิ์อ่านอย่างเดียว และห้ามใช้ token ส่วนตัวของสมาชิก
2. หรือ bake ไฟล์โมเดลเข้า Docker image ตอน build ให้ backend ไม่ต้องต่อ MLflow ตอนรันเลย
3. เพิ่มในเอกสาร [docs/mlflow_setup.md](../mlflow_setup.md) ว่าห้ามใส่ token ส่วนตัวใน environment ของ Render

**เสร็จเมื่อ:** environment ของ backend ที่ deploy ไม่มี token ที่เขียนได้ และเอกสารระบุวิธีไว้

**ผู้รับผิดชอบ:** Saphondanai (ดูแล `mlflow_setup.py` และ docs)

---

### SEC-05 ความเสี่ยงจากไฟล์โมเดล (model supply chain)

ระดับ: ตอนนี้ ต่ำ, ก่อน deploy กลาง

**ปัญหา:**
- ทุกคนที่มีสิทธิ์ Write บน DagsHub register โมเดล version ใหม่ได้
- ถ้าทำ DE-03 ด้วย alias `@champion` ใครมีสิทธิ์ย้าย alias ก็เปลี่ยนโมเดลที่ backend ใช้ได้
- ถ้าเลือก DE-03 ทางเลือก B (sklearn `Pipeline` หรือ `mlflow.pyfunc`) โมเดลจะถูกเก็บด้วย cloudpickle ซึ่งตอนโหลดรันโค้ด Python ใด ๆ ที่ฝังอยู่ในไฟล์ได้

**หลักฐาน (รอบ 2):**
- โมเดลที่ register ไว้มีแค่ `attrition-xgboost-P` v1 และยังไม่มี alias
- ไฟล์โมเดลคือ `model.ubj` ซึ่งเป็น native format ของ XGBoost ไม่ใช่ pickle (เห็นจากการดาวน์โหลดใน SEC-12)
- collaborator ที่มีสิทธิ์ Write บน GitHub มี 3 บัญชี (`NungUmSudNaRak`, `Mon-Blacklove`, `yanisa1111`) และทั้ง 3 บัญชีเป็น collaborator บน DagsHub ด้วย

**ทำไมต้องแก้:**
- ถ้าบัญชี collaborator ถูกยึด ผู้โจมตีจะ register โมเดล pickle ที่มีโค้ดอันตราย พอ backend โหลด ผู้โจมตีก็ได้สิทธิ์รันคำสั่งบน server (remote code execution)
- ตอนนี้ใช้ `mlflow.xgboost` แบบ native format ความเสี่ยงนี้จึงยังต่ำ

**วิธีแก้:**
1. ในการตัดสินใจ DE-03 ให้เลือกทางเลือก A (native xgboost + feature spec เป็น JSON) ถ้าต้องเลือก B ให้ถือว่า registry เป็นของที่ต้องเชื่อถือได้เต็มที่
2. จำกัดคนที่ย้าย alias `champion` ได้ และบันทึก version + checksum ที่อนุมัติแล้วไว้ใน README หรือ config
3. ถ้า bake โมเดลเข้า image ตาม SEC-04 ข้อ 2 ให้ตรวจ checksum ตอน build

**เสร็จเมื่อ:** มีบันทึกว่าใช้ format ไหน ใครอนุมัติ version และ checksum ตรงกับที่อนุมัติ

**ผู้รับผิดชอบ:** Saphondanai (ร่วมตัดสินใจ DE-03 กับ Puripat)

---

### SEC-06 Dependency และ CI ยังไม่ได้ป้องกันเรื่อง supply chain

ระดับ: ตอนนี้ ต่ำ, ก่อน deploy กลาง (ตรงกับ OWASP A06 Vulnerable and Outdated Components)

**ปัญหา:**
- [requirements.txt](../../requirements.txt) ไม่ pin เวอร์ชันและไม่มี hash (ตรงกับ DE-05)
- ไม่มีการสแกนช่องโหว่ใน CI และ Dependabot alerts กับ Dependabot security updates ปิดอยู่ (ตรวจรอบ 2 ผ่าน `gh api`)
- [ci.yml](../../.github/workflows/ci.yml) ไม่มีบล็อก `permissions:` ตอนนี้ปลอดภัยเพราะค่า default ของ repo เป็น `read` (ตรวจรอบ 2) แต่ถ้าใครไปเปลี่ยนค่า default workflow จะได้สิทธิ์ write ทันที
- actions อ้างด้วย tag (`@v4`) ไม่ใช่ commit SHA และ repo อนุญาตให้ใช้ action ได้ทุกตัว (`allowed_actions: all`)

**หลักฐาน (รอบ 2):**
- `pip-audit` กับแพ็กเกจที่ติดตั้งจริง 195 ตัว: ไม่พบช่องโหว่ที่รู้จัก
- `npm audit` 106 ตัว: 0 ช่องโหว่

ตอนนี้จึงยังปลอดภัย แต่เป็นผลแค่ ณ วันที่ 1 ต.ค. 2026 เท่านั้น

**ทำไมต้องแก้:**
- ผลสแกนวันนี้ไม่ได้รับประกันวันพรุ่งนี้ ฐานข้อมูลช่องโหว่มี CVE ใหม่เพิ่มทุกวัน
- แพ็กเกจที่ไม่ pin จะดึงเวอร์ชันใหม่ล่าสุดทุกครั้ง เครื่องที่ติดตั้งทีหลังอาจได้เวอร์ชันที่ไม่เคยถูกสแกน
- ถ้าไม่มีการสแกนอัตโนมัติ ทีมจะไม่รู้เลยว่ามีช่องโหว่ใหม่ในแพ็กเกจที่ใช้อยู่

**วิธีแก้:**
1. ทำ DE-05 (pin เวอร์ชัน)
2. เพิ่ม step ใน CI: `pip install pip-audit && pip-audit -r requirements.txt` และ `npm audit --audit-level=high` (ใน `frontend/`)
3. เปิด Dependabot alerts และ Dependabot security updates ที่ Settings → Code security แล้วเพิ่ม `.github/dependabot.yml` สำหรับ pip, npm และ github-actions
4. เพิ่มที่ต้นไฟล์ `ci.yml`:
   ```yaml
   permissions:
     contents: read
   ```

**เสร็จเมื่อ:** CI มี step สแกนและผ่าน, มี Dependabot และ `permissions: contents: read`

**ผู้รับผิดชอบ:** Saphondanai (ดูแล CI และ requirements)

---

### SEC-11 branch `main` บน GitHub ไม่มีการป้องกัน

ระดับ: ตอนนี้ กลาง, ก่อน deploy กลาง เพิ่มในรอบ 2 เป็นเรื่องความถูกต้องของโค้ด (code integrity)

**ปัญหา:**
- `gh api repos/InkSpuDek66/employee-attrition-predictor/branches/main/protection` ตอบว่า "Branch not protected" และ repo ไม่มี ruleset ใด ๆ
- collaborator มี 4 บัญชี (admin 1, write 3) ทุกคน push ตรงเข้า `main` ได้, force-push ทับ history ได้ และลบ branch ได้
- CI ใน [ci.yml](../../.github/workflows/ci.yml) รันหลัง push ก็จริง แต่ไม่ได้บังคับว่าต้องผ่านก่อนโค้ดจะเข้า `main`
- repo เป็น public

**ทำไมต้องแก้:**
- ทีม 4 คนทำงานพร้อมกัน ถ้าใคร force-push พลาดครั้งเดียว งานของเพื่อนจะหายจาก `main`
- โค้ดที่ test ไม่ผ่านเข้า `main` ได้โดยไม่มีอะไรกั้น
- ถ้าบัญชีใดถูกยึด ผู้โจมตีแก้โค้ดบน `main` ได้ทันที และถ้าตั้ง Render ให้ auto-deploy จาก `main` โค้ดนั้นจะขึ้น production เลย

**วิธีแก้ (ใช้เวลาประมาณ 10 นาทีที่หน้าเว็บ):** Settings → Rules → Rulesets → New branch ruleset → target `main` แล้วเปิด
1. Restrict deletions: และ Block force pushes
2. Require a pull request before merging (จะตั้ง approval เป็น 0 หรือ 1 ก็ได้ตามที่ทีมตกลง)
3. Require status checks to pass: เลือก 2 job ของ CI คือ "Python lint + train + backend tests (MLflow ใน docker compose)" และ "Frontend lint + build"

แล้วเขียนขั้นตอนทำงานผ่าน PR ไว้ใน [CONTRIBUTING.md](../../CONTRIBUTING.md) (ทีมเคย merge ผ่าน PR #1 มาแล้ว จึงไม่ใช่ขั้นตอนใหม่)

**เสร็จเมื่อ:** `gh api repos/InkSpuDek66/employee-attrition-predictor/rulesets` แสดง ruleset ที่ `active` และการ push ตรงเข้า `main` ถูกปฏิเสธ

**ผู้รับผิดชอบ:** Saphondanai (บัญชี InkSpuDek66 เป็น admin) และ ทั้งทีม ตกลงเรื่องการทำงานผ่าน PR

---

### SEC-12 repo บน DagsHub เป็นสาธารณะ ดาวน์โหลดโมเดลและข้อมูลตัวอย่างได้โดยไม่ต้อง login

ระดับ: ตอนนี้ ต่ำ, ถ้าใช้ข้อมูลจริง สูง เพิ่มในรอบ 2 และผูกกับ DS-03 ใน[รายงาน DE](round1-2_data_engineering_S.md#ds-03-pdpa-fairness-และความปลอดภัย)

**ปัญหา:** repo `InkSpuDek66/employee-attrition-predictor` บน DagsHub เป็น public (`private: false` เป็น mirror ของ GitHub) MLflow ที่ผูกกับ repo นี้จึงเปิดให้คนนอกอ่านได้ด้วย

**หลักฐาน (รอบ 2 เรียกโดยไม่ใส่ credential ใด ๆ):**

| สิ่งที่ลอง | ผล |
| :--- | :--- |
| ค้นหา registered model | 200 เห็น `attrition-xgboost-P` |
| ดู run ของโมเดล | 200 เห็น metric `test_auc`, `test_f1`, `test_pr_auc` |
| ค้นหา experiment | 200 เห็น 3 experiment (`attrition-model-lab-S`, `attrition-xgboost-train`, `connection-test`) |
| ดาวน์โหลด `models:/attrition-xgboost-P/1` | สำเร็จ ได้ 8 ไฟล์ รวม `model.ubj` และ `input_example.json` ซึ่งเป็นข้อมูลพนักงาน 3 แถว มีคอลัมน์ `Gender`, `Age`, `MonthlyIncome` |

**ทำไมต้องแก้:**
- ตอนนี้ข้อมูลเป็น IBM synthetic ที่เปิดเผยบน Kaggle อยู่แล้ว ความเสียหายจริงจึงต่ำ
- แต่ทุกอย่างที่ log ขึ้น MLflow ของทีมจะเป็นสาธารณะทันที ถ้าวันหนึ่งมีคนลองกับข้อมูลบริษัทจริง ข้อมูลจะหลุดทันที
- [.env.example](../../.env.example) เตือนว่า "ห้ามใช้กับข้อมูลพนักงานจริง" แต่ไม่ได้บอกเหตุผลว่าเพราะเป็นสาธารณะ
- โมเดลที่ดาวน์โหลดได้ยังเปิดให้ query แบบ offline ได้ไม่จำกัด ซึ่งเสี่ยงต่อการอนุมานข้อมูลที่ใช้เทรน (membership inference) เมื่อเป็นข้อมูลจริง

**วิธีแก้:**
1. เปลี่ยน `input_example` ใน [train.py:43](../../src/train.py#L43) เป็นแถวสังเคราะห์ (ตาม DS-03) ตอน register version ถัดไป
2. เขียนใน [docs/mlflow_setup.md](../mlflow_setup.md) และ `.env.example` ให้ชัดว่า "MLflow บน DagsHub ของทีมเป็นสาธารณะ ทุก run, โมเดล และ artifact คนนอกดาวน์โหลดได้"
3. ถ้าจะใช้ข้อมูลจริง ให้ใช้ self-host (docker-compose ที่มีอยู่แล้ว) หรือ DagsHub repo แบบ private เท่านั้น ซึ่งตรงกับแนวคิด "self-host ข้อมูลไม่ออกนอกบริษัท"
4. (เก็บงาน) ลบ experiment `connection-test` ที่ไม่ได้ใช้แล้ว

**เสร็จเมื่อ:** `input_example` ของ version ใหม่ไม่ใช่แถวข้อมูลจากชุดเทรน และเอกสารระบุเรื่องความเป็นสาธารณะไว้ชัด

**ผู้รับผิดชอบ:** Saphondanai (เจ้าของ `train.py`, เอกสาร MLflow และบัญชี DagsHub)

---

## 5. เรื่องรองและสิ่งที่ต้องเตรียมตอน deploy

### SEC-07 หน้า Streamlit เปิดให้ทุกเครื่องใน network เดียวกันเข้าได้

ระดับ: ต่ำ

**ปัญหา:**
- `streamlit config show` ยืนยันว่า `server.address` ไม่ได้ตั้งค่าไว้ ซึ่งแปลว่า Streamlit รับการเชื่อมต่อจากทุก network interface (มันจะแสดง "Network URL" ตอนรัน)
- คำสั่งใน [src/test_app.py:6](../../src/test_app.py#L6) ไม่ได้กำหนด address
- หน้าทดสอบนี้แสดงข้อมูลพนักงานใน dataset รวมถึงผลจริงว่าลาออกหรือไม่

**ทำไมต้องแก้:** ถ้ารันบน Wi-Fi ของมหาวิทยาลัย ใครอยู่ใน network เดียวกันก็เปิดหน้านี้ได้ เป็นนิสัยที่อันตรายถ้าวันหนึ่งใช้กับข้อมูลจริง

**วิธีแก้:** เปลี่ยนคำสั่งเป็น `streamlit run src/test_app.py --server.address localhost` หรือเพิ่มไฟล์ `.streamlit/config.toml` ที่มี `[server] address = "localhost"`

**ผู้รับผิดชอบ:** Puripat

### SEC-08 Error เปิดเผยรายละเอียดภายใน และเปิดหน้า docs สาธารณะ

ระดับ: ต่ำ

**ปัญหา:**
- [recalibrate.py:49](../../backend/routers/recalibrate.py#L49) ส่งข้อความ exception ดิบ (`{e}`) กลับไปให้ผู้ใช้
- [whatif.py:50](../../backend/routers/whatif.py#L50) ส่ง error ของ Pydantic ทั้งก้อน
- [main.py:10](../../backend/main.py#L10) เปิด `/docs` และ `/openapi.json` ตามค่า default

**หลักฐาน (รอบ 2 ยิงจริง):**
- ส่ง `MonthlyIncome="abc"` ไปที่ `/recalibrate` ได้ข้อความ `ข้อมูลไม่ตรงรูปแบบ: unsupported operand type(s) for /: 'str' and 'int'` ซึ่งเป็น error ภายในของ Python ที่บอกว่าโค้ดทำการหารตรงไหน
- ส่ง `{"Age": "old"}` ไปที่ `/whatif` ได้ dict ของ Pydantic ทั้งก้อน (`type`, `loc`, `msg`, `input`)
- `GET /docs` และ `GET /openapi.json` ได้ 200 โดยไม่ต้อง login และ openapi แสดงครบทั้ง 7 path

**ทำไมต้องแก้:** ข้อความ exception อาจมีชื่อคอลัมน์ path หรือเวอร์ชันไลบรารี ส่วนหน้า docs เป็นแผนที่ของ API ทั้งหมดที่เปิดให้คนนอกดูได้

**วิธีแก้:**
1. ส่งข้อความสั้นที่ผู้ใช้เข้าใจ (ภาษาไทย) กลับไป แล้วเขียนรายละเอียดลง log ฝั่ง server
2. ปิด docs ตอน deploy เช่น `FastAPI(docs_url=None if os.getenv("ENV") == "prod" else "/docs", openapi_url=...)`

**ผู้รับผิดชอบ:** Puripat (`recalibrate.py`) + Saphondanai (`whatif.py`, `main.py`)

### SEC-09 PDPA: ไม่มีบันทึกการเข้าถึงและนโยบายข้อมูล

ระดับ: ตอนนี้ ต่ำ, ก่อนใช้ข้อมูลจริง กลาง

**ปัญหา:**
- ไม่มี audit log ว่า "ใครดูคะแนนความเสี่ยงของใคร เมื่อไร"
- ไม่มีนโยบายว่าจะเก็บข้อมูลนานแค่ไหน
- ไม่มี privacy notice บอกพนักงานว่าข้อมูลถูกใช้ทำอะไร

**ทำไมต้องแก้:**
- PDPA กำหนดให้แจ้งวัตถุประสงค์และควบคุมการเข้าถึงข้อมูลส่วนบุคคล
- ระบบนี้ประมวลผลข้อมูลอ่อนไหวเพื่อตัดสินใจเกี่ยวกับตัวบุคคล กรรมการน่าจะถามเรื่องนี้

**วิธีแก้:**
1. หลังทำ DE-04 เพิ่มตาราง `access_log(user_id, tenant_id, employee_id, endpoint, accessed_at)` แล้วเขียนผ่าน dependency เดียวกับ auth
2. เขียนหัวข้อ "PDPA และการคุ้มครองข้อมูล" ในรายงาน ครอบคลุมวัตถุประสงค์, ฐานทางกฎหมาย, ระยะเวลาเก็บ, สิทธิ์ของพนักงาน และข้อจำกัดของ prototype

**ผู้รับผิดชอบ:** Saphondanai + Puripat (audit log เพราะเป็นเจ้าของ backend) และ Saphondanai (เขียนรายงานส่วน Business Logic / Localization)

### SEC-10 สิ่งที่ต้องตั้งค่าตอน deploy

ระดับ: ตอนนี้ ไม่เกี่ยว, ตอน deploy กลาง

- **CORS:** ถ้า frontend กับ backend อยู่คนละ domain บน Render ให้ใช้ `CORSMiddleware` กับรายการ origin ที่ระบุชัด **ห้ามใช้ `allow_origins=["*"]` คู่กับ credentials (ผู้รับผิดชอบ: Puripat**)
- **HTTPS:** Render ให้มาแล้ว แต่ต้องตรวจว่าไม่มีการเรียก `http://` แบบฮาร์ดโค้ดเหลืออยู่ (ผู้รับผิดชอบ: Puripat)
- **Superset embed:** README หัวข้อ 9 วางแผนใช้ guest token ต้องสร้าง token ฝั่ง server หลังตรวจสิทธิ์ผู้ใช้ และตั้ง Row Level Security ตาม `tenant_id` ห้ามสร้างจาก frontend (ผู้รับผิดชอบ: Nanthamon)

### SEC-13 output ของ notebook มี path ในเครื่องหลุดอยู่

ระดับ: ต่ำ (เพิ่มในรอบ 2)

**ปัญหา:** สแกน source และ output ของทุก notebook ที่ track ใน git แล้ว ไม่พบ secret, token, รหัสผ่าน, email หรือ credential ใน URL แต่พบ path ในเครื่องของสมาชิกใน output ที่ commit ไว้

| ไฟล์ | สิ่งที่หลุด |
| :--- | :--- |
| `notebooks/03_xgboost_experiment_P.ipynb` cell 1 | `c:\Users\HP\miniconda3\...` (TqdmWarning) บอกชื่อผู้ใช้ Windows และบอกว่า notebook นี้รันด้วย miniconda ไม่ใช่ `.venv` |
| `notebooks/04_tuning_S.ipynb` cell 1 | `D:\CSI\dev ink\employee-attrition-predictor\mlflow.db` |
| `notebooks/07_imbalance_S.ipynb` cell 1 | path ไปยัง `.venv\...\mlflow\assistant\skills\...` (ข้อความ agent hint ของ MLflow) |

ลิงก์ "View run … at: https://dagshub.com/…" ใน notebook 05 และ 06 ไม่ใช่ปัญหาเพิ่ม เพราะ DagsHub เป็นสาธารณะอยู่แล้ว (SEC-12)

**ทำไมต้องแก้:** ความเสี่ยงต่ำเพราะไม่ใช่ secret แต่ repo เป็น public การเปิดเผยชื่อผู้ใช้และโครงสร้างโฟลเดอร์ช่วยให้ผู้โจมตีเดาเป้าหมายได้ง่ายขึ้นเล็กน้อย และ warning ยังทำให้ notebook ที่ใช้นำเสนอดูรก

**วิธีแก้:** ทีมตั้งใจเก็บ output ไว้ จึงไม่แนะนำให้ล้าง output ทั้งหมด
1. cell แรกของแต่ละ notebook ใส่ `warnings.filterwarnings("ignore", category=...)` เฉพาะ warning ที่รู้แล้ว
2. ตั้ง `MLFLOW_DISABLE_AGENT_HINT=1` ใน `.env` (และเพิ่มใน `.env.example`)
3. พิมพ์ path แบบ relative แทน absolute
4. รัน notebook ใหม่ด้วย kernel ของ `.venv` แล้ว commit

**ผู้รับผิดชอบ:** Puripat (notebook 03) + Saphondanai (notebook 04, 07 และ `.env.example`)

---

## 6. งานแยกรายคน

ติ๊กเมื่อเสร็จ แล้วใส่ commit hash ต่อท้าย

### ทั้งทีม (รวมในประชุมเดียวกับ DE-04)
- [ ] ยืนยันผู้รับผิดชอบและกำหนดเสร็จในเอกสารนี้
- [ ] SEC-01 เลือกวิธี auth (login + token) และ role ที่ต้องมี (HR, admin)
- [ ] ยืนยันว่าจะ deploy ขึ้น Render จริงไหม และจะใช้ข้อมูลอะไรตอน demo
- [ ] SEC-11 ตกลงการทำงานผ่าน PR ก่อนเปิด ruleset ของ `main`

### Saphondanai
- [ ] SEC-01 ตัดฟิลด์ส่วนตัวออกจาก response ของ `/whatif` + auth ของ `/predict` `/whatif` `/financial-impact`
- [ ] SEC-02 ลบช่องรหัสบริษัทใน `WhatIfSimulator.jsx` + `tenant_id` ใน `schemas.py`
- [x] SEC-04 ข้อ 3: เอกสารห้ามใช้ token ส่วนตัวใน environment ของ Render (`67cde44`)
- [ ] SEC-04 token อ่านอย่างเดียวสำหรับ backend
- [ ] SEC-05 เลือก format โมเดล (ผูกกับ DE-03) + checksum
- [x] SEC-06 `pip-audit`, `npm audit`, `permissions:` ใน CI + `.github/dependabot.yml` (`65f4d13`)
- [ ] SEC-06 เปิด Dependabot alerts/security updates ในหน้า Settings ของ GitHub
- [ ] SEC-08 ข้อความ error ใน `whatif.py` + ปิด `/docs` ตอน prod
- [ ] SEC-09 audit log (ร่วมกับ Puripat) + หัวข้อ PDPA ในรายงาน
- [ ] SEC-11 ruleset ของ `main` (block force push/deletion, require PR + CI) + ขั้นตอน PR ใน CONTRIBUTING.md
- [x] SEC-12 เลิกใช้ `input_example` (ใช้ signature อย่างเดียว) + เขียนเตือนเรื่อง DagsHub สาธารณะใน `mlflow_setup.md` / `.env.example` (`31f4690`, `67cde44`)
- [x] SEC-13 ล้าง path ใน output ของ notebook 07 (`577fab1`)
- [ ] SEC-13 ล้าง path ใน output ของ notebook 04

### Puripat
- [x] SEC-01 auth ของ `/shap` `/recalibrate` `/company-summary` (login บัญชีทดลอง ครอบทุก router ใน `main.py` รวมของ Saphondanai ด้วย ระบบผู้ใช้จริงรอทีมตกลงวิธี) (`bcfbb8f`)
- [ ] SEC-01 ตัดค่า protected attribute ออกจาก `/shap` + แก้หน้า Streamlit ให้ไม่พึ่ง `result.employee`
- [x] SEC-02 (หลัก) เอา tenant มาจาก token, `/recalibrate` ให้เฉพาะ admin, ลบช่องรหัสบริษัท (อยู่ที่ header ใน `App.jsx`) และส่ง `tenant_id` ของบริษัทอื่นได้ 403 ทุก endpoint (`bcfbb8f`)
- [x] SEC-03 `max_length` (10,000 แถว) + จำกัดขนาด body 10 MB + rate limit (login, whatif, recalibrate, import) + `/company-summary` อ่าน batch (`bcfbb8f`)
- [x] SEC-07 Streamlit bind localhost (`.streamlit/config.toml`) (`bcfbb8f`)
- [x] SEC-08 ข้อความ error ใน `recalibrate.py` (`bcfbb8f`)
- [ ] SEC-09 audit log (ร่วมกับ Saphondanai)
- [ ] SEC-10 CORS และ HTTPS ตอน deploy
- [x] SEC-13 รัน notebook 03 ใหม่ด้วย kernel `.venv` ให้ path `c:\Users\HP\miniconda3` หายจาก output (`bcfbb8f`)

### Yanisa
- [ ] รีวิว SEC-09 ในส่วนที่เกี่ยวกับ `/interventions` (ข้อมูลมาตรการเป็นข้อมูลส่วนบุคคล ต้องผ่าน auth และลง audit log เหมือนกัน)

### Nanthamon
- [ ] SEC-10 Superset guest token สร้างฝั่ง server + Row Level Security ตาม tenant
- [ ] รีวิว SEC-09 ในส่วน `/calibration-status` และ `/dashboard/summary`

---

## 7. ความเห็นทีม

เขียนต่อท้ายได้เลย รูปแบบ: `- [ID] ชื่อ (วันที่): ความเห็น`

- [SEC-13] Saphondanai (1 ต.ค. 2026): ไม่ได้ใส่ `MLFLOW_DISABLE_AGENT_HINT` ใน `.env.example` เพราะใส่ไปก็ไม่มีผล ข้อความ hint พิมพ์ตอน `import mlflow` ซึ่งเกิดก่อนที่ `mlflow_setup` จะโหลด `.env` และจะขึ้นก็ต่อเมื่อมี coding agent (เช่น Claude Code) เป็นคนรัน notebook เท่านั้น ถ้าคนรันเองจะไม่ขึ้นอยู่แล้ว วิธีที่ใช้ได้คือตั้ง env var ในคำสั่งตอนให้ agent รัน (CI ตั้งไว้แล้วใน `ci.yml`) ส่วน notebook 04 ยังไม่ได้รันใหม่ เพราะจะทำให้ Optuna log run ขึ้น DagsHub ซ้ำ
- [SEC-12] Saphondanai (1 ต.ค. 2026): `train.py` บันทึก `mlflow.source.name` เป็น `src/train.py` แทน path เต็มในเครื่อง ซึ่งเป็นค่าที่ MLflow ใส่ให้ตามปกติ และจะขึ้นไปอยู่บน DagsHub ที่เป็นสาธารณะ

---

## คำศัพท์

| คำ | ความหมายในเอกสารนี้ |
| :--- | :--- |
| Authentication / Authorization | ยืนยันว่า "เป็นใคร" / ตรวจว่า "มีสิทธิ์ทำสิ่งนี้ไหม" |
| BOLA / IDOR | เปลี่ยนเลข ID ใน request แล้วเข้าถึงข้อมูลของคนอื่นได้ เพราะระบบไม่ตรวจว่าเป็นของเราหรือไม่ |
| Excessive data exposure | API ส่งข้อมูลมากกว่าที่หน้าจอต้องใช้ แล้วหวังให้ frontend ซ่อนเอง |
| Tenant isolation | ข้อมูลและการตั้งค่าของแต่ละบริษัทต้องแยกกัน บริษัทหนึ่งเข้าถึงของอีกบริษัทไม่ได้ |
| Least privilege | ให้สิทธิ์น้อยที่สุดเท่าที่งานนั้นต้องใช้ |
| Supply chain | ความเสี่ยงที่มากับของที่เราไม่ได้เขียนเอง เช่น แพ็กเกจ, GitHub Action, ไฟล์โมเดล |
| Deserialization (pickle) | การโหลดไฟล์ pickle คือการรันโค้ดตามที่ไฟล์สั่ง ถ้าไฟล์มาจากคนที่ไม่น่าไว้ใจ = รันโค้ดของเขา |
| Rate limit | จำกัดจำนวนครั้งที่เรียก API ได้ต่อช่วงเวลา |
| PDPA | พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 |
| Branch protection / Ruleset | กฎบน GitHub ที่กันไม่ให้ push ตรง force-push หรือลบ branch สำคัญ และบังคับให้ CI ผ่านก่อน merge |
| Membership inference | การใช้โมเดลที่ได้มาเดาว่าคนใดคนหนึ่งอยู่ในข้อมูลที่ใช้เทรนหรือไม่ อันตรายเมื่อข้อมูลเทรนเป็นข้อมูลจริง |
| In-process test | ทดสอบโดยเรียกแอป FastAPI ภายใน process เดียวกันผ่าน `TestClient` ใช้ route และ validation ชุดเดียวกับของจริงโดยไม่ต้องเปิด server |

---

## ภาคผนวก: คำสั่งที่ใช้ตรวจ

รันจากรากโปรเจกต์ใน Git Bash

ข้อ 1–4 และ 6 มาจากรอบ 1 ส่วนข้อ 5 และ 7–10 มาจากรอบ 2 สคริปต์ทุกตัวไม่แก้ไฟล์ในโปรเจกต์ และไม่เขียนอะไรขึ้น MLflow/DagsHub/GitHub

### 1. ตรวจว่าไม่มี secret ใน git (ไม่แสดงค่า secret ออกมา)
```bash
# ไฟล์ .env ที่ถูก track (ควรมีแค่ .env.example)
git ls-files | grep -i '\.env'
# commit ในทุก branch ที่เคยเพิ่มหรือลบบรรทัดที่มีค่ารหัสผ่าน/token จริง (ควรว่าง)
git log --all --format='%h %an %s' \
  -G 'MLFLOW_TRACKING_PASSWORD *= *[A-Za-z0-9]{8,}|POSTGRES_PASSWORD *= *[A-Za-z0-9]{6,}' -- . ':!notebooks'
```
ผล ณ วันตรวจ: มีแค่ `.env.example` และคำสั่งที่สองไม่พบ commit ใด

### 2. ค้นหารูปแบบอันตราย (ใช้ ripgrep หรือ Grep ใน VS Code)
```
dangerouslySetInnerHTML|unsafe_allow_html|innerHTML|eval\(|pickle|allow_origins|CORSMiddleware
```
ผล: พบ `innerHTML` เฉพาะใน `docs/model_lab_S/*.html` (ข้อมูลของทีมเอง) ไม่พบรายการอื่น

### 3. ค่า default ของ Streamlit
```bash
.venv/Scripts/python.exe -m streamlit config show | grep -B8 '^#\? *address'
```
ผล: `Default: (unset)`

### 4. ตัวอย่าง request ของ SEC-01 กับ server จริง

ต้องเปิด `uvicorn main:app` ใน `backend/` ก่อน
```bash
curl -s -X POST http://localhost:8000/whatif \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1, "changes": {}}'
```
ใน response จะมี `"employee": {"Age": 41, "Gender": "Female", "MaritalStatus": "Single", "MonthlyIncome": 5993, ...}` ซึ่งคือข้อมูลของ EmployeeNumber 1 และไม่ต้องมี token ใด ๆ (รอบ 2 ยืนยันผลนี้ด้วยสคริปต์ในข้อ 5)

### 5. สคริปต์ยิง API แบบ in-process (รอบ 2)

ใช้ `TestClient` กับแอปจริงใน `backend/main.py` แต่สลับโมเดล MLflow เป็นโมเดลที่เทรนซ้ำในเครื่อง จึงไม่ต้องเปิด server และไม่ต่อ DagsHub ไฟล์ calibration เขียนลงโฟลเดอร์ชั่วคราวแล้วลบทิ้ง (ตรวจแล้วว่าไม่มี `backend/calibrations/` เหลืออยู่ในโปรเจกต์)

วิธีรัน: บันทึกโค้ดเป็น `pentest_inprocess.py` ที่ใดก็ได้ แล้วรัน `python pentest_inprocess.py .` จากรากโปรเจกต์ (ใช้เวลาราว 2 นาที ส่วนใหญ่เป็นการวน 2,068 ID)

<details>
<summary>โค้ด pentest_inprocess.py</summary>

```python
"""In-process security checks for the review (SEC-01/02/03/08).

Uses FastAPI TestClient (no server, no network) and swaps the MLflow model for a local replica
trained with the same recipe as src/train.py. Calibration files go to a temp dir that is deleted.
Run from the project root: python pentest_inprocess.py .
"""
import json
import os
import sys
import tempfile
import time
from collections import Counter

ROOT = os.path.abspath(sys.argv[1])
sys.path.insert(0, os.path.join(ROOT, "backend"))
sys.path.insert(0, os.path.join(ROOT, "src"))

from fastapi.testclient import TestClient  # noqa: E402
from sklearn.model_selection import train_test_split  # noqa: E402
from xgboost import XGBClassifier  # noqa: E402

import calibration  # noqa: E402
import model_store as ms  # noqa: E402
from clean_pipeline import TARGET_COLUMN, clean_data  # noqa: E402
from feature_pipeline import SELECTED_FEATURES, add_features  # noqa: E402
from train import PARAMS  # noqa: E402

# --- local replica of attrition-xgboost-P v1 (same split/params/seed as src/train.py) ---
raw = ms.raw_employees()
df = add_features(clean_data(raw), only=SELECTED_FEATURES)
X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN]
Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
local_model = XGBClassifier(**PARAMS, scale_pos_weight=(ytr == 0).sum() / (ytr == 1).sum(), random_state=42, n_jobs=4)
local_model.fit(Xtr, ytr)
ms.model = lambda: local_model  # replaces the lru_cached MLflow loader; explainer() looks this up at call time

from main import app  # noqa: E402

client = TestClient(app)
out = {}
tmp = tempfile.TemporaryDirectory()
calibration.STORE = tmp.name

# ---------------- SEC-01: no auth + excessive data exposure + enumeration ----------------
r = client.post("/whatif", json={"employee_id": 1, "changes": {}})
emp = r.json()["employee"]
out["sec01_whatif_status_without_auth"] = r.status_code
out["sec01_whatif_employee_fields"] = len(emp)
out["sec01_whatif_sample"] = {k: emp[k] for k in ["Age", "Gender", "MaritalStatus", "MonthlyIncome", "JobSatisfaction",
                                                  "PerformanceRating", "Department", "JobRole"]}
s = client.get("/shap/1", params={"top_n": 100}).json()
out["sec01_shap_features_returned"] = len(s["contributions"])
out["sec01_shap_protected_values"] = {c["feature"]: c["value"] for c in s["contributions"]
                                      if c["feature"] in ("Gender", "Age") or c["feature"].startswith("MaritalStatus_")}
fi = client.get("/financial-impact/1").json()
out["sec01_financial_impact_income"] = fi["monthly_income"]

t = time.perf_counter()
found, genders = 0, Counter()
for i in range(1, 2069):
    rr = client.post("/whatif", json={"employee_id": i, "changes": {}})
    if rr.status_code == 200:
        found += 1
        genders[rr.json()["employee"]["Gender"]] += 1
out["sec01_enumeration_ids_tried"] = 2068
out["sec01_enumeration_records_dumped"] = found
out["sec01_enumeration_seconds"] = round(time.perf_counter() - t, 1)
out["sec01_enumeration_gender_counts"] = dict(genders)

# ---------------- SEC-02: tenant overwrite without auth ----------------
records = raw.sample(300, random_state=0).to_dict("records")
ok = client.post("/recalibrate", json={"tenant_id": "company_b", "method": "platt", "records": records})
before = client.get("/shap/1", params={"tenant_id": "company_b"}).json()
flipped = [dict(rec, Attrition="No" if rec["Attrition"] == "Yes" else "Yes") for rec in records]
attack = client.post("/recalibrate", json={"tenant_id": "company_b", "method": "platt", "records": flipped})
after = client.get("/shap/1", params={"tenant_id": "company_b"}).json()
scores = ms.risk_scores(ms.employee_features())
rec_after = calibration.load("company_b")
out["sec02_company_b_legit_status"] = ok.status_code
out["sec02_attacker_overwrite_status_without_auth"] = attack.status_code
out["sec02_employee1_actually_left"] = raw.loc[raw.EmployeeNumber == 1, "Attrition"].item()
out["sec02_employee1_calibrated_before_after"] = [round(before["calibrated_risk_score"], 3),
                                                  round(after["calibrated_risk_score"], 3)]
out["sec02_platt_coef_after_attack"] = round(rec_after["params"]["coef"], 3)
cal_after = calibration.apply(rec_after, scores)
leavers = (raw["Attrition"] == "Yes").to_numpy()
out["sec02_leavers_scored_high_after_attack"] = int((cal_after[leavers] >= 0.7).sum())
out["sec02_leavers_total"] = int(leavers.sum())
out["sec02_path_traversal_blocked_status"] = client.post(
    "/recalibrate", json={"tenant_id": "../x", "records": records}).status_code

# ---------------- SEC-03: no upper bound on /recalibrate payload ----------------
big = raw.sample(50_000, replace=True, random_state=1).to_dict("records")
body = json.dumps({"tenant_id": "big_payload", "method": "platt", "records": big}, default=int)
t = time.perf_counter()
rb = client.post("/recalibrate", content=body, headers={"Content-Type": "application/json"})
out["sec03_payload_rows"] = len(big)
out["sec03_payload_mb"] = round(len(body.encode()) / 1e6, 1)
out["sec03_status"] = rb.status_code
out["sec03_seconds"] = round(time.perf_counter() - t, 1)

# ---------------- SEC-08: error detail leakage + public docs ----------------
bad = [dict(rec, MonthlyIncome="abc") for rec in records[:60]]
out["sec08_recalibrate_error"] = client.post("/recalibrate", json={"tenant_id": "a", "records": bad}).json()["detail"]
out["sec08_whatif_error"] = client.post("/whatif", json={"employee_id": 1, "changes": {"Age": "old"}}).json()["detail"]
out["sec08_docs_status"] = client.get("/docs").status_code
openapi = client.get("/openapi.json")
out["sec08_openapi_status"] = openapi.status_code
out["sec08_openapi_paths"] = sorted(openapi.json()["paths"])

tmp.cleanup()
print(json.dumps(out, ensure_ascii=False, indent=1, default=str))
```

</details>

ผลย่อ ณ วันตรวจ:

```text
SEC-01  /whatif ไม่มี token -> 200, employee 30 ฟิลด์ | /shap?top_n=100 -> 50 ฟีเจอร์ รวม Age/Gender/MaritalStatus
        วน ID 1-2068 -> ได้ 1,470 คน ใน 75.9 วินาที (Female 588, Male 882)
SEC-02  company_b ปรับเทียบถูกต้อง -> 200 | ผู้โจมตีเขียนทับด้วย label สลับ -> 200 | Platt coef หลังโจมตี -5.168
        tenant_id="../x" -> 422 (กันได้ถูกต้อง)
SEC-03  /recalibrate 50,000 แถว (41.3 MB) -> 200 ใน 1.4 วินาที
SEC-08  "ข้อมูลไม่ตรงรูปแบบ: unsupported operand type(s) for /: 'str' and 'int'"
        "ค่าที่เปลี่ยนไม่ถูกต้อง: [{'type': 'int_parsing', 'loc': ('Age',), ...}]"
        /docs -> 200, /openapi.json -> 200 (7 path)
```

ตัวเลขผลกระทบของ SEC-02 (AUC 0.93 → 0.07 และคนเสี่ยงสูงสุด 10%) คำนวณแยกด้วยสูตรเดียวกับ endpoint (`calibration.fit` + `calibration.apply`) บนข้อมูล 300 แถวชุดเดียวกัน:

<details>
<summary>โค้ด sec02_impact.py</summary>

```python
import sys; sys.path[:0] = ["backend", "src"]
import numpy as np
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier
import calibration
from clean_pipeline import TARGET_COLUMN, clean_data, load_raw_data, RAW_FILENAME
from feature_pipeline import SELECTED_FEATURES, add_features
from train import PARAMS
raw = load_raw_data(f"data/raw/{RAW_FILENAME}")
df = add_features(clean_data(raw), only=SELECTED_FEATURES); X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN].to_numpy()
Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
m = XGBClassifier(**PARAMS, scale_pos_weight=(ytr==0).sum()/(ytr==1).sum(), random_state=42, n_jobs=4).fit(Xtr, ytr)
s = m.predict_proba(X)[:, 1]
idx = raw.sample(300, random_state=0).index.to_numpy()          # same 300 rows as the pentest
lab = y[idx]
legit = {"method": "platt", "params": calibration.fit(s[idx], lab, "platt")}
attack = {"method": "platt", "params": calibration.fit(s[idx], 1 - lab, "platt")}
cl, ca = calibration.apply(legit, s), calibration.apply(attack, s)
top = np.argsort(-s)[: len(s) // 10]
print("AUC legit", round(roc_auc_score(y, cl), 3), "| AUC after attack", round(roc_auc_score(y, ca), 3))
print("top-10% riskiest (raw) -> High band: legit", int((cl[top] >= .7).sum()), "of", len(top), "| after attack", int((ca[top] >= .7).sum()))
print("top-10% riskiest -> Low band after attack", int((ca[top] < .4).sum()))
```

</details>

ผล: `AUC legit 0.93 | AUC after attack 0.07`, `High band: legit 50 of 147 | after attack 0`, `Low band after attack 107`

### 6. ต้นทุนของ SHAP ทั้งบริษัท (ประเมิน DoS)

ใช้โมเดลที่เทรนซ้ำในเครื่องตามสูตร `train.py` (ดูภาคผนวกของ[รายงาน DE](round1-2_data_engineering_S.md#ภาคผนวก-สคริปต์ตรวจซ้ำ))
```python
import time, shap
t = time.perf_counter(); shap.TreeExplainer(model)(X); print(time.perf_counter() - t)  # ≈ 0.14 วินาที (1,470 แถว)
```

### 7. สแกน dependency หาช่องโหว่ที่รู้จัก (รอบ 2)

```bash
# npm (อ่านอย่างเดียว ไม่แก้ package-lock.json)
cd frontend && npm audit
# Python: สแกนแพ็กเกจที่ติดตั้งจริงใน .venv โดยติดตั้ง pip-audit ใน venv แยกนอกโปรเจกต์
.venv/Scripts/python.exe -m pip freeze --exclude-editable > /tmp/frozen.txt
python -m venv /tmp/auditvenv && /tmp/auditvenv/Scripts/python.exe -m pip install pip-audit
/tmp/auditvenv/Scripts/pip-audit.exe -r /tmp/frozen.txt --no-deps --disable-pip
```
ผล ณ วันตรวจ: `npm audit` → 106 แพ็กเกจ 0 ช่องโหว่ · `pip-audit` 2.10.1 → 195 แพ็กเกจ "No known vulnerabilities found"

### 8. ตรวจการตั้งค่า GitHub (รอบ 2)

ต้อง login `gh` ด้วยบัญชีที่เป็น admin ของ repo ทุกคำสั่งเป็น `GET`
```bash
R=InkSpuDek66/employee-attrition-predictor
gh api repos/$R --jq '{visibility, security: .security_and_analysis}'
gh api repos/$R/collaborators --jq '.[] | "\(.login) \(.role_name)"'
gh api repos/$R/branches/main/protection        # 404 = ไม่ได้ป้องกัน
gh api repos/$R/rulesets
gh api repos/$R/actions/permissions/workflow
gh api repos/$R/actions/permissions
gh api repos/$R/dependabot/alerts --jq length
gh api repos/$R/secret-scanning/alerts --jq length
gh api repos/$R/keys --jq length
```

| รายการ | ผล ณ วันตรวจ |
| :--- | :--- |
| visibility | `public` |
| collaborator | `InkSpuDek66` admin · `NungUmSudNaRak`, `Mon-Blacklove`, `yanisa1111` write |
| branch protection ของ `main` / rulesets | ไม่มี / ไม่มี |
| สิทธิ์เริ่มต้นของ workflow | `read` |
| actions ที่อนุญาต | `all` (ไม่บังคับ SHA pinning) |
| secret scanning / push protection | เปิด / เปิด (alert 0) |
| Dependabot alerts / security updates | ปิด / ปิด |
| deploy keys | 0 |
| webhooks | ตรวจไม่ได้ (token ไม่มี scope `admin:repo_hook`) |

### 9. ตรวจสิ่งที่คนนอกเห็นบน DagsHub (รอบ 2)

ดาวน์โหลดโมเดลโดยลบ credential ออกจาก environment ก่อน เพื่อจำลองคนนอกที่ไม่ได้ login (ไฟล์ที่ได้ลบทิ้งหลังตรวจ)
```bash
env -u MLFLOW_TRACKING_USERNAME -u MLFLOW_TRACKING_PASSWORD \
  MLFLOW_TRACKING_URI=https://dagshub.com/InkSpuDek66/employee-attrition-predictor.mlflow \
  python -c "import mlflow; print(mlflow.artifacts.download_artifacts('models:/attrition-xgboost-P/1', dst_path='anon_dl'))"
```
ผล: ดาวน์โหลดสำเร็จ ได้ `MLmodel`, `conda.yaml`, `input_example.json`, `model.ubj`, `python_env.yaml`, `registered_model_meta`, `requirements.txt`, `serving_input_example.json` โดย `input_example.json` มี 3 แถวที่มีคอลัมน์ `Gender`, `Age`, `MonthlyIncome`

นอกจากนี้ endpoint `registered-models/get`, `runs/get` และ `experiments/search` ของ MLflow บน DagsHub ตอบ 200 เมื่อเรียกแบบไม่ใส่ credential ส่วน API ของ repo (`/api/v1/repos/...`) รายงานว่า `private: false`

### 10. สแกน notebook และ docs หา secret และ path ในเครื่อง (รอบ 2)

<details>
<summary>โค้ด scan_notebooks.py</summary>

```python
import json, re, subprocess
from collections import defaultdict
tracked = subprocess.run(["git", "ls-files"], capture_output=True, text=True, encoding="utf-8").stdout.split("\n")
PAT = {
    "secret_like": re.compile(r"(gh[pousr]_[A-Za-z0-9]{20,}|MLFLOW_TRACKING_PASSWORD\s*=\s*\S+|POSTGRES_PASSWORD\s*=\s*[A-Za-z0-9]{6,}|\b[a-f0-9]{40}\b|AKIA[0-9A-Z]{16}|dagshub[^\n\"']{0,40}token\s*[:=]\s*\S+)", re.I),
    "local_path": re.compile(r"([A-Za-z]:\\\\{1,2}Users\\\\{1,2}[^\\\"'\s]+|[A-Za-z]:/Users/[^/\"'\s]+|/home/[^/\"'\s]+|/Users/[^/\"'\s]+|[dD]:\\\\{1,2}CSI)"),
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "cred_in_url": re.compile(r"https?://[^/\s:@\"']+:[^/\s@\"']+@"),
    "mlflow_run_link": re.compile(r"View run [^\n\"]{0,80}at: https?://\S+"),
}
hits = defaultdict(lambda: defaultdict(set))
def scan(name, text, where):
    for k, p in PAT.items():
        for m in p.findall(text):
            m = m if isinstance(m, str) else m[0]
            hits[name][f"{k} [{where}]"].add(m[:90])
for f in tracked:
    if f.endswith(".ipynb"):
        nb = json.load(open(f, encoding="utf-8"))
        for c in nb["cells"]:
            scan(f, "".join(c.get("source", [])), "source")
            for o in c.get("outputs", []):
                scan(f, "".join(o.get("text", [])) + json.dumps(o.get("data", {}), ensure_ascii=False), "output")
    elif f.startswith("docs/") or f in ("README.md", "TASKS.md", "CONTRIBUTING.md") or f.startswith("data/README"):
        if f.endswith(".png"): continue
        try: scan(f, open(f, encoding="utf-8").read(), "file")
        except UnicodeDecodeError: pass
for f, d in hits.items():
    print("==", f)
    for k, v in d.items(): print(f"   {k}: {len(v)} ->", sorted(v)[:3])
```

</details>

ผล ณ วันตรวจ:
- `docs/mlflow_setup.md` เจอ `MLFLOW_TRACKING_PASSWORD=<token…` ซึ่งเป็น placeholder ไม่ใช่ปัญหา
- path ในเครื่อง 3 ไฟล์ (ตาราง SEC-13)
- ลิงก์ "View run" ไป DagsHub ใน notebook 05 และ 06
- ไม่พบ secret, email หรือ credential ใน URL
