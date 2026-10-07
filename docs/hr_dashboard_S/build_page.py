"""สร้าง docs/hr_dashboard_S/index.html (dashboard การลาออกแบบกดกรองได้) จาก CSV ดิบ

รัน (จากรากโปรเจกต์):
    python docs/hr_dashboard_S/build_page.py

- กราฟชุดเดียวกับ docs/hr_attrition_dashboard.ipynb (KPI + 9 กราฟ + ตาราง) ใช้ช่วงอายุ/อายุงาน/รายได้แบบเดียวกัน
- ฝังข้อมูลรายคนลง page_template.html ตรงตำแหน่ง __DATA__ หน้าเว็บคำนวณตัวเลขเองในเบราว์เซอร์
  จึงกดกรองได้โดยไม่ต้องมี server ได้ไฟล์ HTML ไฟล์เดียว เปิดในเบราว์เซอร์ได้เลย
"""

import csv
import datetime
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(ROOT, "data", "raw", "WA_Fn-UseC_-HR-Employee-Attrition.csv")

# ค่าคงที่ทุกแถว/ตัวระบุแถว ชุดเดียวกับ NOISE_COLUMNS ใน src/clean_pipeline.py
DROP = {"EmployeeCount", "StandardHours", "Over18", "EmployeeNumber"}

# mean |SHAP| 10 อันดับแรกของ attrition-xgboost-P v1 บน test set 294 คน
# คัดลอกจาก output cell สุดท้ายของ notebooks/05_shap_P.ipynb ถ้ารัน notebook นั้นใหม่ให้อัปเดตตรงนี้ด้วย
SHAP_TOP10 = [
    ("OverTime", 0.350),
    ("StockOptionLevel", 0.350),
    ("NumCompaniesWorked", 0.309),
    ("AvgSatisfaction", 0.301),
    ("MonthlyIncome", 0.289),
    ("OverTimeXDistance", 0.274),
    ("Age", 0.258),
    ("YearsWithCurrManager", 0.225),
    ("BusinessTravel", 0.203),
    ("DailyRate", 0.191),
]


def load_columns(path: str) -> dict:
    """อ่าน CSV เป็นคอลัมน์ ตัวเลขเก็บเป็น int ส่วนข้อความเก็บเป็นรหัส + รายการค่า (ไฟล์เล็กลง)"""
    with open(path, encoding="utf-8-sig", newline="") as f:  # ไฟล์ดิบมี BOM นำหน้า
        rows = list(csv.DictReader(f))
    num, cat = {}, {}
    for col in rows[0]:
        if col in DROP:
            continue
        values = [r[col] for r in rows]
        if all(v.lstrip("-").isdigit() for v in values):
            num[col] = [int(v) for v in values]
        else:
            levels = sorted(set(values))
            index = {v: i for i, v in enumerate(levels)}
            cat[col] = {"levels": levels, "codes": [index[v] for v in values]}
    return {"n": len(rows), "num": num, "cat": cat}


def build() -> str:
    data = load_columns(RAW)
    data["shap"] = [{"feature": f, "value": v} for f, v in SHAP_TOP10]
    data["source"] = os.path.basename(RAW)
    data["built"] = datetime.date.today().isoformat()

    # กัน "</script>" ในข้อความปิด tag ก่อนเวลา
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    with open(os.path.join(HERE, "page_template.html"), encoding="utf-8") as f:
        page = f.read().replace("__DATA__", payload)
    out = os.path.join(HERE, "index.html")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(page)
    return out


if __name__ == "__main__":
    print("written", build())
