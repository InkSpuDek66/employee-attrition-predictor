# ตั้งค่า MLflow กลางของทีม (DagsHub)

ทีมใช้ MLflow บน [DagsHub](https://dagshub.com) เป็น tracking server กลาง เหตุผลที่เลือก:

- **ฟรี** สำหรับ repo สาธารณะและงานนักศึกษา ไม่ต้องเช่าเซิร์ฟเวอร์
- **ไม่ต้องดูแลเครื่องเอง** ต่างจากการรัน MLflow ด้วย Docker ในเครื่องใครคนหนึ่ง ซึ่งคนอื่นจะ log ไม่ได้ตอนเครื่องนั้นปิด
- **ทั้ง 4 คน log เข้าที่เดียวกัน** เทียบ run ของทุกคน และใช้ Model Registry ร่วมกันได้ทันที

ถ้ายังไม่ได้ตั้ง `.env` โค้ดจะ log ลง `mlflow.db` (sqlite) ในเครื่องแทน ทำงานต่อได้ แต่คนอื่นจะไม่เห็น run ของเรา

## ขั้นตอนสำหรับคนตั้ง (ทำครั้งเดียว: Saphondanai)

1. สมัคร DagsHub ด้วยบัญชี GitHub
2. กด **Create → New Repository → Connect a repository** แล้วเลือก `InkSpuDek66/employee-attrition-predictor` (DagsHub จะ mirror repo จาก GitHub ให้)
3. ในหน้า repo บน DagsHub กด **Remote → Experiments** แล้วคัดลอก MLflow tracking URI รูปแบบ `https://dagshub.com/<owner>/employee-attrition-predictor.mlflow`
4. ไปที่ **Settings → Collaborators** เพิ่มเพื่อนร่วมทีมอีก 3 คน ให้สิทธิ์ **Write** เพื่อให้ log ได้
5. แจก URI ให้ทีม (URI ไม่ใช่ความลับ ส่วน token เป็นความลับ ห้ามแชร์)

## ขั้นตอนสำหรับทุกคน

1. สร้าง access token ของตัวเองที่ DagsHub: **User Settings → Tokens**
2. คัดลอก `.env.example` เป็น `.env` แล้วเอา `#` หน้า 3 บรรทัดของ MLflow ออก ใส่ค่าจริง:
   ```
   MLFLOW_TRACKING_URI=https://dagshub.com/<owner>/employee-attrition-predictor.mlflow
   MLFLOW_TRACKING_USERNAME=<ชื่อผู้ใช้ DagsHub ของตัวเอง>
   MLFLOW_TRACKING_PASSWORD=<token ของตัวเอง>
   ```
3. ทดสอบว่า log ได้จริง (จากรากโปรเจกต์):
   ```bash
   python -c "import sys; sys.path.append('src'); import mlflow, mlflow_setup; print(mlflow_setup.setup('connection-test')); mlflow.start_run(run_name='hello').__exit__(None, None, None); print('OK')"
   ```
   ถ้าขึ้น `OK` ให้ไปดู run ชื่อ `hello` ในหน้า Experiments ของ DagsHub

## ใช้ในโค้ด

```python
import sys
sys.path.append("../src")        # จาก notebooks/
import mlflow_setup
mlflow_setup.setup("ชื่อ-experiment")   # แทน mlflow.set_tracking_uri("sqlite:///../mlflow.db")
```

Backend (`backend/model_store.py`) อ่าน `.env` ผ่าน `mlflow_setup` เช่นกัน เปลี่ยนโมเดลที่ใช้ด้วย `MODEL_URI` ใน `.env` ได้โดยไม่แก้โค้ด

## ย้าย run เดิมในเครื่องขึ้น DagsHub

run ที่อยู่ใน `mlflow.db` ของแต่ละคนจะไม่ย้ายขึ้นไปเอง วิธีที่ง่ายสุดคือตั้ง `.env` แล้วรัน notebook เดิมใหม่อีกรอบ (ผลเหมือนเดิมเพราะใช้ seed คงที่)
