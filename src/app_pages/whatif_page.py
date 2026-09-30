"""หน้า "What-if Simulator": เลือกพนักงาน ปรับเฉพาะค่าที่บริษัทเปลี่ยนได้ แล้วเทียบความเสี่ยงก่อน/หลัง

คำนวณผ่านฟังก์ชันเดียวกับ POST /whatif ของ backend (routers/whatif.py) ผลจึงตรงกับ API
ข้อมูลจำลองอยู่ที่ data/sample/whatif_employees.csv (สร้างด้วย src/make_whatif_samples.py)

เงิน: ถือว่า MonthlyIncome ใน IBM dataset เป็นดอลลาร์ หน้านี้รับ/แสดงเป็นบาท แล้วหารด้วยอัตราแลกเปลี่ยนก่อนส่งเข้าโมเดล
ponytail: แปลงด้วยอัตราคงที่ตัวเดียว เงินเดือนไทยส่วนใหญ่จะต่ำกว่าช่วงที่โมเดลเคยเห็น ถ้าผลเพี้ยนให้เปลี่ยนเป็น
quantile mapping (เทียบอันดับเงินเดือนในบริษัท) ใน backend/model_store.to_features
"""

import os

import pandas as pd
import streamlit as st
from fastapi import HTTPException

from app_pages.common import BAND_COLOR, ORDINAL, ROOT, br, explain, load, predict, th
from routers.predict import score
from routers.whatif import NOTE, WhatIfRequest, whatif
from schemas import EmployeeInput

SAMPLES = os.path.join(ROOT, "data", "sample", "whatif_employees.csv")
META = ["sample_id", "description", "try"]

# ค่าที่บริษัทปรับได้ผ่านมาตรการ ชุดเดียวกับ frontend/src/WhatIfSimulator.jsx
# ไม่ให้ปรับข้อมูลส่วนตัว (อายุ เพศ สถานภาพ) เพราะบริษัทเปลี่ยนไม่ได้ และเสี่ยงถูกใช้เลือกปฏิบัติ
CONTROLS = {
    "MonthlyIncome": ("รายได้ต่อเดือน", "slider", None),  # ช่วงคำนวณจากอัตราแลกเปลี่ยนด้านล่าง
    "PercentSalaryHike": ("เงินเดือนขึ้นล่าสุด (%)", "slider", (0, 30, 1)),
    "OverTime": ("ทำงานล่วงเวลา (OT)", "select", ["No", "Yes"]),
    "BusinessTravel": ("การเดินทางไปทำงาน", "select", ["Non-Travel", "Travel_Rarely", "Travel_Frequently"]),
    "DistanceFromHome": ("ระยะทางจากบ้าน (กม.)", "slider", (1, 30, 1)),
    "JobLevel": ("ระดับตำแหน่ง", "select", [1, 2, 3, 4, 5]),
    "YearsSinceLastPromotion": ("ตั้งแต่เลื่อนตำแหน่งล่าสุด (ปี)", "slider", (0, 15, 1)),
    "TrainingTimesLastYear": ("อบรมปีที่ผ่านมา (ครั้ง)", "slider", (0, 6, 1)),
    "StockOptionLevel": ("สิทธิ์ซื้อหุ้นพนักงาน", "select", [0, 1, 2, 3]),
    "WorkLifeBalance": ("สมดุลงาน-ชีวิต", "select", [1, 2, 3, 4]),
    "JobSatisfaction": ("พอใจในงาน", "select", [1, 2, 3, 4]),
    "EnvironmentSatisfaction": ("พอใจสภาพแวดล้อม", "select", [1, 2, 3, 4]),
    "RelationshipSatisfaction": ("พอใจเพื่อนร่วมงาน", "select", [1, 2, 3, 4]),
    "JobInvolvement": ("ความทุ่มเท", "select", [1, 2, 3, 4]),
}


def shown(field, v) -> str:
    """ค่าที่คนอ่านเข้าใจ (MonthlyIncome รับค่าเป็นดอลลาร์ แสดงเป็นบาท)"""
    if field == "MonthlyIncome":
        return f"{v * rate:,.0f} บาท"
    if field in ORDINAL:
        return ORDINAL[field][int(v)]
    if field == "OverTime":
        return "ทำ" if v == "Yes" else "ไม่ทำ"
    return th(v) if isinstance(v, str) else f"{v:,}"


@st.cache_data
def samples() -> pd.DataFrame:
    return pd.read_csv(SAMPLES)


def key(field: str) -> str:
    # เปลี่ยนอัตราแลกเปลี่ยนแล้ว slider เงินเดือนเริ่มใหม่จากค่าเดิมของพนักงาน
    return f"wi-{st.session_state.who}-{field}" + (f"-{st.session_state.rate}" if field == "MonthlyIncome" else "")


def set_values(values: dict) -> None:
    for f, v in values.items():
        st.session_state[key(f)] = v


st.title("What-if Simulator")
st.caption("ลองว่า \"ถ้าบริษัทเปลี่ยนเงื่อนไขนี้ ความเสี่ยงของพนักงานคนนี้จะเปลี่ยนไปเท่าไร\" — ตัวทดลอง ไม่บันทึกอะไรลงระบบ")
raw = load()[2]
sim = samples()

rate = st.number_input(
    "อัตราแลกเปลี่ยน (บาท ต่อ 1 ดอลลาร์)", min_value=20.0, max_value=50.0, value=35.0, step=0.5, key="rate",
    help="ถือว่าเงินใน IBM dataset เป็นดอลลาร์ ปรับให้ตรงกับอัตราปัจจุบันได้",
)
ibm_min, ibm_max = int(raw["MonthlyIncome"].min()), int(raw["MonthlyIncome"].max())

source = st.radio("เลือกพนักงานจาก", ["ข้อมูลจำลองสำหรับทดสอบ", "พนักงานใน dataset"], horizontal=True)
if source == "ข้อมูลจำลองสำหรับทดสอบ":
    sid = st.selectbox(
        "พนักงานจำลอง (คนสมมติ ไม่ใช่ข้อมูลจริง)", sim["sample_id"],
        format_func=lambda s: f"{s} · {sim.set_index('sample_id').loc[s, 'description']}",
    )
    person = sim.set_index("sample_id").loc[sid]
    base = EmployeeInput(**person.drop(["description", "try"]).to_dict()).model_dump()
    ref = {"employee": base}
    st.info(f"💡 มาตรการที่น่าลอง: {person['try']}")
    who = sid
else:
    emp_id = st.number_input("รหัสพนักงาน (EmployeeNumber)", min_value=1, value=1, step=1)
    try:
        base = whatif(WhatIfRequest(employee_id=int(emp_id))).employee
    except HTTPException as e:
        st.error(e.detail)
        st.stop()
    ref = {"employee_id": int(emp_id)}
    who = f"emp{emp_id}"
st.session_state.who = who

with st.expander("ข้อมูลพนักงานคนนี้"):
    facts = {
        "อายุ": base["Age"], "แผนก": th(base["Department"]), "ตำแหน่ง": th(base["JobRole"]),
        "อายุงานรวม (ปี)": base["TotalWorkingYears"], "อยู่บริษัทนี้ (ปี)": base["YearsAtCompany"],
        "จำนวนบริษัทที่เคยทำ": base["NumCompaniesWorked"], "สถานภาพ": th(base["MaritalStatus"]),
        "รายได้ต่อเดือน": shown("MonthlyIncome", base["MonthlyIncome"]),
    }
    st.write(" · ".join(f"**{k}** {v}" for k, v in facts.items()))

# ค่าที่แสดงในฟอร์ม: เหมือน base ยกเว้นเงินเดือนเป็นบาท (ปัดหลักร้อย)
view = {**base, "MonthlyIncome": round(base["MonthlyIncome"] * rate / 100) * 100}

# ปุ่มมาตรการสำเร็จรูป: ตั้งค่าใน session_state ก่อน widget ถูกสร้าง (ผ่าน on_click)
st.markdown("**มาตรการสำเร็จรูป**")
presets = {
    "ปิด OT": {"OverTime": "No"},
    "ขึ้นเงินเดือน 10%": {"MonthlyIncome": round(view["MonthlyIncome"] * 1.1 / 100) * 100},
    "เลื่อนตำแหน่ง": {"JobLevel": min(5, base["JobLevel"] + 1), "YearsSinceLastPromotion": 0},
    "ไม่ต้องเดินทาง": {"BusinessTravel": "Non-Travel"},
    "ให้สิทธิ์ซื้อหุ้น": {"StockOptionLevel": max(1, base["StockOptionLevel"])},
}
cols = st.columns(len(presets) + 1)
for col, (name, change) in zip(cols, presets.items()):
    col.button(name, on_click=set_values, args=(change,), width="stretch")
cols[-1].button("คืนค่าเดิม", on_click=set_values, args=({f: view[f] for f in CONTROLS},), width="stretch", type="secondary")

left, right = st.columns([3, 2], gap="large")
changes = {}
with left:
    st.markdown("**ปรับเงื่อนไข** (ค่าเริ่มต้น = ข้อมูลปัจจุบันของพนักงาน)")
    grid = st.columns(2)
    for i, (f, (label, kind, opts)) in enumerate(CONTROLS.items()):
        st.session_state.setdefault(key(f), view[f])
        with grid[i % 2]:
            if f == "MonthlyIncome":
                hi = max(round(ibm_max * rate, -3), view[f])
                value = st.slider(label, 5000, int(hi), step=500, key=key(f))
            elif kind == "slider":
                lo, hi, step = opts
                lo, hi = min(lo, view[f]), max(hi, view[f])  # ค่าเดิมอาจอยู่นอกช่วงของ slider
                value = st.slider(label, lo, hi, step=step, key=key(f))
            else:
                value = st.selectbox(label, opts, format_func=lambda v, f=f: shown(f, v), key=key(f))
        if value != view[f]:
            changes[f] = max(1, round(value / rate)) if f == "MonthlyIncome" else value

result = whatif(WhatIfRequest(**ref, changes=changes))
before, after = result.before, result.after
risk_after, exp_after = predict(result.employee)
cost = br.estimate(pd.DataFrame([base, result.employee]), [before.risk_score, after.risk_score]).expected_loss

with right:
    st.markdown("**ผลการจำลอง**")
    c1, c2 = st.columns(2)
    c1.metric("ก่อน", f"{before.risk_score * 100:.0f} / 100")
    c1.markdown(f":{BAND_COLOR[before.risk_band]}[**{before.risk_band_th}**]")
    c2.metric("หลังปรับ", f"{after.risk_score * 100:.0f} / 100", f"{result.delta * 100:+.0f}", delta_color="inverse")
    c2.markdown(f":{BAND_COLOR[after.risk_band]}[**{after.risk_band_th}**]")
    if result.changes_applied:
        st.markdown("**สิ่งที่เปลี่ยน**")
        for f, v in result.changes_applied.items():
            after_text = f"{st.session_state[key(f)]:,} บาท" if f == "MonthlyIncome" else shown(f, v)
            st.markdown(f"- {CONTROLS[f][0]}: {shown(f, base[f])} → **{after_text}**")
        st.markdown(
            f"มูลค่าความเสี่ยง (คะแนน × ต้นทุนหาคนแทน): {cost[0] * rate:,.0f} → **{cost[1] * rate:,.0f} บาท**"
        )
        st.caption(
            f"ใช้เทียบว่ามาตรการไหนคุ้มกว่า ไม่ใช่ยอดเงินที่จะเสียจริง แปลงจากดอลลาร์ที่ {rate:g} บาท/ดอลลาร์"
        )
    else:
        st.caption("ยังไม่ได้ปรับอะไร ลองกดมาตรการสำเร็จรูปด้านบน หรือปรับค่าทางซ้าย")
    income_usd = result.employee["MonthlyIncome"]
    if not ibm_min <= income_usd <= ibm_max:
        st.warning(
            f"เงินเดือน {st.session_state[key('MonthlyIncome')]:,} บาท อยู่นอกช่วงที่โมเดลเคยเห็น "
            f"({ibm_min * rate:,.0f}–{ibm_max * rate:,.0f} บาท) โมเดลจะมองเท่ากับคนที่รายได้"
            f"{'ต่ำ' if income_usd < ibm_min else 'สูง'}ที่สุดใน dataset ผลจึงอาจไม่สะท้อนความจริง"
        )
    if result.warning:
        st.warning(result.warning)
    st.caption(NOTE)

st.divider()
explain(exp_after, result.employee, after.risk_band, thb_per_usd=rate)

with st.expander("ภาพรวมข้อมูลจำลองทั้ง 10 คน (ยังไม่ปรับอะไร)"):
    people = [EmployeeInput(**r.drop(META).to_dict()).model_dump() for _, r in sim.iterrows()]
    scores = score(people, None)
    st.dataframe(
        pd.DataFrame({
            "รหัส": sim["sample_id"], "ลักษณะ": sim["description"],
            "คะแนน": [round(s.risk_score * 100) for s in scores], "ระดับ": [s.risk_band_th for s in scores],
            "น่าลอง": sim["try"],
        }),
        hide_index=True, width="stretch",
    )
