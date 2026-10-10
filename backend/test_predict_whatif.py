"""test ของ /predict, /whatif, /financial-impact, /company-summary/departments (งานของ Saphondanai)

รัน: python -m pytest backend  (ต้องมีโมเดลตาม MODEL_URI ใน .env เช่นจาก notebooks/04_tuning_S.ipynb)
"""

import pytest
from fastapi.testclient import TestClient

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


def test_calibrated_band_used(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "STORE", str(tmp_path))
    records = ms.raw_employees().sample(300, random_state=0).to_dict("records")
    assert client.post("/recalibrate", json={"tenant_id": "co", "method": "platt", "records": records}).status_code == 200
    r = client.post("/whatif", json={"employee_id": 1, "tenant_id": "co", "changes": {"OverTime": "No"}}).json()
    assert r["warning"] is None and r["before"]["calibrated_risk_score"] is not None
    assert r["delta"] == pytest.approx(r["after"]["calibrated_risk_score"] - r["before"]["calibrated_risk_score"])


def test_financial_impact():
    r = client.get("/financial-impact/1").json()
    assert r["replacement_cost"] == pytest.approx(r["hiring_cost"])  # ค่าเริ่มต้นไม่รวมค่าชดเชย
    assert r["net_benefit_if_retained"] == pytest.approx(r["replacement_cost"] - r["retain_cost"])
    with_severance = client.get("/financial-impact/1", params={"include_severance": True}).json()
    assert with_severance["replacement_cost"] == pytest.approx(r["hiring_cost"] + r["severance_pay"])
    assert client.get("/financial-impact/1", params={"retention": "nope"}).status_code == 422
    assert client.get("/financial-impact/999999").status_code == 404


def test_company_summary_departments():
    r = client.get("/company-summary/departments").json()
    depts = r["departments"]
    assert sum(d["n_employees"] for d in depts) == 1470
    assert [d["expected_loss_total"] for d in depts] == sorted((d["expected_loss_total"] for d in depts), reverse=True)
    factors = client.get("/company-summary").json()["top_factors"]
    assert not any("_" in f["feature"] for f in factors if f["feature"].split("_")[0] in ("JobRole", "Department"))
