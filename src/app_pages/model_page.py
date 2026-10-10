"""หน้า "ทดสอบโมเดล": กรอกข้อมูลพนักงานทุกช่องแล้วดูระดับความเสี่ยง เหตุผล (SHAP) และต้นทุน"""

import pandas as pd
import streamlit as st

from app_pages.common import (
    BAND_COLOR, FIELDS, NOISE_COLUMNS, ORDINAL, TARGET_COLUMN, br, explain, load, performance, predict, th,
)

st.title("ทดสอบโมเดลทำนายการลาออกของพนักงาน")
st.caption("ตัวทดลอง ยังไม่ใช่ผลสุดท้ายของทีม — ใช้ดูว่าโมเดลตอบสนองต่อข้อมูลอย่างไร ไม่ควรใช้ตัดสินใจเรื่องคนจริง")
raw = load()[2]

perf = performance()
with st.sidebar:
    st.header("ความแม่นยำของโมเดล")
    st.caption(f"วัดบนพนักงาน {perf['n']} คนที่โมเดลไม่เคยเห็นตอนเทรน (ลาออกจริง {perf['leavers']} คน)")
    st.metric("จัดลำดับความเสี่ยงถูก (AUC)", f"{perf['auc'] * 100:.0f} จาก 100 คู่")
    st.caption("สุ่มคนลาออก 1 คนกับคนที่อยู่ 1 คน โมเดลให้คะแนนคนลาออกสูงกว่ากี่ครั้งใน 100 (เดาสุ่ม = 50)")
    st.metric("ดูแลคนเสี่ยงสุด 20% ครอบคลุมคนที่ลาออก", f"{perf['top20_recall']:.0%}")
    st.caption("ถ้าสุ่มดูแล 20% จะครอบคลุมแค่ประมาณ 20%")
    st.metric(f"ระดับ 'สูง' (≥ {br.HIGH_RISK * 100:.0f}) จับได้", f"{perf['caught']} / {perf['leavers']} คน")
    st.caption(f"เตือนผิด {perf['false_alarm']} คน (ถูกจัดว่าสูงแต่ยังทำงานอยู่)")
    st.metric("ทายถูกทั้งหมด (accuracy)", f"{perf['accuracy']:.0%}")
    st.caption(
        f"ระวัง: แค่ทายว่า 'ไม่มีใครลาออก' ก็ได้ {perf['baseline_accuracy']:.0%} แล้ว ตัวเลขนี้จึงดูดีเกินจริง "
        f"ดู PR-AUC {perf['pr_auc']:.2f} (สุ่ม ≈ 0.16) และ F1 {perf['f1']:.2f} ประกอบ"
    )

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

risk, exp = predict(row)
band = br.risk_band(risk)
st.divider()
st.subheader("ผลการประเมิน")
st.markdown(f"### ความเสี่ยงที่จะลาออก: :{BAND_COLOR[band]}[{br.RISK_BANDS[band]}]")
st.progress(min(risk, 1.0), text=f"คะแนนความเสี่ยง {risk * 100:.0f} / 100")
st.caption(
    "คะแนนนี้ใช้เปรียบเทียบว่าใครเสี่ยงมากกว่าใคร ไม่ใช่โอกาสลาออกจริง (เช่น 60 ไม่ได้แปลว่า 60% ลาออก) "
    f"เกณฑ์ของทีม (README 6.1): ต่ำ < {br.MEDIUM_RISK * 100:.0f} | ปานกลาง {br.MEDIUM_RISK * 100:.0f}–{br.HIGH_RISK * 100:.0f} | สูง ≥ {br.HIGH_RISK * 100:.0f}"
)
if idx is not None:
    st.info(f"ข้อมูลจริงของพนักงานคนนี้: {'ลาออกแล้ว' if raw.loc[idx, TARGET_COLUMN] == 'Yes' else 'ยังทำงานอยู่'} (ถ้าแก้ค่าด้านบน ผลนี้ยังเป็นของข้อมูลเดิม)")

st.divider()
explain(exp, row, band)

st.divider()
st.markdown("#### ต้นทุน: รักษาไว้ vs หาคนแทน")
options = br.retention_options()
retention = st.selectbox("มาตรการรักษาคน", list(options), format_func=lambda k: options[k]["label"])
cost = br.estimate(pd.DataFrame([row]), [risk], retention=retention).iloc[0]
st.markdown(
    f"- ต้นทุนหาคนแทน: **{cost.replacement_cost:,.0f}**\n"
    f"- ต้นทุนมาตรการรักษาคน: **{cost.retain_cost:,.0f}**\n"
    f"- ถ้ารักษาไว้ได้ ประหยัด: **{cost.net_benefit_if_retained:,.0f}**"
)
st.caption(br.config()["currency_note"])

