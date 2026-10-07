"""เชื่อม PostgreSQL ของแอป (database `attrition` ใน docker-compose, schema ที่ docker/postgres/init/02-app-schema.sql)

ตั้ง DATABASE_URL ใน .env (ดู .env.example) ไม่ตั้ง = backend อ่าน CSV ของ IBM แบบเดิม
โหลด IBM dataset เข้าตาราง employees (รันซ้ำได้ อัปเดตแถวเดิม):
    python src/db.py
"""

import os
import re

import pandas as pd

import mlflow_setup  # noqa: F401  (โหลด .env)
from clean_pipeline import RAW_FILENAME, load_raw_data

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEMO_TENANT = "ibm_demo"
SKIP_COLUMNS = {"EmployeeCount", "Over18", "StandardHours"}  # ค่าเดียวทั้งไฟล์ ไม่เก็บ


def url():
    return os.getenv("DATABASE_URL")


def connect():
    import psycopg  # import ตอนใช้ ให้เครื่องที่ไม่ใช้ DB ไม่ต้องลง psycopg

    return psycopg.connect(url())


def db_column(ibm_column: str) -> str:
    """ชื่อคอลัมน์ IBM -> คอลัมน์ในตาราง employees (MonthlyIncome -> monthly_income)"""
    return "employee_id" if ibm_column == "EmployeeNumber" else re.sub(r"(?<!^)(?=[A-Z])", "_", ibm_column).lower()


def read_employees(tenant_id: str = DEMO_TENANT) -> pd.DataFrame:
    """พนักงานของบริษัทเดียว ชื่อคอลัมน์แบบ IBM (เหมือน CSV) เรียงตามรหัสพนักงาน"""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM employees WHERE tenant_id = %s ORDER BY employee_id", (tenant_id,))
        df = pd.DataFrame(cur.fetchall(), columns=[d.name for d in cur.description])
    if df.empty:
        raise LookupError(f"ไม่มีพนักงานของ tenant '{tenant_id}' ในฐานข้อมูล (โหลด IBM dataset: python src/db.py)")
    ibm = {db_column(c): c for c in load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME)).columns}
    return df[[c for c in df.columns if c in ibm]].rename(columns=ibm)


def upsert_employees(conn, df: pd.DataFrame, tenant_id: str, source: str) -> int:
    """บันทึกพนักงาน (ชื่อคอลัมน์แบบ IBM) ถ้ารหัสซ้ำในบริษัทเดียวกัน = อัปเดตเป็นค่าใหม่"""
    df = df.drop(columns=[c for c in SKIP_COLUMNS if c in df.columns])
    cols = ["tenant_id", "source"] + [db_column(c) for c in df.columns]
    update = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols[2:] if c != "employee_id")
    sql = (
        f"INSERT INTO employees ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))}) "
        f"ON CONFLICT (tenant_id, employee_id) DO UPDATE SET {update}, source = EXCLUDED.source, updated_at = now()"
    )
    rows = [(tenant_id, source, *r) for r in df.astype(object).where(df.notna(), None).itertuples(index=False)]
    with conn.cursor() as cur:
        cur.executemany(sql, rows)
    return len(rows)


if __name__ == "__main__":
    if not url():
        raise SystemExit("ตั้ง DATABASE_URL ใน .env ก่อน (ดู .env.example)")
    raw = load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))
    with connect() as conn:
        n = upsert_employees(conn, raw, DEMO_TENANT, "ibm_dataset")
    print(f"บันทึกพนักงาน {n} คน ลง tenant '{DEMO_TENANT}' แล้ว")
