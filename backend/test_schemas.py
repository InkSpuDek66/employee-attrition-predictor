"""schemas.EmployeeInput: ช่วงค่าต้องไม่หลวมกว่า CHECK ของตาราง employees (DE-10) และกฎข้ามช่อง (UX-04) ไม่ต้องใช้โมเดล"""

import os
import re
import sys

import annotated_types
import pandas as pd
import pytest
from pydantic import ValidationError

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))
import business_rules  # noqa: E402
import db  # noqa: E402
from clean_pipeline import RAW_FILENAME, load_raw_data  # noqa: E402
from schemas import INCOME_IN_THB, EmployeeInput  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
SCHEMA = os.path.join(ROOT, "docker", "postgres", "init", "02-app-schema.sql")
RAW = load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))


def _db_checks() -> dict:
    """{คอลัมน์: (ต่ำสุด, สูงสุดหรือ None) หรือ set ของค่าที่รับ} จาก CHECK ในตาราง employees"""
    sql = open(SCHEMA, encoding="utf-8").read()
    table = re.search(r"CREATE TABLE IF NOT EXISTS employees \((.*?)\n\);", sql, re.S).group(1)
    checks = {}
    for col, rule in re.findall(r"^\s{4}([a-z_]+)\s.*?CHECK \((.*?)\)(?:,|$)", table, re.M):
        if m := re.fullmatch(rf"{col} BETWEEN (\d+) AND (\d+)", rule):
            checks[col] = (int(m[1]), int(m[2]))
        elif m := re.fullmatch(rf"{col} (>=|>) (\d+)", rule):
            checks[col] = (int(m[2]) + (m[1] == ">"), None)
        elif m := re.fullmatch(rf"{col} IN \((.*)\)", rule):
            checks[col] = set(re.findall(r"'([^']*)'", m[1]))
    return checks


def _model_range(field: str):
    """(ต่ำสุด, สูงสุดหรือ None) แบบรวมขอบ ของฟิลด์จำนวนเต็มใน EmployeeInput"""
    lo = hi = None
    for m in EmployeeInput.model_fields[field].metadata:
        if isinstance(m, annotated_types.Ge):
            lo = m.ge
        elif isinstance(m, annotated_types.Gt):
            lo = m.gt + 1
        elif isinstance(m, annotated_types.Le):
            hi = m.le
    return lo, hi


def test_model_ranges_not_looser_than_db_checks():
    """ไฟล์ที่ผ่านขั้นตรวจต้องบันทึกได้เสมอ (เคยรับอายุ 81–100 แล้ว DB ปฏิเสธทั้งไฟล์ตอนบันทึก)"""
    checks = _db_checks()
    assert {"age", "daily_rate", "gender", "office_days_per_week"} <= set(checks)  # regex ยังอ่าน schema ได้
    compared = 0
    for field in EmployeeInput.model_fields:
        rule = checks.get(db.db_column(field))
        if rule is None:
            continue
        compared += 1
        if isinstance(rule, set):
            assert set(EmployeeInput.model_fields[field].annotation.__args__) <= rule, field
            continue
        (db_lo, db_hi), (lo, hi) = rule, _model_range(field)
        assert lo is not None and lo >= db_lo, f"{field}: schemas ต่ำสุด {lo} แต่ DB รับตั้งแต่ {db_lo}"
        assert db_hi is None or (hi is not None and hi <= db_hi), f"{field}: schemas สูงสุด {hi} แต่ DB รับถึง {db_hi}"
    assert compared >= 25


def test_every_ibm_employee_passes():
    rows = RAW[list(set(EmployeeInput.model_fields) - {"OfficeDaysPerWeek"})].to_dict("records")
    for r in rows:
        EmployeeInput(**r)


def _errors(record: dict, context=None) -> dict:
    with pytest.raises(ValidationError) as e:
        EmployeeInput.model_validate(record, context=context)
    return {err["loc"][0]: err["msg"] for err in e.value.errors()}


def test_cross_field_rules_point_at_one_column():
    """UX-04: ค่าที่เป็นไปไม่ได้เมื่อดูคู่กัน error ต้องบอกคอลัมน์ ไฟล์นำเข้าจึงบอกแถว + คอลัมน์ได้"""
    base = RAW.iloc[0][list(set(EmployeeInput.model_fields) - {"OfficeDaysPerWeek"})].to_dict()
    base.update(Age=41, TotalWorkingYears=8, YearsAtCompany=6, YearsInCurrentRole=4, YearsSinceLastPromotion=0, YearsWithCurrManager=5)
    EmployeeInput(**base)
    assert "6 ปี" in _errors({**base, "YearsSinceLastPromotion": 15})["YearsSinceLastPromotion"]
    assert set(_errors({**base, "YearsInCurrentRole": 30})) == {"YearsInCurrentRole"}
    assert "8 ปี" in _errors({**base, "YearsAtCompany": 40})["YearsAtCompany"]
    assert "อายุ 18 ปี" in _errors({**base, "Age": 18})["TotalWorkingYears"]
    assert set(_errors({**base, "DistanceFromHome": 5000})) == {"DistanceFromHome"}
    assert set(_errors({**base, "Age": 90})) == {"Age"}  # ไม่ซ้ำเป็น error ของ TotalWorkingYears


def test_income_cap_depends_on_unit():
    """เพดาน 5 ล้านบาท/เดือน: ไฟล์นำเข้ากรอกบาท ส่วน API ใช้หน่วยของโมเดล (หาร THB_PER_USD)"""
    base = RAW.iloc[0][list(set(EmployeeInput.model_fields) - {"OfficeDaysPerWeek"})].to_dict()
    cap = business_rules.MAX_MONTHLY_INCOME_THB
    assert EmployeeInput.model_validate({**base, "MonthlyIncome": cap}, context=INCOME_IN_THB).MonthlyIncome == cap
    assert "5,000,000 บาท" in _errors({**base, "MonthlyIncome": cap + 1}, INCOME_IN_THB)["MonthlyIncome"]
    model_cap = cap // business_rules.THB_PER_USD
    assert EmployeeInput(**{**base, "MonthlyIncome": model_cap}).MonthlyIncome == model_cap
    assert "MonthlyIncome" in _errors({**base, "MonthlyIncome": model_cap + 1})
    assert pd.Series(RAW["MonthlyIncome"] * business_rules.THB_PER_USD).max() < cap  # IBM ทุกคนอยู่ใต้เพดาน
