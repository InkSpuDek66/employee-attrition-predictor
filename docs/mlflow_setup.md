# ตั้งค่า MLflow

โค้ดเกือบทุกส่วน (notebook, `src/train.py`, backend) ชี้ MLflow ผ่าน `src/mlflow_setup.py` ซึ่งอ่าน `MLFLOW_TRACKING_URI` จาก `.env` จึงสลับปลายทางได้โดยไม่แก้โค้ด (ยกเว้น `src/shap_explain.py` และ `notebooks/05_shap_P.ipynb` ที่ยังชี้ sqlite ในเครื่องแบบ hardcode) มี 3 แบบ:

| แบบ | ใช้เมื่อ | `MLFLOW_TRACKING_URI` |
| :--- | :--- | :--- |
| sqlite ในเครื่อง | ทดลองคนเดียว (ค่าเริ่มต้นถ้าไม่ตั้งอะไร) | ไม่ต้องตั้ง (ใช้ `mlflow.db`) |
| Self-host ด้วย docker compose | สภาพแวดล้อมของตัวผลิตภัณฑ์ และ CI | `http://localhost:5000` |
| DagsHub | ทีมแชร์ run กันช่วงพัฒนา โดยไม่ต้องมีใครเปิดเครื่องทิ้งไว้ | `https://dagshub.com/InkSpuDek66/employee-attrition-predictor.mlflow` |

## ทำไมตัวผลิตภัณฑ์ใช้แบบ self-host

- เรื่อง PDPA: เมื่อบริษัทลูกค้าใช้ข้อมูลพนักงานจริง (recalibrate / เทรนใหม่) ข้อมูลส่วนบุคคลและโมเดลที่เทรนจากข้อมูลนั้นต้องอยู่ในเซิร์ฟเวอร์ของบริษัท ไม่ควรส่งไป SaaS ต่างประเทศ
- เป็น open source ทั้งหมด MLflow (Apache-2.0) + PostgreSQL (PostgreSQL License) ไม่มีค่า license และไม่ขึ้นกับเงื่อนไข free tier ของผู้ให้บริการ
- ติดตั้งในเครื่องของบริษัท (on-premise) ได้ด้วยคำสั่งเดียว metadata เก็บใน PostgreSQL ตัวเดียวกับแอป (แยก database) artifact เก็บใน docker volume

DagsHub ยังใช้ได้ช่วงพัฒนา เพราะ dataset ของโปรเจกต์เป็นข้อมูลสมมติ (ดู [dataset.md](dataset.md)) แต่ห้ามใช้กับข้อมูลพนักงานจริง

> คำเตือน: MLflow บน DagsHub ของทีมเป็นสาธารณะ เพราะ repo บน DagsHub เป็น mirror ของ GitHub repo ที่เป็น public ทุก run, metric, โมเดล และ artifact ที่ log ขึ้นไป คนนอกดูและดาวน์โหลดได้โดยไม่ต้อง login ห้าม log ข้อมูลพนักงานจริงหรือสิ่งที่ได้จากข้อมูลจริงขึ้น DagsHub ถ้าจะใช้ข้อมูลจริงให้ใช้แบบ self-host หรือ DagsHub repo แบบ private เท่านั้น

## Self-host ด้วย docker compose

ต้องมี Docker Desktop (หรือ Docker Engine + Compose v2)

1. ใน `.env` ตั้งรหัสผ่าน database (ใช้ตัวอักษร/ตัวเลขล้วน เพราะรหัสถูกใส่ใน connection URI) และชี้ MLflow ไปที่ server:
   ```
   POSTGRES_PASSWORD=<รหัสผ่านที่ตั้งเอง>
   MLFLOW_TRACKING_URI=http://localhost:5000
   ```
2. เปิด service:
   ```bash
   docker compose up -d --build --wait
   ```
   - MLflow UI: http://localhost:5000
   - PostgreSQL: `localhost:5432` database `attrition` (ของแอป) และ `mlflow` (ของ MLflow) user `attrition`
   - ทั้งสอง port เปิดเฉพาะ `127.0.0.1` คนนอกเครื่องเข้าไม่ได้ ถ้าชน port เดิมในเครื่อง เปลี่ยนด้วย `MLFLOW_PORT` / `POSTGRES_PORT` ใน `.env`
3. เทรนและ register โมเดล แล้วตั้ง `MODEL_URI` ให้ backend:
   ```bash
   python src/train.py            # พิมพ์ registered: models:/attrition-xgboost-P/<version>
   ```
   ```
   MODEL_URI=models:/attrition-xgboost-P/1
   ```
4. ปิด: `docker compose down` (ข้อมูลยังอยู่ใน volume) ลบข้อมูลทั้งหมด: `docker compose down -v`

> `POSTGRES_PASSWORD` มีผลแค่ตอนสร้าง volume ครั้งแรก ถ้าเปลี่ยนรหัสทีหลังต้อง `docker compose down -v` แล้วสร้างใหม่

## DagsHub (ช่วงพัฒนา)

### ขั้นตอนสำหรับคนตั้ง (ทำครั้งเดียว: Saphondanai)

1. สมัคร DagsHub ด้วยบัญชี GitHub
2. กด **Create → New Repository → Connect a repository** แล้วเลือก `InkSpuDek66/employee-attrition-predictor` (DagsHub จะ mirror repo จาก GitHub ให้)
3. ในหน้า repo บน DagsHub กดปุ่ม **Experiments ▾** แล้วคัดลอก MLflow tracking URI: `https://dagshub.com/InkSpuDek66/employee-attrition-predictor.mlflow`
4. ไปที่ **Settings → Collaborators** เพิ่มเพื่อนร่วมทีมอีก 3 คน ให้สิทธิ์ **Write** เพื่อให้ log ได้
5. แจก URI ให้ทีม (URI ไม่ใช่ความลับ ส่วน token เป็นความลับ ห้ามแชร์)

### ขั้นตอนสำหรับทุกคน

1. สร้าง access token ของตัวเองที่ DagsHub: **User Settings → Tokens**
2. คัดลอก `.env.example` เป็น `.env` แล้วเอา `#` หน้า 3 บรรทัดของ DagsHub ออก ใส่ค่าจริง:
   ```
   MLFLOW_TRACKING_URI=https://dagshub.com/InkSpuDek66/employee-attrition-predictor.mlflow
   MLFLOW_TRACKING_USERNAME=<ชื่อผู้ใช้ DagsHub ของตัวเอง>
   MLFLOW_TRACKING_PASSWORD=<token ของตัวเอง>
   ```

## ทดสอบการเชื่อมต่อ (ทุกแบบ)

จากรากโปรเจกต์:
```bash
python -c "import sys; sys.path.append('src'); import mlflow, mlflow_setup; print(mlflow_setup.setup('connection-test')); mlflow.start_run(run_name='hello').__exit__(None, None, None); print('OK')"
```
ถ้าขึ้น `OK` ให้ไปดู run ชื่อ `hello` ในหน้า Experiments ของ MLflow UI

## ใช้ในโค้ด

```python
import sys
sys.path.append("../src")        # จาก notebooks/
import mlflow_setup
mlflow_setup.setup("ชื่อ-experiment")   # แทน mlflow.set_tracking_uri("sqlite:///../mlflow.db")
```

Backend (`backend/model_store.py`) อ่าน `.env` ผ่าน `mlflow_setup` เช่นกัน เปลี่ยนโมเดลที่ใช้ด้วย `MODEL_URI` ใน `.env` ได้โดยไม่แก้โค้ด

> ตอน deploy (เช่น Render) ห้ามใส่ DagsHub token ส่วนตัวของสมาชิกใน environment ของ backend เพราะ token ส่วนตัวมีสิทธิ์ Write ถ้า server ถูกเจาะ ผู้โจมตีจะแก้ Model Registry ได้ backend ต้องการแค่อ่านโมเดล ให้ใช้ token ของบัญชีแยกที่อ่านได้อย่างเดียว หรือ bake ไฟล์โมเดลเข้า Docker image ตอน build

## ย้าย run เดิมในเครื่องขึ้น server

run ที่อยู่ใน `mlflow.db` ของแต่ละคนจะไม่ย้ายขึ้นไปเอง วิธีที่ง่ายสุดคือตั้ง `.env` แล้วรัน notebook เดิมหรือ `python src/train.py` ใหม่อีกรอบ

> เทรนใหม่ไม่ได้โมเดลตัวเดิมเสมอไป แม้ใช้ seed เดียวกัน (`random_state=42`) XGBoost ยังให้ผลต่างกันตามจำนวน thread และระบบปฏิบัติการ (วัดได้ test AUC 0.805–0.815) รันซ้ำบนเครื่องเดิมด้วยการตั้งค่าเดิมจึงจะได้ผลเดิม ดังนั้นตัวเลขในรายงานและสไลด์ให้คำนวณจากการโหลดโมเดลที่ register แล้ว (`models:/attrition-xgboost-P/1`) ไม่ใช่เทรนใหม่ run ที่สร้างจาก `src/train.py` มี tag `platform`, `n_jobs`, `cpu_count`, `data_sha256` และ `mlflow.source.git.commit` ไว้ตรวจย้อนหลังว่าโมเดลมาจากเครื่อง ข้อมูล และโค้ดชุดไหน
