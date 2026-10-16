"""test การแปลงเงินเดือนบาท -> หน่วยของโมเดลด้วยการเทียบอันดับในบริษัท (src/income_scale.py, DE-01)

รัน: python -m pytest backend/test_income_scale.py
"""

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

import income_scale  # noqa: E402  (src/ อยู่ใน sys.path หลัง import model_store)
import model_store as ms
from main import app

client = TestClient(app)
REF = ms.reference_income()
COMPANY = np.linspace(15_000, 150_000, 200)  # บริษัทไทยสมมติ


def test_more_pay_means_more_model_income_and_stays_in_ibm_range():
    thb = np.array([1_000, 15_000, 40_000, 82_500, 150_000, 200_000, 400_000])
    units = income_scale.to_model(thb, COMPANY, REF)
    assert (np.diff(units) > 0).all()  # เพิ่มตามเงินเดือนตลอด รวมเกินคนที่ได้มากสุดในบริษัท (ขึ้นเงินเดือนใน What-if)
    assert REF.min() <= units.min() and units.max() <= REF.max()


def test_company_median_maps_to_ibm_median():
    (units,) = income_scale.to_model([np.median(COMPANY)], COMPANY, REF)
    assert abs(units - np.median(REF)) / np.median(REF) < 0.02


def test_small_company_uses_fixed_factor():
    small = COMPANY[: income_scale.MIN_COMPANY - 1]
    assert income_scale.to_model([40_000], small, REF)[0] == round(40_000 / income_scale.THB_PER_UNIT)


def test_ibm_converted_to_baht_scores_like_before():
    """บริษัทเดโม IBM เก็บเงินเดือนเป็นบาท (× THB_PER_UNIT) แปลงกลับแล้วได้เกือบค่าเดิม คะแนนจึงไม่เปลี่ยน"""
    back = income_scale.to_model(REF * income_scale.THB_PER_UNIT, REF * income_scale.THB_PER_UNIT, REF)
    assert np.abs(back - REF).mean() < 10


def test_rank_is_within_own_company_only():
    """คนเงินเดือนเท่ากันในบริษัทที่จ่ายต่างกันได้อันดับต่างกัน = ไม่ได้เทียบข้ามบริษัท"""
    low_payer, high_payer = COMPANY * 0.5, COMPANY * 2
    a = income_scale.to_model([60_000], low_payer, REF)[0]
    b = income_scale.to_model([60_000], high_payer, REF)[0]
    assert a > b


def test_whatif_raise_moves_model_input():
    raw = ms.raw_employees().head(1)
    company = ms.company_income(ms.db.DEMO_TENANT)
    raised = raw.assign(**{ms.INCOME: raw[ms.INCOME] * 1.5})
    before, after = (ms.to_features(r, company)[ms.INCOME].iloc[0] for r in (raw, raised))
    assert after > before


def test_salary_raise_never_raises_risk():
    """โมเดล v3 (src/train.py MONOTONE): ขึ้นเงินเดือนแล้วความเสี่ยงต้องไม่เพิ่ม ทุกคนในบริษัทเดโม
    (v2 เพิ่มได้ HR เห็นใน What-if ว่า "ขึ้นเงินเดือนแล้วเสี่ยงขึ้น" ถ้า test นี้ fail ให้เช็ก MODEL_URI ใน .env)"""
    raw = ms.raw_employees().sample(200, random_state=0)
    company = ms.company_income(ms.db.DEMO_TENANT)
    scores = [ms.risk_scores(ms.to_features(raw.assign(**{ms.INCOME: (raw[ms.INCOME] * k).astype(int)}), company)) for k in (1, 1.1, 1.3, 2)]
    assert (np.diff(np.stack(scores), axis=0) <= 1e-9).all()


def test_shap_shows_salary_in_baht_not_model_units():
    record = ms.employee_record(1)
    salary = next(c for c in client.get("/shap/1?top_n=100").json()["contributions"] if c["feature"] == ms.INCOME)
    assert salary["value"] == record[ms.INCOME]
    reasons = client.get("/company-summary/top-employees?n=50&reasons=true").json()["employees"]
    shown = {e["employee_id"]: r["value"] for e in reasons for r in e["reasons"] if r["feature"] == ms.INCOME}
    raw = ms.raw_employees().set_index("EmployeeNumber")[ms.INCOME]
    assert all(v == raw[i] for i, v in shown.items())


def test_demo_company_salaries_are_baht():
    """บริษัทเดโมที่อ่านจาก CSV (test ปิด DB ใน conftest) ต้องได้เงินเดือนบาท ค่ากลางของ IBM ที่ยังไม่แปลง = 4,919
    ฝั่ง DB: src/db.py เก็บเป็นบาทแบบเดียวกัน (DB เก่าก่อน DE-01 ต้องรัน python src/db.py ใหม่)"""
    assert pd.Series(ms.company_income(ms.db.DEMO_TENANT)).median() > 20_000
