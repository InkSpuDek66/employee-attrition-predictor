-- Schema ของแอป (database `attrition`) ตาม README หัวข้อ 5 และ docs/review_data_engineering_S.md DE-04
-- docker compose รันไฟล์นี้อัตโนมัติเฉพาะตอนสร้าง volume ใหม่ ถ้ามี volume อยู่แล้วให้รันเอง:
--   docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U attrition -d attrition < docker/postgres/init/02-app-schema.sql
-- รันซ้ำได้ (IF NOT EXISTS) ยังไม่มี migration tool ถ้าแก้คอลัมน์ของตารางที่มีอยู่แล้วต้องเขียน ALTER แยก
--
-- หลักที่ใช้ทุกตาราง
-- - ทุกตารางที่เป็นข้อมูลของบริษัทมี tenant_id และ key ขึ้นต้นด้วย tenant_id (SEC-02 แยกข้อมูลแต่ละบริษัท)
--   query ทุกครั้งต้องกรอง tenant_id ข้อมูล IBM dataset ใช้ tenant 'ibm_demo'
-- - ผลทำนาย/SHAP/ต้นทุน/สรุป มี model_version + เวลา เพื่อย้อนตรวจได้ว่าตัวเลขบน dashboard มาจากโมเดลตัวไหน
-- - ชื่อคอลัมน์ employees เป็น snake_case ของชื่อคอลัมน์ IBM (MonthlyIncome -> monthly_income)
-- รีวิวก่อน merge: Nanthamon (Superset อ่านตาราง), Yanisa (interventions) ตาม DE-04

-- บริษัทที่ใช้ระบบ (tenant) รูปแบบ id ตรงกับ calibration.TENANT_ID_PATTERN
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id   text PRIMARY KEY CHECK (tenant_id ~ '^[A-Za-z0-9_-]{1,64}$'),
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tenants (tenant_id, name) VALUES ('ibm_demo', 'IBM HR Analytics (ข้อมูลตัวอย่าง)')
ON CONFLICT (tenant_id) DO NOTHING;

-- ข้อมูลพนักงาน (snapshot ล่าสุดต่อคน) จาก IBM dataset หรือไฟล์ Excel/CSV ที่บริษัทอัปโหลด
-- CHECK ใช้ช่วงค่าเดียวกับ IBM dataset/schemas.py เป็นด่านสุดท้ายกันข้อมูลผิดตอนอัปโหลด
CREATE TABLE IF NOT EXISTS employees (
    tenant_id                   text NOT NULL REFERENCES tenants ON DELETE CASCADE,
    employee_id                 integer NOT NULL CHECK (employee_id > 0),  -- EmployeeNumber
    age                         smallint NOT NULL CHECK (age BETWEEN 15 AND 80),
    gender                      text NOT NULL CHECK (gender IN ('Male', 'Female')),
    marital_status              text NOT NULL CHECK (marital_status IN ('Single', 'Married', 'Divorced')),
    education                   smallint NOT NULL CHECK (education BETWEEN 1 AND 5),
    education_field             text NOT NULL,
    department                  text NOT NULL,
    job_role                    text NOT NULL,
    job_level                   smallint NOT NULL CHECK (job_level BETWEEN 1 AND 5),
    business_travel             text NOT NULL CHECK (business_travel IN ('Non-Travel', 'Travel_Rarely', 'Travel_Frequently')),
    over_time                   text NOT NULL CHECK (over_time IN ('Yes', 'No')),
    distance_from_home          smallint NOT NULL CHECK (distance_from_home >= 0),          -- หน้าเว็บแสดงเป็น กม. (IBM ไม่ระบุหน่วย)
    -- หน่วยของโมเดล (IBM, สมมติเป็น USD ตาม DE-01) ห้ามเก็บบาทตรงๆ ต้องแปลงก่อนบันทึก
    monthly_income              integer NOT NULL CHECK (monthly_income > 0),
    daily_rate                  integer NOT NULL CHECK (daily_rate > 0),
    hourly_rate                 integer NOT NULL CHECK (hourly_rate > 0),
    monthly_rate                integer NOT NULL CHECK (monthly_rate > 0),
    percent_salary_hike         smallint NOT NULL CHECK (percent_salary_hike BETWEEN 0 AND 100),
    stock_option_level          smallint NOT NULL CHECK (stock_option_level BETWEEN 0 AND 3),
    performance_rating          smallint NOT NULL CHECK (performance_rating BETWEEN 1 AND 4),
    training_times_last_year    smallint NOT NULL CHECK (training_times_last_year >= 0),
    environment_satisfaction    smallint NOT NULL CHECK (environment_satisfaction BETWEEN 1 AND 4),
    job_satisfaction            smallint NOT NULL CHECK (job_satisfaction BETWEEN 1 AND 4),
    relationship_satisfaction   smallint NOT NULL CHECK (relationship_satisfaction BETWEEN 1 AND 4),
    job_involvement             smallint NOT NULL CHECK (job_involvement BETWEEN 1 AND 4),
    work_life_balance           smallint NOT NULL CHECK (work_life_balance BETWEEN 1 AND 4),
    num_companies_worked        smallint NOT NULL CHECK (num_companies_worked >= 0),
    total_working_years         smallint NOT NULL CHECK (total_working_years >= 0),
    years_at_company            smallint NOT NULL CHECK (years_at_company >= 0),
    years_in_current_role       smallint NOT NULL CHECK (years_in_current_role >= 0),
    years_since_last_promotion  smallint NOT NULL CHECK (years_since_last_promotion >= 0),
    years_with_curr_manager     smallint NOT NULL CHECK (years_with_curr_manager >= 0),
    -- ผลจริง: ใช้กับ /recalibrate และการวัดผล (Measure) ว่างได้สำหรับคนที่ยังทำงานอยู่
    attrition                   text CHECK (attrition IN ('Yes', 'No')),
    left_at                     date,
    source                      text NOT NULL DEFAULT 'upload' CHECK (source IN ('ibm_dataset', 'upload')),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, employee_id)
);
CREATE INDEX IF NOT EXISTS employees_department_idx ON employees (tenant_id, department);

-- โมเดลที่เคยใช้ให้คะแนน (อ้างอิง MLflow Model Registry) เช่น 'attrition-xgboost-P/1'
CREATE TABLE IF NOT EXISTS model_runs (
    model_version   text PRIMARY KEY,
    mlflow_run_id   text,
    metrics         jsonb NOT NULL DEFAULT '{}',  -- เช่น {"cv_auc": 0.827, "test_auc": 0.81}
    registered_at   timestamptz,
    is_active       boolean NOT NULL DEFAULT false
);
-- ใช้งานได้ทีละตัว (batch_score ใช้ตัวที่ active)
CREATE UNIQUE INDEX IF NOT EXISTS model_runs_one_active ON model_runs (is_active) WHERE is_active;

-- ผลทำนายต่อพนักงานต่อรอบการให้คะแนน (batch_score.py) ใช้ทั้ง Superset และหน้าเว็บ
CREATE TABLE IF NOT EXISTS attrition_predictions (
    prediction_id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id               text NOT NULL,
    employee_id             integer NOT NULL,
    model_version           text NOT NULL REFERENCES model_runs,
    risk_score              real NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
    calibrated_risk_score   real CHECK (calibrated_risk_score BETWEEN 0 AND 1),  -- มีเมื่อบริษัท recalibrate แล้ว
    risk_band               text NOT NULL CHECK (risk_band IN ('Low', 'Medium', 'High')),  -- README 6.1 คิดจากคะแนนปรับเทียบถ้ามี
    scored_at               timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employees ON DELETE CASCADE
);
-- หาผลล่าสุดของแต่ละคนเร็ว
CREATE INDEX IF NOT EXISTS attrition_predictions_latest_idx ON attrition_predictions (tenant_id, employee_id, scored_at DESC);

-- SHAP รายฟีเจอร์ของแต่ละผลทำนาย (log-odds บวก = ดันไปทางลาออก)
CREATE TABLE IF NOT EXISTS shap_explanations (
    prediction_id   bigint NOT NULL REFERENCES attrition_predictions ON DELETE CASCADE,
    feature_name    text NOT NULL,
    feature_value   double precision,
    shap_value      real NOT NULL,
    PRIMARY KEY (prediction_id, feature_name)
);

-- ประมาณการต้นทุน Retain vs Replace (README 6.3) หน่วยเดียวกับ monthly_income
CREATE TABLE IF NOT EXISTS financial_impact_estimates (
    prediction_id       bigint NOT NULL REFERENCES attrition_predictions ON DELETE CASCADE,
    retention_option    text NOT NULL,  -- key ใน config/financial_impact.json เช่น 'salary_raise_10pct'
    replacement_cost    double precision NOT NULL,
    retain_cost         double precision NOT NULL,
    severance_included  boolean NOT NULL DEFAULT false,
    expected_loss       double precision NOT NULL,  -- คะแนน × ต้นทุนหาคนแทน (ใช้เทียบ ไม่ใช่ยอดจริง)
    PRIMARY KEY (prediction_id, retention_option)
);

-- มาตรการที่ HR ทำกับพนักงาน + ผลลัพธ์ (Act -> Measure) สำหรับ /interventions (Yanisa + Nanthamon)
CREATE TABLE IF NOT EXISTS interventions (
    intervention_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id           text NOT NULL,
    employee_id         integer NOT NULL,
    intervention_type   text NOT NULL,  -- เช่น 'salary_raise', 'reduce_overtime', 'promotion'
    note                text,
    prediction_id       bigint REFERENCES attrition_predictions ON DELETE SET NULL,  -- คะแนนตอนตัดสินใจทำ
    started_at          date NOT NULL DEFAULT current_date,
    outcome             text CHECK (outcome IN ('stayed', 'left', 'pending')) DEFAULT 'pending',
    measured_at         date,
    created_at          timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, employee_id) REFERENCES employees ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS interventions_employee_idx ON interventions (tenant_id, employee_id);

-- ผล /recalibrate ต่อบริษัท เก็บประวัติทุกครั้ง ตัวล่าสุด = calibrated_at มากสุด (แทนไฟล์ backend/calibrations/*.json)
-- คอลัมน์ตรงกับ record ใน backend/calibration.py save()
CREATE TABLE IF NOT EXISTS tenant_calibrations (
    tenant_id       text NOT NULL REFERENCES tenants ON DELETE CASCADE,
    calibrated_at   timestamptz NOT NULL DEFAULT now(),
    method          text NOT NULL CHECK (method IN ('platt', 'isotonic')),
    params          jsonb NOT NULL,
    n_samples       integer NOT NULL CHECK (n_samples > 0),
    positive_rate   real NOT NULL CHECK (positive_rate BETWEEN 0 AND 1),
    metrics         jsonb NOT NULL DEFAULT '{}',  -- เช่น brier_before / brier_after
    model_version   text REFERENCES model_runs,
    PRIMARY KEY (tenant_id, calibrated_at)
);

-- cache ผลสรุปทั้งบริษัท/รายแผนก (README 6.6) ให้ /company-summary และ Superset อ่านแทนคำนวณสดทุก request
-- department ว่าง = ทั้งบริษัท
CREATE TABLE IF NOT EXISTS company_risk_summary (
    summary_id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id                   text NOT NULL REFERENCES tenants ON DELETE CASCADE,
    department                  text,
    model_version               text NOT NULL REFERENCES model_runs,
    n_employees                 integer NOT NULL,
    mean_risk_score             real NOT NULL,
    risk_bands                  jsonb NOT NULL,   -- {"High": 185, "Medium": 274, "Low": 1011}
    expected_loss_total         double precision NOT NULL,
    high_risk_replacement_cost  double precision NOT NULL,
    top_factors                 jsonb NOT NULL,   -- [{feature, mean_abs_shap, share, actionable, recommendation}]
    generated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_risk_summary_latest_idx ON company_risk_summary (tenant_id, department, generated_at DESC);
