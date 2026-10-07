"""test กฎธุรกิจ README 6.1 / 6.3 / 6.6 (ไม่ต้องใช้โมเดล)"""

import os
import sys

import numpy as np
import pandas as pd
import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
import business_rules as br  # noqa: E402
import company_summary as cs  # noqa: E402


def test_risk_band_edges():
    assert [br.risk_band(s) for s in (0.0, 0.399, 0.4, 0.699, 0.7, 1.0)] == ["Low", "Low", "Medium", "Medium", "High", "High"]


def test_severance_days_follow_section_118():
    years = [0, 0.5, 1, 2.9, 3, 5, 6, 9, 10, 19, 20, 40]
    assert br.severance_days(years).tolist() == [0, 30, 90, 90, 180, 180, 240, 240, 300, 300, 400, 400]


def test_estimate():
    employees = pd.DataFrame({"MonthlyIncome": [3000, 10000], "YearsAtCompany": [2, 12], "JobLevel": [1, 4]})
    out = br.estimate(employees, [0.5, 0.1], retention="retention_bonus", include_severance=True)
    assert out["severance_pay"].tolist() == pytest.approx([3000 / 30 * 90, 10000 / 30 * 300])
    assert out["hiring_cost"].tolist() == pytest.approx([3000 * 12 * 0.5, 10000 * 12 * 1.5])
    assert out["replacement_cost"].tolist() == pytest.approx((out["hiring_cost"] + out["severance_pay"]).tolist())
    assert out["retain_cost"].tolist() == pytest.approx([3000, 10000])
    assert out["expected_loss"].tolist() == pytest.approx((out["replacement_cost"] * [0.5, 0.1]).tolist())
    with pytest.raises(ValueError):
        br.estimate(employees, [0.5, 0.1], retention="nope")


def test_factor_ranking_groups_one_hot():
    names = ["OverTime", "JobRole_Manager", "JobRole_Sales Executive", "Age"]
    shap_values = np.array([[0.1, 0.3, -0.2, 0.05], [-0.1, 0.1, 0.0, 0.05]])
    ranking = cs.factor_ranking(shap_values, names)
    assert ranking.index.tolist() == ["JobRole", "OverTime", "Age"]
    assert ranking["JobRole"] == pytest.approx((0.5 + 0.1) / 2)


def test_summarize_marks_non_actionable():
    employees = pd.DataFrame({"MonthlyIncome": [3000, 5000], "YearsAtCompany": [1, 3], "JobLevel": [1, 2]})
    out = cs.summarize(np.array([[0.5, 0.1], [0.4, 0.1]]), ["Age", "OverTime"], [0.8, 0.2], employees, top_n=2)
    assert out["risk_bands"] == {"High": 1, "Medium": 0, "Low": 1}
    age, overtime = out["top_factors"]
    assert age["feature"] == "Age" and not age["actionable"]
    assert overtime["actionable"] and "OT" in overtime["recommendation"]


def test_frontend_risk_thresholds_match_backend():
    """หน้าเว็บแบ่งระดับเองด้วย LOW/HIGH ใน frontend/src/theme.js ต้องตรงกับ business_rules (เคยหลุดเป็น 30/60)"""
    import re
    from pathlib import Path

    js = (Path(__file__).resolve().parents[1] / "frontend" / "src" / "theme.js").read_text(encoding="utf-8")
    low = float(re.search(r"export const LOW = ([\d.]+)", js).group(1))
    high = float(re.search(r"export const HIGH = ([\d.]+)", js).group(1))
    assert (low, high) == (br.MEDIUM_RISK, br.HIGH_RISK)
