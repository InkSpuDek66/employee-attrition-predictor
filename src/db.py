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
EXTRA_COLUMNS = ["OfficeDaysPerWeek"]  # ไม่มีใน CSV ของ IBM แต่เก็บในตาราง employees
# ชื่อพนักงาน (คอลัมน์ full_name) ตั้งใจไม่อยู่ใน EXTRA_COLUMNS: read_employees จึงไม่คืนชื่อ
# ข้อมูลที่ส่งเข้าโมเดล/predict/whatif ไม่มีชื่อปนแน่นอน อ่านชื่อแยกด้วย employee_names() ตอนจะแสดงผล
FULL_NAME = "FullName"  # ชื่อแบบ IBM ของคอลัมน์ full_name (ใช้ตอนบันทึกผ่าน upsert_employees)
# แผนก/ตำแหน่งจริงของบริษัท (คอลัมน์ department_name / job_title) แสดงผลเท่านั้น ไม่อยู่ใน read_employees เช่นเดียวกับชื่อ
DEPARTMENT_NAME = "DepartmentName"
JOB_TITLE = "JobTitle"
LABEL_COLUMNS = {"full_name": FULL_NAME, "department_name": DEPARTMENT_NAME, "job_title": JOB_TITLE}


def url():
    return os.getenv("DATABASE_URL")


class IntegrityError(Exception):
    """ข้อมูลผิด CHECK/FK ของตาราง (ห่อ psycopg.IntegrityError ให้คนเรียกไม่ต้อง import psycopg)
    ข้อความมีแค่ชื่อ constraint ไม่มีค่าในแถว (error ของ Postgres แนบทั้งแถวมา = ข้อมูลส่วนบุคคล ห้ามลง log)"""


class SchemaOutdated(Exception):
    """ตาราง/คอลัมน์ที่โค้ดใช้ยังไม่มีใน DB (volume เก่าที่ยังไม่ได้รัน 02-app-schema.sql ซ้ำ, QA-06)"""


def connect():
    import psycopg  # import ตอนใช้ ให้เครื่องที่ไม่ใช้ DB ไม่ต้องลง psycopg

    return psycopg.connect(url())


def db_column(ibm_column: str) -> str:
    """ชื่อคอลัมน์ IBM -> คอลัมน์ในตาราง employees (MonthlyIncome -> monthly_income)"""
    return "employee_id" if ibm_column == "EmployeeNumber" else re.sub(r"(?<!^)(?=[A-Z])", "_", ibm_column).lower()


def read_employees(tenant_id: str = DEMO_TENANT) -> pd.DataFrame:
    """พนักงานปัจจุบันของบริษัทเดียว (ไม่รวมคนที่บันทึกว่าออกแล้ว) ชื่อคอลัมน์แบบ IBM (เหมือน CSV) เรียงตามรหัสพนักงาน"""
    with connect() as conn, conn.cursor() as cur:
        # left_at ไม่ว่าง = บันทึกว่าออกแล้ว ไม่ใช่พนักงานปัจจุบัน
        cur.execute("SELECT * FROM employees WHERE tenant_id = %s AND left_at IS NULL ORDER BY employee_id", (tenant_id,))
        df = pd.DataFrame(cur.fetchall(), columns=[d.name for d in cur.description])
    ibm = {db_column(c): c for c in [*load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME)).columns, *EXTRA_COLUMNS]}
    # บริษัทที่ยังไม่มีพนักงาน (เช่น บริษัทใหม่ก่อนนำเข้า) = ตารางว่างที่มีคอลัมน์ครบ ไม่ใช่ error
    return df[[c for c in df.columns if c in ibm]].rename(columns=ibm)


def employee_labels(tenant_id: str) -> pd.DataFrame:
    """ชื่อ / แผนกจริง / ตำแหน่งจริง ของพนักงานทั้งบริษัท index = รหัสพนักงาน (ค่าว่าง = None)
    ไม่ตั้ง DATABASE_URL หรือ DB เก่ายังไม่มีคอลัมน์ = ตารางว่าง (หน้าเว็บแสดงชื่อกลุ่มของโมเดลแทน)"""
    empty = pd.DataFrame(columns=list(LABEL_COLUMNS.values()), index=pd.Index([], name="EmployeeNumber"))
    if not url():
        return empty
    import psycopg

    try:
        with connect() as conn, conn.cursor() as cur:
            cur.execute(f"SELECT employee_id, {', '.join(LABEL_COLUMNS)} FROM employees WHERE tenant_id = %s", (tenant_id,))
            rows = cur.fetchall()
    except psycopg.errors.UndefinedColumn:  # QA-06
        return empty
    return pd.DataFrame(rows, columns=["EmployeeNumber", *LABEL_COLUMNS.values()]).set_index("EmployeeNumber")


def employee_names(tenant_id: str, ids) -> dict[int, str]:
    """{รหัสพนักงาน: ชื่อ} เฉพาะคนที่มีชื่อ ไม่ตั้ง DATABASE_URL (อ่าน CSV ของ IBM ซึ่งไม่มีชื่อ) = {}"""
    ids = [int(i) for i in ids]
    if not url() or not ids:
        return {}
    import psycopg

    try:
        with connect() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT employee_id, full_name FROM employees WHERE tenant_id = %s AND employee_id = ANY(%s) AND full_name IS NOT NULL",
                (tenant_id, ids),
            )
            return dict(cur.fetchall())
    except psycopg.errors.UndefinedColumn:  # DB เก่ายังไม่มี full_name (QA-06): แสดงแค่รหัสไปก่อน ไม่ให้หน้าพัง
        return {}


def upsert_employees(conn, df: pd.DataFrame, tenant_id: str, source: str) -> int:
    """บันทึกพนักงาน (ชื่อคอลัมน์แบบ IBM) ถ้ารหัสซ้ำในบริษัทเดียวกัน = อัปเดตเป็นค่าใหม่ (คนที่เคยบันทึกว่าออกแล้ว = กลับมา)"""
    df = df.drop(columns=[c for c in SKIP_COLUMNS if c in df.columns])
    cols = ["tenant_id", "source"] + [db_column(c) for c in df.columns]
    update = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols[2:] if c != "employee_id")
    sql = (
        f"INSERT INTO employees ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))}) "
        f"ON CONFLICT (tenant_id, employee_id) DO UPDATE SET {update}, source = EXCLUDED.source, left_at = NULL, updated_at = now()"
    )
    rows = [(tenant_id, source, *r) for r in df.astype(object).where(df.notna(), None).itertuples(index=False)]
    import psycopg

    try:
        with conn.cursor() as cur:
            cur.executemany(sql, rows)
    except psycopg.IntegrityError as e:
        raise IntegrityError(e.diag.constraint_name or type(e).__name__) from None
    except (psycopg.errors.UndefinedColumn, psycopg.errors.UndefinedTable) as e:
        raise SchemaOutdated(type(e).__name__) from None  # ข้อความของ Postgres อาจมีค่าในแถว ไม่ส่งต่อ
    return len(rows)


def mark_left(conn, tenant_id: str, keep_ids) -> int:
    """พนักงานปัจจุบันที่ไม่อยู่ใน keep_ids = บันทึกว่าออกแล้ววันนี้ (ไม่ลบแถว) คืนจำนวนคน"""
    cur = conn.execute(
        "UPDATE employees SET left_at = current_date, updated_at = now() "
        "WHERE tenant_id = %s AND left_at IS NULL AND NOT (employee_id = ANY(%s))",
        (tenant_id, [int(i) for i in keep_ids]),
    )
    return cur.rowcount


def stored_for_check(tenant_id: str, ids) -> dict[int, dict]:
    """ค่าที่บันทึกไว้ของรหัสในไฟล์ ไว้เทียบหาการเปลี่ยนแปลงที่แปลก (ชื่อเปลี่ยน อายุ/อายุงานลดลง เคยออกแล้ว)"""
    ids = [int(i) for i in ids]
    if not ids:
        return {}
    with connect() as conn:
        rows = conn.execute(
            "SELECT employee_id, full_name, age, total_working_years, years_at_company, left_at IS NOT NULL "
            "FROM employees WHERE tenant_id = %s AND employee_id = ANY(%s)",
            (tenant_id, ids),
        ).fetchall()
    keys = (FULL_NAME, "Age", "TotalWorkingYears", "YearsAtCompany", "left")
    return {r[0]: dict(zip(keys, r[1:])) for r in rows}


def data_as_of(tenant_id: str):
    """เวลาที่ข้อมูลพนักงานปัจจุบันของบริษัทถูกบันทึก/อัปเดตล่าสุด (นำเข้าครั้งล่าสุด) ไม่มีพนักงาน/ไม่ต่อ DB = None
    ponytail: ใช้ครั้งล่าสุดของทั้งบริษัท นำเข้าบางแผนกแล้วแผนกอื่นที่เก่ากว่าจะดูใหม่ไปด้วย แยกรายแผนกถ้าต้องการ"""
    if not url():
        return None
    with connect() as conn:
        return conn.execute(
            "SELECT max(updated_at) FROM employees WHERE tenant_id = %s AND left_at IS NULL", (tenant_id,)
        ).fetchone()[0]


def current_ids(tenant_id: str) -> tuple[set[int], set[int]]:
    """รหัสพนักงานปัจจุบัน และคนที่บันทึกว่าออกแล้ว ของบริษัท (ไว้บอกก่อนบันทึกว่าจะเพิ่ม/อัปเดต/ออกกี่คน)"""
    with connect() as conn:
        rows = conn.execute("SELECT employee_id, left_at IS NULL FROM employees WHERE tenant_id = %s", (tenant_id,)).fetchall()
    return {i for i, active in rows if active}, {i for i, active in rows if not active}


if __name__ == "__main__":
    if not url():
        raise SystemExit("ตั้ง DATABASE_URL ใน .env ก่อน (ดู .env.example)")
    raw = load_raw_data(os.path.join(ROOT, "data", "raw", RAW_FILENAME))
    with connect() as conn:
        n = upsert_employees(conn, raw, DEMO_TENANT, "ibm_dataset")
    print(f"บันทึกพนักงาน {n} คน ลง tenant '{DEMO_TENANT}' แล้ว")
