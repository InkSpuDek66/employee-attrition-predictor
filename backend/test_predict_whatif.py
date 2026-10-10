"""test ของ /predict, /whatif, /financial-impact, /company-summary/departments (งานของ Saphondanai)

รัน: python -m pytest backend  (ต้องมีโมเดลตาม MODEL_URI ใน .env เช่นจาก notebooks/04_tuning_S.ipynb)
"""

import pytest
from fastapi.testclient import TestClient

import business_rules  # noqa: E402  (src/ อยู่ใน sys.path หลัง import model_store)
import calibration
import model_store as ms
from main import app

client = TestClient(app)


def test_predict_by_id_and_by_features_agree():
    by_id = client.post("/predict", json={"employee_id": 1}).json()
    assert 0 <= by_id["risk_score"] <= 1 and by_id["risk_band"] in ("High", "Medium", "Low") and by_id["warning"]
    by_features = client.post("/predict", json={"employee": ms.employee_record(1)}).json()
    assert by_features["risk_score"] == pytest.approx(by_id["risk_score"])
    assert by_features["employee_id"] is None


def test_predict_rejects_bad_input():
    assert client.post("/predict", json={}).status_code == 422
    assert client.post("/predict", json={"employee_id": 1, "employee": ms.employee_record(1)}).status_code == 422
    assert client.post("/predict", json={"employee_id": 999999}).status_code == 404
    bad = dict(ms.employee_record(1), OverTime="Maybe")
    assert client.post("/predict", json={"employee": bad}).status_code == 422
    assert client.post("/predict", json={"employee_id": 1, "tenant_id": "../x"}).status_code == 422


def test_whatif_no_changes_equals_predict():
    r = client.post("/whatif", json={"employee_id": 1}).json()
    assert r["delta"] == 0 and r["changes_applied"] == {}
    assert r["before"]["risk_score"] == pytest.approx(client.post("/predict", json={"employee_id": 1}).json()["risk_score"])


def test_whatif_changes_move_score():
    # พนักงาน 1 ทำ OT และ WorkLifeBalance แย่ -> เลิก OT + สมดุลดีขึ้น ความเสี่ยงควรลดลง
    changes = {"OverTime": "No", "WorkLifeBalance": 4}
    r = client.post("/whatif", json={"employee_id": 1, "changes": changes}).json()
    assert r["changes_applied"] == changes and r["employee"]["OverTime"] == "No"
    assert r["delta"] < 0 and r["after"]["risk_score"] < r["before"]["risk_score"]


def test_whatif_rejects_bad_changes():
    assert client.post("/whatif", json={"employee_id": 1, "changes": {"Salary": 1}}).status_code == 422
    assert client.post("/whatif", json={"employee_id": 1, "changes": {"WorkLifeBalance": 9}}).status_code == 422


def test_whatif_rejects_impossible_combinations():
    """UX-04: พนักงาน #1 อยู่บริษัท 6 ปี เลื่อนแถบไปว่าไม่ได้เลื่อนตำแหน่ง 15 ปี ต้องไม่ได้คะแนนกลับมา"""
    r = client.post("/whatif", json={"employee_id": 1, "changes": {"YearsSinceLastPromotion": 15}})
    assert r.status_code == 422 and "YearsSinceLastPromotion: ต้องไม่เกิน 6 ปี" in r.json()["detail"]
    for bad in ({"DistanceFromHome": 5000, "OfficeDaysPerWeek": 0}, {"Age": 18}, {"MonthlyIncome": 1_000_000}):
        assert client.post("/whatif", json={"employee_id": 1, "changes": bad}).status_code == 422, bad


def test_calibrated_band_used(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "STORE", str(tmp_path))
    records = ms.raw_employees().sample(300, random_state=0).to_dict("records")
    assert client.post("/recalibrate", json={"tenant_id": "co", "method": "platt", "records": records}).status_code == 200
    r = client.post("/whatif", json={"employee_id": 1, "tenant_id": "co", "changes": {"OverTime": "No"}}).json()
    assert r["warning"] is None and r["before"]["calibrated_risk_score"] is not None
    assert r["delta"] == pytest.approx(r["after"]["calibrated_risk_score"] - r["before"]["calibrated_risk_score"])


def test_calibration_comes_from_token_not_request(tmp_path, monkeypatch):
    """DE-11 ข้อ 1: ไม่ส่ง tenant_id ก็ได้คะแนนปรับเทียบของบริษัทผู้ login ตรงกับ /shap ทุก endpoint"""
    monkeypatch.setattr(calibration, "STORE", str(tmp_path))
    records = ms.raw_employees().sample(300, random_state=0).to_dict("records")
    assert client.post("/recalibrate", json={"records": records}).json()["method"] == "platt"  # DE-12: ค่าเริ่มต้นของ API
    shown = client.get("/shap/19").json()["calibrated_risk_score"]
    assert shown is not None
    assert client.post("/whatif", json={"employee_id": 19}).json()["before"]["calibrated_risk_score"] == pytest.approx(shown)
    assert client.post("/predict", json={"employee_id": 19}).json()["calibrated_risk_score"] == pytest.approx(shown)
    impact = client.get("/financial-impact/19").json()
    assert impact["warning"] is None and impact["score"]["calibrated_risk_score"] == pytest.approx(shown)


def test_calibration_tied_to_model_version(tmp_path, monkeypatch):
    """DE-12: เปลี่ยนโมเดลแล้วค่าปรับเทียบเดิมต้องไม่ถูกใช้ต่อ และ isotonic กับ 300 แถวไม่ให้ใครได้ 100 เต็ม"""
    monkeypatch.setattr(calibration, "STORE", str(tmp_path))
    records = ms.raw_employees().sample(300, random_state=0).to_dict("records")
    assert client.post("/recalibrate", json={"method": "isotonic", "records": records}).status_code == 200
    top = client.get("/company-summary/top-employees", params={"n": 100}).json()["employees"]
    assert max(e["calibrated_risk_score"] for e in top) <= calibration.SCORE_CEIL
    monkeypatch.setattr(ms, "MODEL_VERSION", "attrition-xgboost-P/999")
    r = client.get("/shap/1").json()
    assert r["calibrated_risk_score"] is None and r["warning"]


def test_company_summary_uses_calibrated_scores(tmp_path, monkeypatch):
    """DE-11 ข้อ 2: หลังปรับเทียบ จำนวนเสี่ยงสูงบนการ์ด = จำนวนคนที่ risk_band เป็น High ด้วยคะแนนชุดเดียวกัน"""
    monkeypatch.setattr(calibration, "STORE", str(tmp_path))
    before = client.get("/company-summary").json()
    assert before["warning"] and before["data_note"] is None  # บริษัท "co" ไม่ใช่ข้อมูลตัวอย่าง IBM
    records = ms.raw_employees().sample(300, random_state=0).to_dict("records")
    assert client.post("/recalibrate", json={"records": records}).status_code == 200
    X = ms.employee_features()
    shown = calibration.apply(calibration.load("co"), ms.risk_scores(X))
    after = client.get("/company-summary").json()
    assert after["warning"] is None
    assert after["risk_bands"]["High"] == int((shown >= business_rules.HIGH_RISK).sum()) != before["risk_bands"]["High"]
    assert after["mean_risk_score"] == pytest.approx(float(shown.mean()))
    depts = client.get("/company-summary/departments").json()["departments"]
    assert sum(d["risk_bands"]["High"] for d in depts) == after["risk_bands"]["High"]


def test_financial_impact():
    r = client.get("/financial-impact/1").json()
    assert r["replacement_cost"] == pytest.approx(r["hiring_cost"])  # ค่าเริ่มต้นไม่รวมค่าชดเชย
    assert r["expected_benefit"] is None and r["risk_after"] is None  # ยังไม่ได้ลองมาตรการ
    score = r["score"]["risk_score"]
    tried = client.get("/financial-impact/1", params={"risk_after": 0.1}).json()
    assert tried["expected_loss_after"] == pytest.approx(0.1 * r["replacement_cost"])
    assert tried["expected_benefit"] == pytest.approx((score - 0.1) * r["replacement_cost"] - r["retain_cost"])
    assert client.get("/financial-impact/1", params={"risk_after": 1.5}).status_code == 422
    with_severance = client.get("/financial-impact/1", params={"include_severance": True}).json()
    assert with_severance["replacement_cost"] == pytest.approx(r["hiring_cost"] + r["severance_pay"])
    assert client.get("/financial-impact/1", params={"retention": "nope"}).status_code == 422
    assert client.get("/financial-impact/999999").status_code == 404


def test_low_risk_employee_not_worth_retention_spend():
    """UX-15: พนักงาน #1804 เสี่ยง 1/100 สูตรเดิมบอกว่าคุ้ม 1.57 ล้าน แม้ลดความเสี่ยงเหลือศูนย์ก็ต้องติดลบ"""
    r = client.get("/financial-impact/1804", params={"risk_after": 0}).json()
    assert r["score"]["risk_score"] < 0.05
    assert r["expected_benefit"] < 0 and r["expected_benefit"] == pytest.approx(r["expected_loss"] - r["retain_cost"])


def test_company_summary_departments():
    r = client.get("/company-summary/departments").json()
    depts = r["departments"]
    assert sum(d["n_employees"] for d in depts) == 1470
    assert [d["expected_loss_total"] for d in depts] == sorted((d["expected_loss_total"] for d in depts), reverse=True)
    factors = client.get("/company-summary").json()["top_factors"]
    assert not any("_" in f["feature"] for f in factors if f["feature"].split("_")[0] in ("JobRole", "Department"))
