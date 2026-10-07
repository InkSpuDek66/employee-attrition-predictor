"""ชื่อคอลัมน์ IBM ต้องแปลงเป็นคอลัมน์ที่มีจริงในตาราง employees (ไม่ต้องมี DB ก็รันได้)"""

import os
import re

import model_store as ms
import db

SCHEMA = os.path.join(ms.ROOT, "docker", "postgres", "init", "02-app-schema.sql")


def test_every_ibm_column_maps_to_employees_table():
    sql = open(SCHEMA, encoding="utf-8").read()
    table = re.search(r"CREATE TABLE IF NOT EXISTS employees \((.*?)\n\);", sql, re.S).group(1)
    columns = set(re.findall(r"^\s{4}([a-z_]+)\s", table, re.M))
    ibm = set(ms.load_raw_data(os.path.join(ms.ROOT, "data", "raw", ms.RAW_FILENAME)).columns) - db.SKIP_COLUMNS
    assert {db.db_column(c) for c in ibm} <= columns
    assert db.db_column("YearsWithCurrManager") == "years_with_curr_manager" and db.db_column("EmployeeNumber") == "employee_id"
