"""เงินเดือน (บาท) -> หน่วยเงินเดือนที่โมเดลเรียนมา (MonthlyIncome ของ IBM) ด้วยการเทียบอันดับในบริษัท (DE-01)

ทำไมไม่ใช้อัตราแลกเปลี่ยน: เงินเดือน IBM เป็นระดับอเมริกา คูณ 35 แล้วพนักงานระดับกลางกลายเป็น 170,000 บาท
และเงินเดือนไทยจริงหาร 35 ต่ำกว่าคนที่ได้น้อยที่สุดใน IBM ทุกคน โมเดลจึงมองว่าทุกคนเงินเดือนต่ำสุดเท่ากันหมด
วิธีนี้: คนที่ได้เงินเดือนกลางๆ ของบริษัท (อันดับ 0.5) = เงินเดือนกลางๆ ของ IBM, อันดับ 0.8 = อันดับ 0.8 ของ IBM
โมเดลจึงเห็นว่าคนนี้ได้มากหรือน้อยเมื่อเทียบกับเพื่อนในบริษัท ส่วนเงินที่แสดง/คิดต้นทุนยังเป็นบาทจริงที่บริษัทกรอก

ข้อจำกัด: เทียบกับบริษัทตัวเอง บริษัทที่จ่ายต่ำกว่าตลาดทั้งบริษัทจะดูปกติ (ไม่มีข้อมูลตลาดไทยรายตำแหน่งให้เทียบ)
"""

import numpy as np

# บริษัทที่มีพนักงานน้อยกว่านี้ อันดับหยาบเกิน (มีคนเดียว = อันดับ 0.5 เสมอ) ใช้ตัวคูณคงที่แทน
MIN_COMPANY = 20
# บาทต่อ 1 หน่วยของ IBM เมื่อเทียบอันดับไม่ได้ + ใช้แปลงข้อมูล IBM (บริษัทเดโม/แถวตัวอย่าง) เป็นบาท
# เทียบค่ากลางต่อระดับตำแหน่งของ IBM กับช่วงเงินเดือนพนักงานออฟฟิศไทยโดยประมาณ (คู่มือเงินเดือนบริษัทจัดหางาน 2024–2025):
# ระดับ 1: 2,670 หน่วย ~ 20,000–30,000 บาท (~9), ระดับ 3: 9,980 ~ 60,000–80,000 (~7), ระดับ 5: 19,232 ~ 150,000–350,000 (~10)
THB_PER_UNIT = 8


def company_rank(thb, company_thb) -> np.ndarray:
    """อันดับ 0–1 ของเงินเดือนแต่ละค่าในบริษัท (mid-rank: เงินเดือนเท่าค่ากลางพอดี = 0.5, คนที่ได้เท่ากัน = อันดับเดียวกัน)
    ค่าระหว่างคนในบริษัทเทียบเส้นตรง ค่าที่สูง/ต่ำกว่าทุกคน (เช่น ขึ้นเงินเดือนคนที่ได้มากสุดใน What-if) ยังขยับได้ แต่ไม่ถึง 0/1"""
    xs, counts = np.unique(np.asarray(company_thb, dtype=float), return_counts=True)
    ranks = (np.cumsum(counts) - counts / 2) / counts.sum()
    x = np.atleast_1d(np.asarray(thb, dtype=float))
    out = np.interp(x, xs, ranks)
    low, high = x < xs[0], x > xs[-1]
    out[low] = ranks[0] * x[low] / xs[0]
    out[high] = 1 - (1 - ranks[-1]) * xs[-1] / x[high]
    return out


def to_model(thb, company_thb, reference_units) -> np.ndarray:
    """เงินเดือนบาท -> หน่วยของโมเดล company_thb = เงินเดือนบาทของพนักงานทั้งบริษัทที่ใช้เทียบ
    reference_units = MonthlyIncome ของ IBM (ข้อมูลที่โมเดลเรียน)"""
    company = np.asarray(company_thb, dtype=float)
    company = company[np.isfinite(company) & (company > 0)]
    thb = np.atleast_1d(np.asarray(thb, dtype=float))
    if len(company) < MIN_COMPANY:
        return np.round(thb / THB_PER_UNIT)
    return np.round(np.quantile(np.asarray(reference_units, dtype=float), company_rank(thb, company)))


if __name__ == "__main__":
    ref = np.arange(1000, 20001, 10)  # IBM สมมติ ค่ากลาง 10,500
    company = np.linspace(15_000, 150_000, 200)  # บริษัทไทยสมมติ ค่ากลาง 82,500
    assert abs(to_model([82_500], company, ref)[0] - 10_500) <= 10  # ค่ากลางบริษัท = ค่ากลาง IBM
    assert to_model([20_000], company, ref)[0] < to_model([40_000], company, ref)[0]  # เงินมากกว่า = หน่วยมากกว่า
    top = to_model([150_000, 165_000, 300_000], company, ref)
    assert top[0] < top[1] < top[2] <= 20_000  # ขึ้นเงินเดือนคนที่ได้มากสุดยังขยับ แต่ไม่เกินช่วงของ IBM
    assert to_model([30_000], company[:10], ref)[0] == 30_000 / THB_PER_UNIT  # คนน้อย = ตัวคูณคงที่
    same = to_model(ref * THB_PER_UNIT, ref * THB_PER_UNIT, ref)  # ข้อมูล IBM ที่แปลงเป็นบาทแล้ว กลับมาเกือบค่าเดิม
    assert np.abs(same - ref).max() <= 10
    print("ok")
