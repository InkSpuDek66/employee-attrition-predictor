"""โค้ดที่หน้าเทสทั้งสองหน้าใช้ร่วมกัน: โหลดโมเดล/ข้อมูล, ชื่อภาษาไทย, และส่วนอธิบายด้วย SHAP"""

import os
import sys

import numpy as np
import pandas as pd
import streamlit as st
from sklearn.metrics import average_precision_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(os.path.join(ROOT, "backend"))
import model_store as ms  # noqa: E402  (เพิ่ม src/ เข้า sys.path ให้ด้วย)
import business_rules as br  # noqa: E402
import company_summary as cs  # noqa: E402
from clean_pipeline import NOISE_COLUMNS, TARGET_COLUMN  # noqa: E402, F401  (NOISE_COLUMNS ส่งต่อให้ model_page)


@st.cache_resource
def load():
    return ms.model(), ms.explainer(), ms.raw_employees()


@st.cache_data
def performance() -> dict:
    """วัดผลบน test 294 คน (split 80/20 seed 42 ชุดเดียวกับตอนเทรนใน notebook 04) ที่โมเดลไม่เคยเห็น"""
    X, y = ms.employee_features(), (ms.raw_employees()[TARGET_COLUMN] == "Yes").astype(int).to_numpy()
    _, test = train_test_split(np.arange(len(y)), test_size=0.2, stratify=y, random_state=42)
    p, yt = ms.risk_scores(X.iloc[test]), y[test]
    flagged = p >= br.HIGH_RISK
    top20 = np.argsort(-p)[: int(len(p) * 0.2)]
    return {
        "n": len(yt), "leavers": int(yt.sum()),
        "auc": roc_auc_score(yt, p), "pr_auc": average_precision_score(yt, p),
        "accuracy": float((flagged == yt).mean()), "baseline_accuracy": float(1 - yt.mean()),
        "caught": int((flagged & (yt == 1)).sum()), "false_alarm": int((flagged & (yt == 0)).sum()),
        "f1": f1_score(yt, flagged), "top20_recall": float(yt[top20].sum() / yt.sum()),
    }


def predict(row: dict):
    """คืน (risk_score, SHAP explanation ของแถวนี้)"""
    X = ms.to_features(pd.DataFrame([row]))
    return float(ms.risk_scores(X)[0]), ms.explainer()(X)


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

BAND_COLOR = {"Low": "green", "Medium": "orange", "High": "red"}

# ฟีเจอร์ที่สร้างเพิ่ม (src/feature_pipeline.py) ไม่มีช่องกรอก แต่โผล่ในรายการปัจจัยได้
FIELDS_EXTRA = {"AvgSatisfaction": "ความพึงพอใจเฉลี่ย", "OverTimeXDistance": "OT × ระยะทางจากบ้าน", "TenureRatio": "สัดส่วนอายุงานที่บริษัทนี้"}


def th(v):
    return VALUE_TH.get(v, v)


def factor_text(f: str, v: float, row: dict, thb_per_usd: float = None) -> tuple:
    """(ชื่อปัจจัย, ค่าของพนักงานคนนี้ที่คนอ่านเข้าใจ) จากชื่อคอลัมน์หลัง encode และค่าของมัน

    thb_per_usd: ถ้าระบุ แสดงรายได้ต่อเดือนเป็นบาท (ถือว่า dataset เป็นดอลลาร์)
    """
    if f == "MonthlyIncome" and thb_per_usd:
        return FIELDS[f][1], f"{v * thb_per_usd:,.0f} บาท"
    group = cs.feature_group(f)
    if group != f:  # one-hot เช่น JobRole_Sales Executive -> "ตำแหน่งงาน: ผู้บริหารฝ่ายขาย"
        category = th(f.split("_", 1)[1])
        return (f"{FIELDS[group][1]}: {category}" if v else f"{FIELDS[group][1]}ไม่ใช่ {category}"), ""
    if f in FIELDS_EXTRA:
        return FIELDS_EXTRA[f], (f"{v:.0%}" if f == "TenureRatio" else f"{v:.2f}".rstrip("0").rstrip("."))
    if f in ORDINAL:
        return FIELDS[f][1], ORDINAL[f][int(v)]
    if isinstance(row.get(f), str):  # OverTime, Gender, BusinessTravel ที่ถูก encode เป็นตัวเลข
        return FIELDS[f][1], th(row[f])
    return FIELDS[f][1], f"{v:,.0f}"


def explain(exp, row: dict, band: str, thb_per_usd: float = None) -> None:
    """ส่วน "ทำไมโมเดลถึงประเมินคนนี้แบบนี้" จาก SHAP ของพนักงาน 1 คน"""
    names, values, data = exp.feature_names, exp.values[0], exp.data[0]
    up = [j for j in values.argsort()[::-1] if values[j] > 0][:4]
    down = [j for j in values.argsort() if values[j] < 0][:3]

    st.markdown("#### ทำไมโมเดลถึงประเมินคนนี้แบบนี้")
    if up:
        reasons = [factor_text(names[j], data[j], row, thb_per_usd) for j in up[:3]]
        st.markdown(
            ("สัญญาณที่ทำให้โมเดลมองว่าคนนี้**มีความเสี่ยง**มากที่สุดคือ " if band != "Low"
             else "ความเสี่ยงโดยรวม**ต่ำ** แต่สัญญาณที่ดันความเสี่ยงขึ้นมากที่สุดคือ ")
            + ", ".join(f"**{n}**" + (f" ({v})" if v else "") for n, v in reasons)
        )
    up_col, down_col = st.columns(2)
    with up_col:
        st.markdown(":red[**ดันให้เสี่ยงลาออก**]")
        for j in up:
            name, val = factor_text(names[j], data[j], row, thb_per_usd)
            rec = cs.RECOMMENDATIONS.get(cs.feature_group(names[j]))
            st.markdown(f"- **{name}**" + (f": {val}" if val else ""))
            st.caption(f"แนวทาง: {rec}" if rec else "ข้อมูลส่วนตัว/ประวัติ บริษัทปรับไม่ได้ ใช้ประกอบความเข้าใจเท่านั้น")
        if not up:
            st.markdown("- ไม่มีปัจจัยที่ดันให้เสี่ยงเด่นชัด")
    with down_col:
        st.markdown(":blue[**ช่วยให้อยู่ต่อ**]")
        for j in down:
            name, val = factor_text(names[j], data[j], row, thb_per_usd)
            st.markdown(f"- **{name}**" + (f": {val}" if val else ""))
    st.caption(
        "นี่คือสิ่งที่โมเดลให้น้ำหนัก (SHAP) ไม่ใช่สาเหตุที่พิสูจน์แล้ว สาเหตุจริงอาจอยู่นอกข้อมูล เช่น ได้ข้อเสนองานใหม่ "
        "หรือปัญหากับหัวหน้า ใช้เป็นหัวข้อเริ่มคุยกับพนักงาน แล้วยืนยันจากการพูดคุย"
    )
