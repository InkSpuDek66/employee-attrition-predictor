"""ให้คะแนนพนักงานทุกคนใน DB แล้วบันทึกผล (ตาราง attrition_predictions, shap_explanations,
financial_impact_estimates, company_risk_summary, model_runs) ให้ Superset/หน้าเว็บอ่าน

ต้องตั้ง DATABASE_URL และโหลดพนักงานก่อน (python src/db.py) แล้วรัน:
    python backend/batch_score.py
รันซ้ำได้ ทุกรอบเพิ่มผลชุดใหม่ (ผลล่าสุด = scored_at / generated_at มากสุด) คะแนน/ต้นทุน/สรุปเก็บทุกรอบ
ส่วน SHAP เก็บครบทุกฟีเจอร์เฉพาะรอบล่าสุด รอบเก่าเหลือ SHAP_KEEP_OLD อันดับแรกต่อคน (DE-16)
ให้คะแนนทีละบริษัท (tenant) หลังนำเข้า/ปรับเทียบ หรือทุกบริษัทที่มีพนักงานเมื่อรันจาก command line
"""

import json
import logging
import threading

import calibration
import model_store as ms
import business_rules  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)
import company_summary as cs  # noqa: E402
import db  # noqa: E402

# DE-16: 1 รอบของ 1,470 คน = SHAP 73,500 แถว (~6 MB) ถ้าเก็บครบทุกรอบ DB โตราว 2 GB/ปีเมื่อรันทุกวัน
# รอบเก่าเก็บแค่ 5 ปัจจัยที่มีผลมากสุดต่อคน (พอให้ Superset ดูแนวโน้มเหตุผลย้อนหลัง) ตกลงตัวเลขกับ Nanthamon อีกครั้ง
SHAP_KEEP_OLD = 5
log = logging.getLogger(__name__)
_lock = threading.Lock()
_pending: set = set()  # บริษัทที่รอคำนวณใหม่


def run(conn, tenant: str = db.DEMO_TENANT) -> int:
    """ให้คะแนนพนักงานทั้งบริษัท บันทึกผลทำนาย SHAP ต้นทุน และสรุปภาพรวม (cache ของ /company-summary)"""
    X = ms.employee_features(tenant)
    if X.empty:  # บริษัทที่ยังไม่มีพนักงาน ไม่มีอะไรให้คำนวณ
        return 0
    # ชื่อแผนกจริงของบริษัท: สรุปรายแผนกใน cache ตรงกับที่ /company-summary คำนวณสด
    employees = ms.display_employees(tenant).set_index("EmployeeNumber").loc[X.index]
    raw = ms.risk_scores(X)
    record = calibration.load(tenant)
    shown = calibration.apply(record, raw) if record else raw  # คะแนนที่หน้าเว็บแสดง ใช้ทั้งตารางผลทำนายและสรุป (DE-11)
    shap_values = ms.explainer()(X).values
    version = ms.MODEL_VERSION

    with conn.cursor() as cur:
        cur.execute("UPDATE model_runs SET is_active = false WHERE is_active AND model_version <> %s", (version,))
        cur.execute(
            "INSERT INTO model_runs (model_version, is_active) VALUES (%s, true) "
            "ON CONFLICT (model_version) DO UPDATE SET is_active = true",
            (version,),
        )
        # now() คงที่ทั้ง transaction จึงใช้หา prediction_id ของรอบนี้ได้
        cur.executemany(
            "INSERT INTO attrition_predictions (tenant_id, employee_id, model_version, risk_score, calibrated_risk_score, risk_band) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            [
                (tenant, int(e), version, float(r), float(s) if record else None, business_rules.risk_band(s))
                for e, r, s in zip(X.index, raw, shown)
            ],
        )
        # DE-16: SHAP ของรอบก่อนๆ เหลือเฉพาะปัจจัยที่มีผลมากสุดต่อคน (รอบนี้ยังไม่ได้ใส่ จึงไม่ถูกลบ)
        cur.execute(
            "DELETE FROM shap_explanations s USING ("
            "  SELECT x.prediction_id, x.feature_name,"
            "         row_number() OVER (PARTITION BY x.prediction_id ORDER BY abs(x.shap_value) DESC) AS rank"
            "  FROM shap_explanations x JOIN attrition_predictions p USING (prediction_id)"
            "  WHERE p.tenant_id = %s AND p.scored_at < now()"
            ") old "
            "WHERE s.prediction_id = old.prediction_id AND s.feature_name = old.feature_name AND old.rank > %s",
            (tenant, SHAP_KEEP_OLD),
        )
        cur.execute(
            "SELECT employee_id, prediction_id FROM attrition_predictions WHERE tenant_id = %s AND scored_at = now()",
            (tenant,),
        )
        pid = dict(cur.fetchall())
        ids = [pid[int(e)] for e in X.index]

        # เงินเดือนเก็บเป็นบาทที่บริษัทกรอก ไม่ใช่ค่าหลังเทียบอันดับที่โมเดลเห็น (ตรงกับ /shap, DE-01)
        values = X.assign(**{ms.INCOME: employees[ms.INCOME]}).to_numpy(dtype=float)
        with cur.copy("COPY shap_explanations (prediction_id, feature_name, feature_value, shap_value) FROM STDIN") as copy:
            for i, p in enumerate(ids):
                for j, name in enumerate(X.columns):
                    copy.write_row((p, name, values[i, j], float(shap_values[i, j])))

        severance = business_rules.config()["severance"]["include_by_default"]
        with cur.copy(
            "COPY financial_impact_estimates (prediction_id, retention_option, replacement_cost, retain_cost, "
            "severance_included, expected_loss) FROM STDIN"
        ) as copy:
            for option in business_rules.retention_options():
                money = business_rules.estimate(employees, shown, retention=option)
                for p, m in zip(ids, money.itertuples()):
                    copy.write_row((p, option, m.replacement_cost, m.retain_cost, severance, m.expected_loss))

        names = list(X.columns)
        # คะแนนชุดเดียวกับที่หน้าเว็บแสดง (ปรับเทียบถ้ามี) จำนวนเสี่ยงสูงจึงตรงกับตาราง attrition_predictions (DE-11)
        summaries = [{"department": None, **cs.summarize(shap_values, names, shown, employees)}]
        summaries += cs.by_department(shap_values, names, shown, employees, top_n=5)
        calibrated_at = record["calibrated_at"] if record else None
        cur.executemany(
            "INSERT INTO company_risk_summary (tenant_id, department, model_version, n_employees, mean_risk_score, "
            "risk_bands, expected_loss_total, high_risk_replacement_cost, top_factors, calibrated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            [
                (tenant, s["department"], version, s["n_employees"], s["mean_risk_score"], json.dumps(s["risk_bands"]),
                 s["expected_loss_total"], s["high_risk_replacement_cost"], json.dumps(s["top_factors"], ensure_ascii=False),
                 calibrated_at)
                for s in summaries
            ],
        )
    return len(ids)


def _score_once(tenant: str = db.DEMO_TENANT):
    with db.connect() as conn:
        run(conn, tenant)


def refresh_in_background(tenant: str = db.DEMO_TENANT):
    """เรียกหลังข้อมูลเปลี่ยน (นำเข้าพนักงาน/ปรับเทียบ) ผ่าน FastAPI BackgroundTasks ให้ cache สรุปกลับมาใช้ได้
    ถ้ากำลังรันอยู่ จะไม่ซ้อน แต่รันต่ออีกรอบหลังรอบนี้จบ ให้ได้ข้อมูลล่าสุด
    ponytail: ล็อกใน process เดียว ถ้ารันหลาย worker/เครื่องให้ย้ายไปคิวงาน (หรือ advisory lock ของ Postgres)"""
    if not db.url():
        return
    _pending.add(tenant)
    if not _lock.acquire(blocking=False):
        return
    try:
        while _pending:
            next_tenant = _pending.pop()
            try:
                _score_once(next_tenant)
            except Exception as e:  # noqa: BLE001  งานเบื้องหลัง ห้ามล้ม request; log แค่ชนิด (ข้อความอาจมีข้อมูลพนักงาน)
                log.warning("batch_score: คำนวณสรุปใหม่ไม่สำเร็จ (%s)", type(e).__name__)
    finally:
        _lock.release()


if __name__ == "__main__":
    if not db.url():
        raise SystemExit("ตั้ง DATABASE_URL ใน .env ก่อน (ดู .env.example)")
    with db.connect() as conn:
        tenants = [t for (t,) in conn.execute("SELECT DISTINCT tenant_id FROM employees ORDER BY tenant_id")]
        for t in tenants:
            n = run(conn, t)
            print(f"{t}: ให้คะแนนพนักงาน {n} คน ด้วยโมเดล {ms.MODEL_VERSION} บันทึกลงฐานข้อมูลแล้ว")
