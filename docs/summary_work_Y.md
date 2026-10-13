# สรุปงานของ Yanisa + วิธีติดตั้งเครื่องมือ

อัปเดตล่าสุด: 13 ต.ค. 2026

## 1. งานที่เสร็จแล้ว (อยู่บน main)

| งาน | ไฟล์ | ทำอะไร | ผลหลัก |
| :--- | :--- | :--- | :--- |
| **EDA ฝั่งตัวเลข** (wk1) | [notebooks/01_eda_numeric_Y.ipynb](../notebooks/01_eda_numeric_Y.ipynb) | เทียบข้อมูลตัวเลข 23 ตัวว่าคนลาออกกับคนอยู่ต่อต่างกันยังไง | อายุน้อย เงินเดือนน้อย ประสบการณ์น้อย ลาออกมากกว่า |
| **Survival Analysis** (wk6–7) | [notebooks/08_survival_analysis_Y.ipynb](../notebooks/08_survival_analysis_Y.ipynb) | ดูว่าคน**ลาออกเมื่อไหร่** และกลุ่มไหนลาออกเร็วกว่ากัน | 32% ของคนที่ลาออก ออกภายใน 2 ปีแรก และคนทำ OT ลาออกเร็วขึ้น 3.2 เท่า |
| **Fairness check** (wk6–7) | [notebooks/09_fairness_check_Y.ipynb](../notebooks/09_fairness_check_Y.ipynb) | ตรวจว่าระบบ**ยุติธรรม**กับทุกกลุ่มไหม (เพศ อายุ สถานภาพ) | คนอายุ 40 ขึ้นไปที่จะลาออก ระบบจับได้ไม่ถึงครึ่ง และโมเดลใช้เพศในการคิดคะแนน |
| **คู่มือให้ Nanthamon ตรวจ** | [docs/review_guide_survival_fairness_Y.md](review_guide_survival_fairness_Y.md) | วิธีรันซ้ำ จุดที่ต้องเช็ค และคำถามที่กรรมการน่าจะถาม | — |

รูปสำหรับใส่สไลด์อยู่ใน `docs/figures/` แยกโฟลเดอร์ตามงาน: `eda_numeric_Y`, `survival_Y`, `fairness_Y`

## 2. `pip install -r requirements-dev.txt` คืออะไร

เป็นคำสั่ง**ติดตั้งเครื่องมือทั้งหมดที่โปรเจกต์ต้องใช้** ตามรายการในไฟล์ [requirements-dev.txt](../requirements-dev.txt)

**เปรียบเทียบง่าย ๆ:** เหมือนรายการวัตถุดิบทำอาหาร
- `requirements-dev.txt` = **ใบรายการ** เช่น แป้ง 1 ถุง ไข่ 2 ฟอง
- `pip install -r` = **ไปซื้อของตามใบรายการ**ให้ครบ
- ถ้าขาดของบางอย่าง ทำอาหารไม่ได้ เหมือนรันโน้ตบุ๊กแล้วขึ้น error ว่าหาเครื่องมือไม่เจอ

### แยกคำทีละส่วน

| ส่วน | ความหมาย |
| :--- | :--- |
| `pip` | โปรแกรมติดตั้งเครื่องมือ (ไลบรารี) ของ Python |
| `install` | ติดตั้ง |
| `-r` | อ่านรายการจากไฟล์ (r = requirements) |
| `requirements-dev.txt` | ไฟล์รายการเครื่องมือ พร้อมเวอร์ชันที่ทีมตกลงกันไว้ เช่น `pandas==3.0.6` |

### ทำไมทุกคนต้องรันใหม่หลัง pull

งาน Survival และ Fairness ใช้เครื่องมือใหม่ 2 ตัวที่เพิ่มเข้าไปในรายการ
- `statsmodels` สำหรับ Survival Analysis (ใช้แทน lifelines ที่ยังไม่รองรับ pandas 3)
- `fairlearn` สำหรับ Fairness check

ถ้ายังไม่ได้ติดตั้ง เปิดโน้ตบุ๊กแล้วจะ error ว่า `No module named 'statsmodels'` การรันคำสั่งนี้ซ้ำไม่มีผลเสีย ของที่มีอยู่แล้วจะถูกข้ามไป ติดตั้งเฉพาะของที่ขาด

### วิธีรัน

เปิด terminal ที่โฟลเดอร์โปรเจกต์ แล้ววางทีละบรรทัด

```bash
.venv\Scripts\activate             # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
```

บรรทัดแรกคือเปิดใช้ venv ของโปรเจกต์ก่อน เพื่อให้ติดตั้งลง venv ไม่ใช่ลง Python หลักของเครื่อง (ดูรายละเอียดเพิ่มที่ [docs/run_guide.md](run_guide.md))
