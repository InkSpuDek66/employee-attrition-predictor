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


def _xlsx(df):
    import io

    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    return buf.getvalue()


def test_recalibrate_from_excel_then_history_and_reset(tmp_path, monkeypatch):
    import io

    import pandas as pd

    monkeypatch.setattr(calibration, "STORE", str(tmp_path))
    demo = client.get("/recalibrate/template", params={"demo": True})
    assert demo.status_code == 200
    df = pd.read_excel(io.BytesIO(demo.content), sheet_name="พนักงาน")
    assert len(df) == 300 and set(df["ลาออกแล้วหรือยัง"]) == {"ลาออก", "ยังอยู่"}

    xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    r = client.post("/recalibrate/upload", files={"file": ("d.xlsx", demo.content, xlsx)}, data={"method": "platt"}).json()
    assert r["result"]["n_samples"] == 300 and r["result"]["method"] == "platt" and len(r["result"]["examples"]) == 4
    curve, bins = r["result"]["curve"], r["result"]["bins"]
    assert len(curve) == 51 and all(a["after"] <= b["after"] for a, b in zip(curve, curve[1:]))  # สูตรไม่สลับลำดับ
    assert bins and sum(b["n"] for b in bins) <= 300 and all(0 <= b["rate"] <= 1 for b in bins)
    assert client.get("/shap/1").json()["calibrated_risk_score"] is not None
    assert client.get("/recalibrate/history").json()["history"][0]["method"] == "platt"

    # ไม่มีคอลัมน์ผลจริง: ไม่ปรับเทียบ บอกคอลัมน์ที่ขาด
    r = client.post("/recalibrate/upload", files={"file": ("d.xlsx", _xlsx(df.drop(columns="ลาออกแล้วหรือยัง")), xlsx)}).json()
    assert r["result"] is None and r["check"]["missing_columns"] == ["ลาออกแล้วหรือยัง"]
    # ค่าผลจริงผิด
    bad = df.copy()
    bad.loc[0, "ลาออกแล้วหรือยัง"] = "ไม่แน่ใจ"
    r = client.post("/recalibrate/upload", files={"file": ("d.xlsx", _xlsx(bad), xlsx)}).json()
    assert r["result"] is None and r["check"]["errors"][0]["column"] == "ลาออกแล้วหรือยัง"
    # น้อยกว่า 50 คน
    assert client.post("/recalibrate/upload", files={"file": ("d.xlsx", _xlsx(df.head(20)), xlsx)}).status_code == 422

    assert client.delete("/recalibrate").json()["removed"] == 1
    assert client.get("/recalibrate/history").json()["history"] == []
    assert client.get("/shap/1").json()["calibrated_risk_score"] is None


def test_import_file_with_label_column_still_validates():
    import io

    import pandas as pd

    demo = client.get("/recalibrate/template", params={"demo": False}).content
    df = pd.read_excel(io.BytesIO(demo), sheet_name="พนักงาน")
    xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    body = client.post("/employees/validate", files={"file": ("d.xlsx", _xlsx(df), xlsx)}).json()
    assert body["n_valid"] == 2 and body["unknown_columns"] == [] and body["errors"] == []
