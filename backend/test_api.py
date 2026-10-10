"""รัน: python -m pytest backend  (ต้องมี mlflow.db จาก notebooks/04_tuning_P.ipynb)"""

from fastapi.testclient import TestClient

import calibration
import model_store as ms
from main import app

client = TestClient(app)


def test_shap():
    r = client.get("/shap/1", params={"top_n": 3}).json()
    assert len(r["contributions"]) == 3 and r["warning"] and r["calibrated_risk_score"] is None
    assert abs(r["contributions"][0]["shap_value"]) >= abs(r["contributions"][-1]["shap_value"])
    assert client.get("/shap/999999").status_code == 404


def test_recalibrate_then_shap_uses_it(tmp_path, monkeypatch):
    monkeypatch.setattr(calibration, "STORE", str(tmp_path))
    records = ms.raw_employees().sample(300, random_state=0).to_dict("records")
    for method in ("platt", "isotonic"):
        r = client.post("/recalibrate", json={"method": method, "records": records})  # บริษัทมาจากผู้ login ("co")
        assert r.status_code == 200, r.text
        assert r.json()["n_samples"] == 300
        s = client.get("/shap/1").json()
        assert 0 <= s["calibrated_risk_score"] <= 1 and s["warning"] is None
        top = client.get("/company-summary/top-employees", params={"n": 5}).json()["employees"]
        cal = [r["calibrated_risk_score"] for r in top]
        assert None not in cal and cal == sorted(cal, reverse=True)


def test_recalibrate_rejects_bad_input():
    good = ms.raw_employees().head(60).to_dict("records")
    assert client.post("/recalibrate", json={"tenant_id": "../x", "records": good}).status_code == 422
    assert client.post("/recalibrate", json={"records": good[:5]}).status_code == 422
    assert client.post("/recalibrate", json={"records": good * 200}).status_code == 422  # เกิน 10,000 แถว (SEC-03)
    no_leavers = [dict(r, Attrition="No") for r in good]
    assert client.post("/recalibrate", json={"records": no_leavers}).status_code == 422
    missing_col = [{k: v for k, v in r.items() if k != "Age"} for r in good]
    assert client.post("/recalibrate", json={"records": missing_col}).status_code == 422
    # SEC-08: ไม่ส่งข้อความ exception ภายในของ Python กลับไป
    bad = [dict(r, MonthlyIncome="abc") for r in good]
    r = client.post("/recalibrate", json={"records": bad})
    assert r.status_code == 422 and "operand" not in r.text and "ข้อมูลไม่ตรงรูปแบบ" in r.text


def test_company_summary():
    r = client.get("/company-summary").json()
    assert r["n_employees"] == 1470 and len(r["top_factors"]) == 5
    assert client.get("/company-summary", params={"department": "Sales"}).json()["n_employees"] < 1470
    assert client.get("/company-summary", params={"department": "Nope"}).status_code == 404


def test_top_employees_sorted_and_filtered():
    rows = client.get("/company-summary/top-employees", params={"n": 5}).json()["employees"]
    scores = [r["risk_score"] for r in rows]
    assert len(rows) == 5 and scores == sorted(scores, reverse=True)
    assert rows[0]["risk_band"] in ("High", "Medium", "Low") and rows[0]["risk_band_th"]
    sales = client.get("/company-summary/top-employees", params={"n": 3, "department": "Sales"}).json()["employees"]
    assert {r["department"] for r in sales} == {"Sales"}
    assert client.get("/company-summary/top-employees", params={"department": "Nope"}).status_code == 404
    assert all(r["calibrated_risk_score"] is None for r in rows)
