"""ให้คะแนนพนักงานทุกคนใน DB แล้วบันทึกผล (ตาราง attrition_predictions, shap_explanations,
financial_impact_estimates, company_risk_summary, model_runs) ให้ Superset/หน้าเว็บอ่าน

ต้องตั้ง DATABASE_URL และโหลดพนักงานก่อน (python src/db.py) แล้วรัน:
    python backend/batch_score.py
รันซ้ำได้ ทุกรอบเพิ่มผลชุดใหม่ (ผลล่าสุด = scored_at / generated_at มากสุด) ไม่ลบของเก่า
ponytail: ให้คะแนนเฉพาะ tenant ibm_demo ตาม model_store ทำทุก tenant เมื่อแยกข้อมูลตามบริษัท (SEC-02)
"""

import json
import logging
import threading

import calibration
import model_store as ms
import business_rules  # noqa: E402  (อยู่ใน src/ ซึ่ง model_store เพิ่มเข้า sys.path แล้ว)
import company_summary as cs  # noqa: E402
import db  # noqa: E402

TENANT = db.DEMO_TENANT
log = logging.getLogger(__name__)
_lock = threading.Lock()
_pending = threading.Event()


def run(conn) -> int:
    X = ms.employee_features()
    employees = ms.raw_employees().set_index("EmployeeNumber").loc[X.index]
    raw = ms.risk_scores(X)
    record = calibration.load(TENANT)
    shown = calibration.apply(record, raw) if record else raw
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
                (TENANT, int(e), version, float(r), float(s) if record else None, business_rules.risk_band(s))
                for e, r, s in zip(X.index, raw, shown)
            ],
        )
        cur.execute(
            "SELECT employee_id, prediction_id FROM attrition_predictions WHERE tenant_id = %s AND scored_at = now()",
            (TENANT,),
        )
        pid = dict(cur.fetchall())
        ids = [pid[int(e)] for e in X.index]

        values = X.to_numpy(dtype=float)
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
        # คะแนนดิบ (ไม่ปรับเทียบ) ให้ตรงกับ /company-summary ที่อ่าน cache นี้
        summaries = [{"department": None, **cs.summarize(shap_values, names, raw, employees)}]
        summaries += cs.by_department(shap_values, names, raw, employees, top_n=5)
        cur.executemany(
            "INSERT INTO company_risk_summary (tenant_id, department, model_version, n_employees, mean_risk_score, "
            "risk_bands, expected_loss_total, high_risk_replacement_cost, top_factors) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            [
                (TENANT, s["department"], version, s["n_employees"], s["mean_risk_score"], json.dumps(s["risk_bands"]),
                 s["expected_loss_total"], s["high_risk_replacement_cost"], json.dumps(s["top_factors"], ensure_ascii=False))
                for s in summaries
            ],
        )
    return len(ids)


def _score_once():
    with db.connect() as conn:
        run(conn)


def refresh_in_background():
    """เรียกหลังข้อมูลเปลี่ยน (นำเข้าพนักงาน/ปรับเทียบ) ผ่าน FastAPI BackgroundTasks ให้ cache สรุปกลับมาใช้ได้
    ถ้ากำลังรันอยู่ จะไม่ซ้อน แต่รันต่ออีกรอบหลังรอบนี้จบ ให้ได้ข้อมูลล่าสุด
    ponytail: ล็อกใน process เดียว ถ้ารันหลาย worker/เครื่องให้ย้ายไปคิวงาน (หรือ advisory lock ของ Postgres)"""
    if not db.url():
        return
    _pending.set()
    if not _lock.acquire(blocking=False):
        return
    try:
        while _pending.is_set():
            _pending.clear()
            try:
                _score_once()
            except Exception as e:  # noqa: BLE001  งานเบื้องหลัง ห้ามล้ม request; log แค่ชนิด (ข้อความอาจมีข้อมูลพนักงาน)
                log.warning("batch_score: คำนวณสรุปใหม่ไม่สำเร็จ (%s)", type(e).__name__)
    finally:
        _lock.release()


if __name__ == "__main__":
    if not db.url():
        raise SystemExit("ตั้ง DATABASE_URL ใน .env ก่อน (ดู .env.example)")
    with db.connect() as conn:
        n = run(conn)
    print(f"ให้คะแนนพนักงาน {n} คน ด้วยโมเดล {ms.MODEL_VERSION} บันทึกลงฐานข้อมูลแล้ว")
