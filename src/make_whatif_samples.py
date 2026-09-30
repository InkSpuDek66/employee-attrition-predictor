"""สร้างข้อมูลพนักงานจำลองสำหรับทดสอบ What-if Simulator -> data/sample/whatif_employees.csv

รัน: python src/make_whatif_samples.py   (จากรากโปรเจกต์)

เป็นคนสมมติทั้งหมด (ไม่ใช่แถวจาก dataset) สร้างจากค่ากลางของ IBM dataset แล้วเขียนทับเฉพาะค่าที่ทำให้
แต่ละคนมีลักษณะเฉพาะ เพื่อให้ครอบคลุมทั้งกลุ่มเสี่ยงสูง/กลาง/ต่ำ และมีมาตรการให้ลองปรับชัดเจน
ค่าทุกคนผ่าน schema เดียวกับ API (backend/schemas.EmployeeInput) จึงส่งเข้า POST /whatif ได้ตรง ๆ
"""

import os
import sys

import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(ROOT, "src"))
from clean_pipeline import NOISE_COLUMNS, RAW_FILENAME, TARGET_COLUMN, load_raw_data  # noqa: E402

OUT = os.path.join(ROOT, "data", "sample", "whatif_employees.csv")

# (รหัส, คำอธิบาย, มาตรการที่น่าลอง, ค่าที่เขียนทับจากค่ากลาง)
PERSONAS = [
    ("SIM-01", "พนักงานขายจบใหม่ ทำ OT หนัก รายได้ต่ำ บ้านไกล", "ลองปิด OT หรือขึ้นเงินเดือน",
     dict(Age=23, Department="Sales", JobRole="Sales Representative", JobLevel=1, MonthlyIncome=2200, OverTime="Yes",
          DistanceFromHome=22, MaritalStatus="Single", TotalWorkingYears=1, NumCompaniesWorked=1, YearsAtCompany=1,
          YearsInCurrentRole=0, YearsSinceLastPromotion=0, YearsWithCurrManager=0, StockOptionLevel=0,
          WorkLifeBalance=2, JobSatisfaction=2, Education=3, EducationField="Marketing")),
    ("SIM-02", "นักวิจัยอาวุโส พอใจงาน มีสิทธิ์ซื้อหุ้น", "ลองเพิ่ม OT ดูว่าความเสี่ยงขึ้นแค่ไหน",
     dict(Age=45, Department="Research & Development", JobRole="Research Director", JobLevel=4, MonthlyIncome=15500,
          OverTime="No", MaritalStatus="Married", TotalWorkingYears=20, NumCompaniesWorked=2, YearsAtCompany=12,
          YearsInCurrentRole=7, YearsSinceLastPromotion=2, YearsWithCurrManager=7, StockOptionLevel=2,
          JobSatisfaction=4, EnvironmentSatisfaction=4, WorkLifeBalance=3, Education=5)),
    ("SIM-03", "ไม่ได้เลื่อนตำแหน่งมา 7 ปี ความพึงพอใจต่ำ", "ลองเลื่อนตำแหน่ง (ระดับ +1, ปีที่ไม่ได้เลื่อน = 0)",
     dict(Age=38, Department="Research & Development", JobRole="Laboratory Technician", JobLevel=1,
          MonthlyIncome=3200, TotalWorkingYears=12, NumCompaniesWorked=2, YearsAtCompany=9, YearsInCurrentRole=7,
          YearsSinceLastPromotion=7, YearsWithCurrManager=7, JobSatisfaction=1, EnvironmentSatisfaction=1,
          JobInvolvement=2)),
    ("SIM-04", "อายุน้อย โสด ต้องเดินทางไปทำงานบ่อย", "ลองลดการเดินทาง",
     dict(Age=27, Department="Sales", JobRole="Sales Executive", JobLevel=2, MonthlyIncome=5200,
          BusinessTravel="Travel_Frequently", MaritalStatus="Single", TotalWorkingYears=5, NumCompaniesWorked=3,
          YearsAtCompany=2, YearsInCurrentRole=2, YearsSinceLastPromotion=1, YearsWithCurrManager=2, StockOptionLevel=0)),
    ("SIM-05", "ผู้จัดการรายได้สูง แต่ทำ OT และสมดุลงาน-ชีวิตแย่", "ลองปิด OT หรือปรับสมดุลงาน-ชีวิต",
     dict(Age=42, Department="Sales", JobRole="Manager", JobLevel=4, MonthlyIncome=16000, OverTime="Yes",
          WorkLifeBalance=1, TotalWorkingYears=18, NumCompaniesWorked=3, YearsAtCompany=8, YearsInCurrentRole=5,
          YearsSinceLastPromotion=3, YearsWithCurrManager=4, StockOptionLevel=1, MaritalStatus="Married")),
    ("SIM-06", "เปลี่ยนงานบ่อย (8 บริษัท) เพิ่งเข้าบริษัทนี้ปีเดียว", "ลองเพิ่มสิทธิ์ซื้อหุ้น/สวัสดิการระยะยาว",
     dict(Age=34, JobRole="Research Scientist", JobLevel=1, MonthlyIncome=3000, TotalWorkingYears=10,
          NumCompaniesWorked=8, YearsAtCompany=1, YearsInCurrentRole=0, YearsSinceLastPromotion=0,
          YearsWithCurrManager=0, StockOptionLevel=0, MaritalStatus="Single")),
    ("SIM-07", "เจ้าหน้าที่แล็บ เพิ่งเปลี่ยนหัวหน้า ไม่มีสิทธิ์ซื้อหุ้น", "ลองเพิ่มสิทธิ์ซื้อหุ้นและความพึงพอใจกับเพื่อนร่วมงาน",
     dict(Age=30, Department="Research & Development", JobRole="Laboratory Technician", JobLevel=1,
          MonthlyIncome=2700, TotalWorkingYears=6, NumCompaniesWorked=1, YearsAtCompany=5, YearsInCurrentRole=3,
          YearsSinceLastPromotion=1, YearsWithCurrManager=0, StockOptionLevel=0, RelationshipSatisfaction=1)),
    ("SIM-08", "เจ้าหน้าที่ HR ระดับกลาง ทุกอย่างปานกลาง", "ลองขึ้นเงินเดือนหรือเพิ่มการอบรม",
     dict(Age=35, Department="Human Resources", JobRole="Human Resources", EducationField="Human Resources",
          JobLevel=2, MonthlyIncome=4500, TotalWorkingYears=9, NumCompaniesWorked=2, YearsAtCompany=5,
          YearsInCurrentRole=3, YearsSinceLastPromotion=2, YearsWithCurrManager=3)),
    ("SIM-09", "พนักงานผลิตมั่นคง แต่งงาน อยู่มา 10 ปี", "ลองให้ทำ OT หรือไม่ได้เลื่อนตำแหน่งนาน",
     dict(Age=40, Department="Research & Development", JobRole="Manufacturing Director", JobLevel=3,
          MonthlyIncome=9000, MaritalStatus="Married", TotalWorkingYears=15, NumCompaniesWorked=1, YearsAtCompany=10,
          YearsInCurrentRole=6, YearsSinceLastPromotion=1, YearsWithCurrManager=6, StockOptionLevel=1,
          WorkLifeBalance=3, JobSatisfaction=3)),
    ("SIM-10", "พนักงานขายหน้าร้าน โสด OT แต่ความพึงพอใจสูง", "ลองปิด OT ดูว่าความพึงพอใจสูงช่วยได้แค่ไหน",
     dict(Age=25, Department="Sales", JobRole="Sales Representative", JobLevel=1, MonthlyIncome=2600, OverTime="Yes",
          MaritalStatus="Single", TotalWorkingYears=3, NumCompaniesWorked=1, YearsAtCompany=3, YearsInCurrentRole=2,
          YearsSinceLastPromotion=1, YearsWithCurrManager=2, JobSatisfaction=4, EnvironmentSatisfaction=4,
          RelationshipSatisfaction=4, StockOptionLevel=0)),
]


def build() -> pd.DataFrame:
    raw = load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))
    cols = [c for c in raw.columns if c not in NOISE_COLUMNS + [TARGET_COLUMN]]
    base = {c: int(raw[c].median()) if raw[c].dtype.kind in "if" else raw[c].mode()[0] for c in cols}
    rows = [{"sample_id": sid, "description": desc, "try": hint, **base, **over} for sid, desc, hint, over in PERSONAS]
    return pd.DataFrame(rows)


if __name__ == "__main__":
    df = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    df.to_csv(OUT, index=False, encoding="utf-8")
    print(f"เขียน {len(df)} คนไปที่ {os.path.relpath(OUT, ROOT)}")
