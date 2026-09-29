"""หน้าเว็บทดสอบโมเดล (EXPERIMENTAL) -- กรอกข้อมูลพนักงานแล้วดูระดับความเสี่ยงลาออก

ไม่ใช่ frontend จริงของโปรเจกต์ (ตัวจริงคือ React + FastAPI ตาม README) ใช้แค่ลองโมเดลในเครื่อง
รัน: streamlit run src/test_app.py   (จากรากโปรเจกต์ ต้องมี mlflow.db จาก notebook 04)
"""

import os
import sys

import mlflow.xgboost
import pandas as pd
import streamlit as st

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from clean_pipeline import NOISE_COLUMNS, RAW_FILENAME, TARGET_COLUMN, clean_data, load_raw_data
from feature_pipeline import SELECTED_FEATURES, add_features

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MODEL_URI = "models:/attrition-xgboost-P/1"


@st.cache_resource
def load():
    mlflow.set_tracking_uri(f"sqlite:///{os.path.abspath(os.path.join(ROOT, 'mlflow.db'))}")
    return mlflow.xgboost.load_model(MODEL_URI), load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))


def predict(model, raw: pd.DataFrame, row: dict) -> float:
    # ต่อท้ายข้อมูลดิบก่อน clean เพื่อให้ one-hot ได้คอลัมน์ครบเหมือนตอนเทรน แล้วเอาแถวสุดท้าย
    new = pd.DataFrame([{**row, **{c: raw[c].iloc[0] for c in NOISE_COLUMNS}, TARGET_COLUMN: "No"}])
    df = add_features(clean_data(pd.concat([raw, new], ignore_index=True)), only=SELECTED_FEATURES)
    X = df.drop(columns=TARGET_COLUMN).iloc[[-1]][model.feature_names_in_]
    return float(model.predict_proba(X)[0, 1])


LEVEL = {1: "ต่ำ", 2: "พอใช้/ปานกลาง", 3: "ดี/สูง", 4: "ดีมาก/สูงมาก"}
SAT = {1: "ต่ำ", 2: "ปานกลาง", 3: "สูง", 4: "สูงมาก"}

# ตัวเลือกแบบระดับ (ค่าตัวเลขใน dataset -> คำอธิบายที่คนอ่านเข้าใจ)
ORDINAL = {
    "Education": {1: "ต่ำกว่ามหาวิทยาลัย", 2: "อนุปริญญา", 3: "ปริญญาตรี", 4: "ปริญญาโท", 5: "ปริญญาเอก"},
    "EnvironmentSatisfaction": SAT,
    "JobSatisfaction": SAT,
    "RelationshipSatisfaction": SAT,
    "JobInvolvement": SAT,
    "PerformanceRating": {1: "ต่ำ", 2: "ดี", 3: "ดีเยี่ยม", 4: "โดดเด่น"},
    "WorkLifeBalance": {1: "แย่", 2: "พอใช้", 3: "ดี", 4: "ดีมาก"},
    "JobLevel": {1: "ระดับ 1 (เริ่มต้น)", 2: "ระดับ 2", 3: "ระดับ 3", 4: "ระดับ 4", 5: "ระดับ 5 (สูงสุด)"},
    "StockOptionLevel": {0: "ไม่มีสิทธิ์", 1: "ระดับ 1", 2: "ระดับ 2", 3: "ระดับ 3"},
}

# ค่าหมวดหมู่ -> ภาษาไทย (ถ้าไม่มีในนี้จะแสดงค่าเดิม)
VALUE_TH = {
    "Non-Travel": "ไม่เดินทางเลย", "Travel_Rarely": "เดินทางนานๆ ครั้ง", "Travel_Frequently": "เดินทางบ่อย",
    "Sales": "ฝ่ายขาย", "Research & Development": "ฝ่ายวิจัยและพัฒนา", "Human Resources": "ฝ่ายทรัพยากรบุคคล",
    "Life Sciences": "วิทยาศาสตร์ชีวภาพ", "Medical": "การแพทย์", "Marketing": "การตลาด",
    "Technical Degree": "สายเทคนิค", "Other": "อื่นๆ",
    "Female": "หญิง", "Male": "ชาย",
    "Single": "โสด", "Married": "แต่งงาน", "Divorced": "หย่าร้าง",
    "Yes": "ใช่", "No": "ไม่ใช่",
    "Sales Executive": "ผู้บริหารฝ่ายขาย", "Research Scientist": "นักวิทยาศาสตร์วิจัย",
    "Laboratory Technician": "เจ้าหน้าที่ห้องปฏิบัติการ", "Manufacturing Director": "ผู้อำนวยการฝ่ายผลิต",
    "Healthcare Representative": "ตัวแทนด้านสุขภาพ", "Manager": "ผู้จัดการ", "Sales Representative": "พนักงานขาย",
    "Research Director": "ผู้อำนวยการฝ่ายวิจัย", "Human Resources ": "ทรัพยากรบุคคล",
}

# คอลัมน์ -> (หัวข้อ, ชื่อไทย, คำอธิบายสั้น)
FIELDS = {
    "Age": ("ข้อมูลส่วนตัว", "อายุ (ปี)", ""),
    "Gender": ("ข้อมูลส่วนตัว", "เพศ", ""),
    "MaritalStatus": ("ข้อมูลส่วนตัว", "สถานภาพสมรส", ""),
    "Education": ("ข้อมูลส่วนตัว", "ระดับการศึกษา", ""),
    "EducationField": ("ข้อมูลส่วนตัว", "สาขาที่เรียน", ""),
    "DistanceFromHome": ("ข้อมูลส่วนตัว", "ระยะทางจากบ้านถึงที่ทำงาน (กม.)", ""),
    "Department": ("งานและตำแหน่ง", "แผนก", ""),
    "JobRole": ("งานและตำแหน่ง", "ตำแหน่งงาน", ""),
    "JobLevel": ("งานและตำแหน่ง", "ระดับตำแหน่ง", "1 = ต่ำสุด, 5 = สูงสุด"),
    "BusinessTravel": ("งานและตำแหน่ง", "การเดินทางไปทำงานนอกสถานที่", ""),
    "OverTime": ("งานและตำแหน่ง", "ทำงานล่วงเวลา (OT)", ""),
    "PerformanceRating": ("งานและตำแหน่ง", "ผลประเมินการทำงาน", ""),
    "TrainingTimesLastYear": ("งานและตำแหน่ง", "จำนวนครั้งที่อบรมปีที่ผ่านมา", ""),
    "MonthlyIncome": ("รายได้", "รายได้ต่อเดือน", "หน่วยตามข้อมูล IBM ต้นฉบับ ไม่ใช่บาท"),
    "PercentSalaryHike": ("รายได้", "เงินเดือนขึ้นล่าสุด (%)", ""),
    "StockOptionLevel": ("รายได้", "สิทธิ์ซื้อหุ้นพนักงาน", ""),
    "DailyRate": ("รายได้", "อัตราค่าจ้างรายวัน", "ตามข้อมูลต้นฉบับ"),
    "HourlyRate": ("รายได้", "อัตราค่าจ้างรายชั่วโมง", "ตามข้อมูลต้นฉบับ"),
    "MonthlyRate": ("รายได้", "อัตราค่าจ้างรายเดือน", "ตามข้อมูลต้นฉบับ (คนละค่ากับรายได้ต่อเดือน)"),
    "EnvironmentSatisfaction": ("ความพึงพอใจ", "พอใจสภาพแวดล้อมที่ทำงาน", ""),
    "JobSatisfaction": ("ความพึงพอใจ", "พอใจในงานที่ทำ", ""),
    "RelationshipSatisfaction": ("ความพึงพอใจ", "พอใจความสัมพันธ์กับเพื่อนร่วมงาน", ""),
    "JobInvolvement": ("ความพึงพอใจ", "ความทุ่มเทให้กับงาน", ""),
    "WorkLifeBalance": ("ความพึงพอใจ", "สมดุลระหว่างงานกับชีวิตส่วนตัว", ""),
    "TotalWorkingYears": ("ประวัติการทำงาน", "อายุงานรวมทั้งหมด (ปี)", ""),
    "NumCompaniesWorked": ("ประวัติการทำงาน", "จำนวนบริษัทที่เคยทำงาน", ""),
    "YearsAtCompany": ("ประวัติการทำงาน", "อยู่บริษัทนี้มาแล้ว (ปี)", ""),
    "YearsInCurrentRole": ("ประวัติการทำงาน", "อยู่ในตำแหน่งปัจจุบันมาแล้ว (ปี)", ""),
    "YearsSinceLastPromotion": ("ประวัติการทำงาน", "ตั้งแต่เลื่อนตำแหน่งครั้งล่าสุด (ปี)", ""),
    "YearsWithCurrManager": ("ประวัติการทำงาน", "อยู่กับหัวหน้าคนปัจจุบันมาแล้ว (ปี)", ""),
}

# ponytail: เกณฑ์ระดับความเสี่ยงเป็นค่าประมาณ ยังไม่ได้ calibrate -- ปรับเมื่อทีมตกลง threshold
LOW, HIGH = 0.3, 0.6


def th(v):
    return VALUE_TH.get(v, v)


st.set_page_config(page_title="ทดสอบโมเดลทำนายการลาออก", layout="wide")
st.title("ทดสอบโมเดลทำนายการลาออกของพนักงาน")
st.caption("ตัวทดลอง ยังไม่ใช่ผลสุดท้ายของทีม — ใช้ดูว่าโมเดลตอบสนองต่อข้อมูลอย่างไร ไม่ควรใช้ตัดสินใจเรื่องคนจริง")
model, raw = load()

feature_cols = [c for c in raw.columns if c not in NOISE_COLUMNS + [TARGET_COLUMN]]

pick = st.selectbox(
    "เริ่มจากข้อมูลตัวอย่าง (แล้วปรับค่าเองได้)",
    ["ค่ากลางของพนักงานทั้งบริษัท"] + [f"พนักงานตัวอย่างคนที่ {i + 1}" for i in range(len(raw))],
)
idx = None if pick.startswith("ค่ากลาง") else int(pick.split()[-1]) - 1
if idx is None:
    base = pd.Series({c: raw[c].median() if raw[c].dtype.kind in "if" else raw[c].mode()[0] for c in feature_cols})
else:
    base = raw.loc[idx]

row = {}
for section in dict.fromkeys(f[0] for f in FIELDS.values()):
    st.subheader(section)
    cols = st.columns(3)
    for i, c in enumerate([c for c in feature_cols if FIELDS[c][0] == section]):
        _, label, hint = FIELDS[c]
        with cols[i % 3]:
            key = f"{c}-{pick}"  # เปลี่ยนตัวอย่างแล้ว widget รีเซ็ตค่า
            if c in ORDINAL:
                opts = list(ORDINAL[c])
                row[c] = st.selectbox(label, opts, index=opts.index(int(base[c])), format_func=ORDINAL[c].get, key=key, help=hint or None)
            elif raw[c].dtype.kind in "if":
                row[c] = st.number_input(label, int(raw[c].min()), int(raw[c].max()), int(base[c]), key=key, help=hint or None)
            else:
                opts = sorted(raw[c].unique())
                row[c] = st.selectbox(label, opts, index=opts.index(base[c]), format_func=th, key=key, help=hint or None)

risk = predict(model, raw, row)
level, color = ("ต่ำ", "green") if risk < LOW else ("ปานกลาง", "orange") if risk < HIGH else ("สูง", "red")
st.divider()
st.subheader("ผลการประเมิน")
st.markdown(f"### ความเสี่ยงที่จะลาออก: :{color}[{level}]")
st.progress(min(risk, 1.0), text=f"คะแนนความเสี่ยง {risk * 100:.0f} / 100")
st.caption(
    "คะแนนนี้ใช้เปรียบเทียบว่าใครเสี่ยงมากกว่าใคร ไม่ใช่โอกาสลาออกจริง (เช่น 60 ไม่ได้แปลว่า 60% ลาออก) "
    f"เกณฑ์: ต่ำ < {LOW * 100:.0f} | ปานกลาง {LOW * 100:.0f}–{HIGH * 100:.0f} | สูง > {HIGH * 100:.0f} (ค่าประมาณ)"
)
if idx is not None:
    st.info(f"ข้อมูลจริงของพนักงานคนนี้: {'ลาออกแล้ว' if raw.loc[idx, TARGET_COLUMN] == 'Yes' else 'ยังทำงานอยู่'} (ถ้าแก้ค่าด้านบน ผลนี้ยังเป็นของข้อมูลเดิม)")
