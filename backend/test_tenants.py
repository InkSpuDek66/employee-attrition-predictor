"""แยกข้อมูลตามบริษัท: บริษัทที่ยังไม่นำเข้าพนักงานต้องไม่เห็นพนักงานของ IBM (บริษัทเดโม) เลย"""

import pytest
from fastapi.testclient import TestClient

import conftest
from main import app

client = TestClient(app)


@pytest.fixture
def new_company(monkeypatch):
    monkeypatch.setitem(conftest.TEST_USER, "tenant_id", "newco_demo")


def test_empty_company_sees_no_ibm_employees(new_company):
    s = client.get("/company-summary").json()
    assert s["n_employees"] == 0 and s["top_factors"] == [] and sum(s["risk_bands"].values()) == 0
    assert client.get("/company-summary/departments").json()["departments"] == []
    assert client.get("/company-summary/top-employees").json()["employees"] == []
    assert client.get("/shap/1").status_code == 404  # พนักงาน #1 ของ IBM อยู่อีกบริษัท
    assert client.post("/whatif", json={"employee_id": 1, "changes": {"OverTime": "No"}}).status_code == 404
    assert client.post("/predict", json={"employee_id": 1}).status_code == 404
    assert client.get("/financial-impact/1").status_code == 404


def test_demo_company_still_has_ibm():
    assert client.get("/company-summary").json()["n_employees"] == 1470
    assert client.get("/shap/1").status_code == 200
