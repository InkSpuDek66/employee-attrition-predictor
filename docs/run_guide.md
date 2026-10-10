# คู่มือรันระบบในเครื่อง (สำหรับทีม)

คู่มือนี้เขียนให้คนที่เพิ่ง clone repo มาครั้งแรกรันระบบได้ครบ ทั้ง backend, หน้าเว็บ, หน้าทดสอบ Streamlit และ database
คำสั่งเขียนแบบ Windows (PowerShell / Git Bash) ส่วน macOS/Linux ใช้ได้เหมือนกัน ยกเว้นคำสั่ง activate (ดูขั้นที่ 3)

## ระบบมีอะไรบ้าง และรันที่ port ไหน

| ส่วน | ใช้ทำอะไร | URL | ต้องรันไหม |
| :--- | :--- | :--- | :--- |
| Backend (FastAPI) | API ให้คะแนน, SHAP, What-if, ต้นทุน | http://localhost:8000/docs | ต้อง |
| หน้าเว็บ (React + Vite) | ตัวผลิตภัณฑ์ที่ HR ใช้ | http://localhost:5173 | ต้อง |
| Streamlit | หน้าทดสอบภายในทีม ไม่ใช่ตัวผลิตภัณฑ์ | http://localhost:8501 | ไม่บังคับ |
| PostgreSQL (docker) | database ของแอป (backend อ่านเมื่อตั้ง `DATABASE_URL`) | localhost:5432 | ไม่บังคับ |
| MLflow (docker) | MLflow แบบ self-host (ทีมใช้ DagsHub ช่วงพัฒนา) | http://localhost:5000 | ไม่บังคับ |

หน้าเว็บเรียก backend ผ่าน `/api/...` ซึ่ง Vite ส่งต่อไปที่ port 8000 ให้เอง จึงต้องเปิด backend ก่อนหน้าเว็บจะมีข้อมูล

---

## ครั้งแรก (ทำครั้งเดียวต่อเครื่อง)

### 1. ติดตั้งโปรแกรม

| โปรแกรม | เวอร์ชัน | หมายเหตุ |
| :--- | :--- | :--- |
| [Git](https://git-scm.com/) | ล่าสุด | |
| [Python](https://www.python.org/) | 3.13 | ตอนติดตั้งบน Windows ติ๊ก "Add python.exe to PATH" |
| [Node.js](https://nodejs.org/) | 24 LTS (22 ก็รันได้) | มาพร้อม `npm` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | ล่าสุด | ใช้กับ database/MLflow เท่านั้น ถ้ายังไม่ใช้ข้ามได้ |

เช็กว่าติดตั้งครบ:

```bash
git --version
python --version
node --version
npm --version
```

### 2. Clone

```bash
git clone https://github.com/InkSpuDek66/employee-attrition-predictor.git
cd employee-attrition-predictor
```

### 3. สร้าง virtual environment แล้วติดตั้งแพ็กเกจ Python

```bash
python -m venv .venv
.venv\Scripts\activate              # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
```

- ติดตั้งเสร็จแล้วหน้าบรรทัดคำสั่งจะขึ้น `(.venv)` ทุกครั้งที่เปิด terminal ใหม่ต้อง activate ก่อนรันคำสั่ง Python ของโปรเจกต์
- ถ้า PowerShell ขึ้นว่า "running scripts is disabled" ให้รันครั้งเดียว: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` แล้ว activate ใหม่
- VS Code: `Ctrl+Shift+P` → **Python: Select Interpreter** → เลือก `.venv`

### 4. ติดตั้งแพ็กเกจหน้าเว็บ

```bash
cd frontend
npm install
cd ..
```

### 5. ตั้งค่า `.env` (ให้ backend โหลดโมเดลได้)

คัดลอกไฟล์ตัวอย่าง:

```bash
copy .env.example .env              # Git Bash / macOS / Linux: cp .env.example .env
```

แล้วเปิด `.env` เอา `#` หน้า 4 บรรทัดนี้ออก และใส่ชื่อผู้ใช้กับ token DagsHub ของตัวเอง (วิธีสร้าง token ดู [docs/mlflow_setup.md](mlflow_setup.md))

```ini
MLFLOW_TRACKING_URI=https://dagshub.com/InkSpuDek66/employee-attrition-predictor.mlflow
MLFLOW_TRACKING_USERNAME=<dagshub-username>
MLFLOW_TRACKING_PASSWORD=<dagshub-access-token>
MODEL_URI=models:/attrition-xgboost-P/1
```

- โมเดลที่ทีมเลือกคือ `attrition-xgboost-P` v1 อยู่บน DagsHub แล้ว ไม่ต้องเทรนเอง
- `.env` มีรหัสผ่าน อยู่ใน `.gitignore` แล้ว **ห้าม commit**
- MLflow บน DagsHub ของทีมเป็นสาธารณะ ห้ามใช้กับข้อมูลพนักงานจริง

---

## รันทุกวัน

เปิด terminal แยก 2 อัน (หรือ 3 อันถ้าจะใช้ Streamlit) เริ่มที่รากโปรเจกต์ทุกอัน

### Terminal 1: Backend

```bash
.venv\Scripts\activate
cd backend
uvicorn main:app --reload
```

รอจนขึ้น `Application startup complete.` แล้วเปิด http://localhost:8000/docs ต้องเห็นรายการ API
ครั้งแรกที่มีคนเรียก API จะช้าสักพัก เพราะ backend ดาวน์โหลดโมเดลจาก DagsHub และสร้าง SHAP explainer (ครั้งต่อไปเร็ว)

### Terminal 2: หน้าเว็บ

```bash
cd frontend
npm run dev
```

เปิด http://localhost:5173

### Terminal 3 (ไม่บังคับ): Streamlit

```bash
.venv\Scripts\activate
streamlit run src/test_app.py --server.address localhost
```

### ปิดระบบ

กด `Ctrl+C` ในแต่ละ terminal

---

## เช็กว่าใช้งานได้

0. เปิด http://localhost:5173 จะขึ้นหน้าเข้าสู่ระบบ กดบัญชีทดลองในกล่องสีเหลืองเพื่อกรอกให้ แล้วกด "เข้าสู่ระบบ"
   - `hr_demo` / `hr-demo-1234` ฝ่ายบุคคล ดูได้ทุกหน้า
   - `admin_demo` / `admin-demo-1234` ผู้ดูแลระบบ บันทึกไฟล์นำเข้าและปรับเทียบโมเดลได้
   - restart backend แล้วต้อง login ใหม่ (token เดิมใช้ไม่ได้) ถ้าไม่อยากให้เป็นแบบนี้ ตั้ง `AUTH_SECRET` ใน `.env`
1. แท็บแรก "ภาพรวมบริษัท" ต้องเห็นพนักงาน 1,470 คน และรายชื่อเสี่ยงสูงสุด 10 คน
2. กดชื่อพนักงานคนใดคนหนึ่งในรายชื่อ ระบบพาไปหน้า SHAP Viewer และขึ้นคะแนนกับสรุปเป็นประโยค
3. ไปแท็บ What-if Simulator กด "+ ปิด OT" คะแนนหลังปรับต้องเปลี่ยน
4. ลองใส่รหัสพนักงาน `99999` แล้วกด "โหลด" ต้องขึ้นว่าไม่เจอพนักงานรหัสนี้
5. แท็บ "นำเข้าข้อมูล" กดดาวน์โหลดไฟล์ตัวอย่าง แล้วอัปโหลดไฟล์นั้นกลับเข้าไป ต้องขึ้นว่าไฟล์ถูกต้องทั้งหมด ถ้า login เป็น `admin_demo` และต่อ database แล้ว ปุ่ม "บันทึกเข้าระบบ" กดได้ (ห้ามใช้ข้อมูลพนักงานจริง)
   - ไฟล์ตัวอย่างมีพนักงานรหัส 1, 2 ของ IBM อยู่แล้ว ถ้าบันทึกไฟล์นี้จะอัปเดตสองคนนั้นด้วยเงินเดือนที่ปัดเป็นหลักร้อยบาท ทดสอบเสร็จแล้วรัน `python src/db.py` เพื่อคืนค่าเดิม

6. (login เป็น `admin_demo`) แท็บ "ปรับเทียบโมเดล" กด "ข้อมูลทดลอง 300 คน" แล้วอัปโหลดไฟล์นั้นกลับเข้าไป กด "ปรับเทียบด้วยไฟล์นี้" ต้องขึ้นผลก่อน/หลัง และหน้า SHAP ไม่มีคำเตือน "ยังไม่ได้ปรับเทียบ" แล้ว ทดสอบเสร็จกด "ยกเลิกการปรับเทียบ" เพื่อกลับไปใช้คะแนนเดิม

รหัสพนักงานที่ใช้ทดสอบได้: `1` (เสี่ยงกลาง), `2` (เสี่ยงต่ำ), `19` (เสี่ยงสูง)
ลิงก์แชร์ได้ เช่น http://localhost:5173/?tab=whatif&id=19

---

## Database (PostgreSQL) — ไม่บังคับ

ทีมเลือกใช้ PostgreSQL ใน `docker-compose.yml` (DE-04) schema อยู่ที่ [docker/postgres/init/02-app-schema.sql](../docker/postgres/init/02-app-schema.sql)
ไม่ตั้ง `DATABASE_URL` = backend อ่านพนักงานจาก CSV ของ IBM เหมือนเดิม จึงไม่รัน database ก็ใช้ระบบได้ครบ

### ก่อนใช้ Docker ครั้งแรกบน Windows

Docker Desktop ต้องใช้ฟีเจอร์ Virtual Machine Platform ของ Windows ถ้าเปิด Docker แล้วขึ้น "Virtual Machine Platform not enabled":

1. กด Start พิมพ์ `PowerShell` → คลิกขวา → **Run as administrator** (หน้าต่างต้องขึ้นว่า "Administrator" และบรรทัดคำสั่งเป็น `PS C:\WINDOWS\system32>`)
2. รันบรรทัดเดียวนี้ แล้ว restart เครื่อง

   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
   ```

3. เปิด Docker Desktop รอจนขึ้น "Engine running"

ถ้า restart แล้วยังไม่ได้ ดู Task Manager → Performance → CPU ช่อง "Virtualization" ถ้าเป็น Disabled ต้องเปิด Intel VT-x / AMD-V ใน BIOS

### รัน database

เพิ่มใน `.env` (ตัวอักษร/ตัวเลขล้วน):

```ini
POSTGRES_PASSWORD=ตั้งเองได้เลย
DATABASE_URL=postgresql://attrition:รหัสเดียวกับบรรทัดบน@127.0.0.1:5432/attrition
```

ใช้ `127.0.0.1` ห้ามใช้ `localhost` เพราะบน Windows จะลอง IPv6 ก่อน ต่อช้าเกือบ 2 นาที

แล้วรัน (ถ้าเอาแค่ database ไม่เอา MLflow ใส่ `postgres` ท้ายคำสั่ง):

```bash
docker compose up -d postgres
```

- ครั้งแรก (volume ใหม่) ตารางทั้ง 9 ตารางถูกสร้างอัตโนมัติ
- ถ้าเคยรันก่อนมี schema (volume เก่า) ให้สร้างตารางเอง:

  ```bash
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U attrition -d attrition < docker/postgres/init/02-app-schema.sql
  ```

- เช็กตาราง: `docker compose exec postgres psql -U attrition -d attrition -c "\dt"`

### ใส่ข้อมูลและให้คะแนน

```bash
python src/db.py               # โหลด IBM dataset 1,470 คนเข้าตาราง employees (รันซ้ำได้)
python backend/batch_score.py  # ให้คะแนนทุกคน บันทึกผลทำนาย SHAP ต้นทุน และสรุปบริษัท/แผนก
```

- หลังตั้ง `DATABASE_URL` แล้ว backend อ่านพนักงานจากตาราง `employees` (tenant `ibm_demo`) แทน CSV ต้อง restart backend
- `batch_score.py` รันซ้ำได้ ทุกรอบเพิ่มผลชุดใหม่ ผลล่าสุดคือ `scored_at` มากสุด (Superset อ่านจากตารางพวกนี้)
- ถ้าตั้ง `DATABASE_URL` แล้วแต่ยังไม่ได้รัน `src/db.py` backend จะแจ้งว่าไม่มีพนักงานในฐานข้อมูล
- ปิด: `docker compose down` (ข้อมูลยังอยู่ใน volume) ถ้าจะล้างทิ้งทั้งหมด: `docker compose down -v`

---

## รัน test ก่อน push

```bash
.venv\Scripts\activate
ruff check .
python -m pytest backend                                 # ต้องตั้ง .env แล้ว (โหลดโมเดลจาก DagsHub)
cd frontend && npm run lint && npm test && npm run build
```

CI บน GitHub รันชุดเดียวกันนี้ทุก PR

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
| :--- | :--- | :--- |
| หน้าเว็บขึ้นตัวการ์ตูนโค้งขอโทษ "ติดต่อ backend ไม่ได้" | backend ไม่ได้รัน หรือรันไม่ขึ้น | เปิด Terminal 1 แล้วดู error ในนั้น |
| หน้าเว็บขึ้น "ไม่เจอพนักงานรหัสนี้นะ" | รหัสพนักงานไม่มีใน dataset (รหัสมีถึง 2068 แต่ไม่ต่อเนื่อง) | เลือกจากรายชื่อเสี่ยงสูงในหน้าภาพรวมแทน |
| backend error เรื่อง MLflow / `MODEL_URI` / 401 | `.env` ไม่ครบ หรือ token DagsHub ผิด/หมดอายุ | ทำขั้นที่ 5 ใหม่ ดู [docs/mlflow_setup.md](mlflow_setup.md) |
| `uvicorn` / `streamlit` is not recognized | ยังไม่ได้ activate `.venv` | `.venv\Scripts\activate` ก่อน |
| `'oxlint' is not recognized` หรือ `npm install` error EPERM | `node_modules` ไม่ครบ หรือถูก `npm run dev` ล็อกไฟล์ไว้ | ปิด `npm run dev` ทุกตัวก่อน แล้ว `cd frontend && npm ci` |
| `Port 5173 is in use` / `[Errno 10048]` port 8000 | มีตัวเดิมรันค้างอยู่ | ปิด terminal เก่า หรือรันอีก port เช่น `uvicorn main:app --reload --port 8001` (ต้องแก้ proxy ใน `frontend/vite.config.js` ตามด้วย) |
| `docker compose` ขึ้น "required variable POSTGRES_PASSWORD is missing" | ยังไม่ได้ตั้งค่าใน `.env` | เพิ่ม `POSTGRES_PASSWORD=...` ใน `.env` |
| Docker Desktop ขึ้น "Virtual Machine Platform not enabled" | Windows ยังไม่เปิดฟีเจอร์ | ดูหัวข้อ "ก่อนใช้ Docker ครั้งแรกบน Windows" ด้านบน |
| `Enable-WindowsOptionalFeature` ขึ้น "requires elevation" | PowerShell ไม่ได้เปิดแบบ admin | เปิดใหม่ด้วย Run as administrator แล้ววางเฉพาะบรรทัดคำสั่ง (ไม่ต้องวาง error เก่าลงไปด้วย) |
| ดึงโค้ดใหม่แล้วรันไม่ขึ้น | แพ็กเกจเปลี่ยน | `pip install -r requirements-dev.txt` และ `cd frontend && npm install` ใหม่ |

---

## อ่านต่อ

- ภาพรวมโปรเจกต์ / API / business logic: [README.md](../README.md)
- ตั้งค่า MLflow ทุกแบบ: [docs/mlflow_setup.md](mlflow_setup.md)
- ข้อมูล IBM dataset: [docs/dataset.md](dataset.md)
- ใครทำอะไรอยู่: [TASKS.md](../TASKS.md)
