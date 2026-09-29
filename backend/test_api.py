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
        r = client.post("/recalibrate", json={"tenant_id": "test_co", "method": method, "records": records})
        assert r.status_code == 200, r.text
        assert r.json()["n_samples"] == 300
        s = client.get("/shap/1", params={"tenant_id": "test_co"}).json()
        assert 0 <= s["calibrated_risk_score"] <= 1 and s["warning"] is None


def test_recalibrate_rejects_bad_input():
    good = ms.raw_employees().head(60).to_dict("records")
    assert client.post("/recalibrate", json={"tenant_id": "../x", "records": good}).status_code == 422
    assert client.post("/recalibrate", json={"tenant_id": "a", "records": good[:5]}).status_code == 422
    no_leavers = [dict(r, Attrition="No") for r in good]
    assert client.post("/recalibrate", json={"tenant_id": "a", "records": no_leavers}).status_code == 422
    missing_col = [{k: v for k, v in r.items() if k != "Age"} for r in good]
    assert client.post("/recalibrate", json={"tenant_id": "a", "records": missing_col}).status_code == 422
    assert client.get("/shap/1", params={"tenant_id": "../x"}).status_code == 422


def test_company_summary():
    r = client.get("/company-summary").json()
    assert r["n_employees"] == 1470 and len(r["top_factors"]) == 5
    assert client.get("/company-summary", params={"department": "Sales"}).json()["n_employees"] < 1470
    assert client.get("/company-summary", params={"department": "Nope"}).status_code == 404
