"""ปรับเทียบคะแนนกับข้อมูลลาออกจริงของบริษัท (README 6.5) เฉพาะผู้ดูแลระบบ บริษัทมาจาก token (SEC-02)

POST   /recalibrate            records เป็น JSON (คอลัมน์แบบ IBM) สำหรับเรียกจากระบบอื่น
GET    /recalibrate/template   ไฟล์ Excel ตัวอย่าง (demo=true = พนักงานจำลอง 300 คนไว้ทดลอง ไม่ใช่คนใน IBM)
POST   /recalibrate/upload     ไฟล์ Excel/CSV หัวคอลัมน์ไทย ตรวจด้วยกฎเดียวกับหน้านำเข้า แล้วปรับเทียบ
GET    /recalibrate/history    ประวัติการปรับเทียบของบริษัท (ล่าสุดก่อน)
DELETE /recalibrate            ยกเลิกการปรับเทียบ กลับไปใช้คะแนนของโมเดลกลาง
"""

import logging
from typing import Literal, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sklearn.metrics import brier_score_loss

import auth
import batch_score
import calibration
import db
import model_store as ms
from routers import employee_upload as eu

router = APIRouter(tags=["localization"])
log = logging.getLogger(__name__)

MIN_ROWS = 50  # ponytail: ค่าขั้นต่ำแบบประมาณ ต่ำกว่านี้ผลปรับเทียบไม่น่าเชื่อถือ ปรับเมื่อทีมตกลง
MAX_ROWS = 10_000  # SEC-03 (~8 MB ไม่เกินเพดาน body ใน main.py)
DEMO_ROWS = 300
DEMO_SEED = 2026  # ไฟล์ทดลองเหมือนเดิมทุกครั้งที่ดาวน์โหลด
# รหัส 1..n เรียงต่อกัน: ไฟล์ปรับเทียบใช้แค่ข้อมูลในไฟล์ ไม่ได้เอารหัสไปหาพนักงานในระบบ จึงซ้ำกับ IBM ได้
# ชื่อจำลองตามเพศที่สุ่ม (หน้าตรวจไฟล์โชว์ให้ดูง่าย) ไม่ใช้คำนวณ
DEMO_FIRST_NAMES = {
    "Male": ["สมชาย", "วิชัย", "ประเสริฐ", "ธนพล", "อนันต์", "กิตติ", "ณัฐวุฒิ", "ศักดิ์ชัย", "พงศกร", "ธีรวัฒน์",
             "สุรเชษฐ์", "อภิชาติ", "ชยพล", "วรวุฒิ", "ภาณุ"],
    "Female": ["สมหญิง", "อรุณี", "กมลา", "ศิริพร", "นภา", "พิมพ์ชนก", "สุดารัตน์", "กนกวรรณ", "ปวีณา", "จิราพร",
               "วรรณา", "ธิดารัตน์", "มณีรัตน์", "อัญชลี", "ชุติมา"],
}
DEMO_LAST_NAMES = ["ใจดี", "สุขสันต์", "มั่นคง", "รุ่งเรือง", "ศรีสวัสดิ์", "แสงทอง", "บุญมา", "วงศ์ใหญ่", "ทองดี",
                   "จันทร์เพ็ญ", "พึ่งบุญ", "สมบูรณ์", "เจริญผล", "ชัยมงคล", "แก้วมณี", "ปัญญาดี", "สายสุข", "ภักดี"]
# ผลลาออกของพนักงานจำลอง = สุ่มจากคะแนนโมเดลที่ลดลง (logit - DEMO_SHIFT): สมมติว่า "บริษัทนี้" ลาออกน้อยกว่าที่โมเดลคิด
# เหมือนบริษัทจริงที่อัตราลาออกต่างจาก IBM หน้าปรับเทียบจึงมีอะไรให้ปรับให้เห็น
DEMO_SHIFT = 1.0
EXAMPLE_SCORES = (0.2, 0.4, 0.6, 0.8)  # ให้หน้าเว็บโชว์ว่าคะแนนเดิมเท่านี้ หลังปรับเป็นเท่าไหร่
# เงินเดือนจำลอง (บาท/เดือน) ต่อระดับตำแหน่ง ช่วงคร่าวๆ ของพนักงานออฟฟิศไทย (คู่มือเงินเดือนบริษัทจัดหางาน 2024–2025)
# เป็นข้อมูลสมมติ ไม่ใช่เงินเดือนจริงของบริษัทใด โมเดลเห็นแค่อันดับในบริษัท (income_scale.py) ช่วงจึงไม่ต้องแม่น
DEMO_SALARY_THB = {1: (15_000, 30_000), 2: (28_000, 50_000), 3: (45_000, 90_000), 4: (80_000, 160_000), 5: (150_000, 300_000)}

Method = Literal["platt", "isotonic"]


class RecalibrateRequest(BaseModel):
    tenant_id: Optional[str] = Field(None, pattern=calibration.TENANT_ID_PATTERN)  # ไม่ต้องส่ง ใช้บริษัทของผู้ login (ส่งบริษัทอื่น = 403)
    method: Method = "platt"  # DE-12: ตรงกับหน้าเว็บ isotonic กับข้อมูลไม่กี่ร้อยแถวได้ขั้นบันไดหยาบ
    # แต่ละแถว = พนักงาน 1 คน คอลัมน์เดียวกับ CSV ของ IBM รวม Attrition = "Yes"/"No"
    records: list[dict] = Field(min_length=MIN_ROWS, max_length=MAX_ROWS)


class Example(BaseModel):
    before: float
    after: float


class Bin(BaseModel):
    score: float  # คะแนนเดิมเฉลี่ยของคนในช่วงนี้
    rate: float  # สัดส่วนที่ลาออกจริงในไฟล์
    n: int


class RecalibrateResponse(BaseModel):
    tenant_id: str
    method: str
    n_samples: int
    positive_rate: float
    brier_before: float
    brier_after: float  # วัดบนข้อมูลชุดเดียวกับที่ใช้ fit จึงดูดีเกินจริงเล็กน้อย
    calibrated_at: str
    examples: list[Example] = []
    curve: list[Example] = []  # สูตรแปลงคะแนนทั้งเส้น (0–1 ทุก 0.02) ให้หน้าเว็บวาดกราฟ
    bins: list[Bin] = []  # อัตราลาออกจริงในไฟล์ แยกตามช่วงคะแนนเดิม (ช่วงละ 0.1 อย่างน้อย 5 คน)


class UploadResult(BaseModel):
    check: eu.ValidateResponse
    result: Optional[RecalibrateResponse] = None  # None = ไฟล์ยังไม่ผ่าน ดู check / message
    message: Optional[str] = None


def _fit(raw: pd.DataFrame, method: str, tenant_id: str) -> RecalibrateResponse:
    """raw = พนักงานคอลัมน์แบบ IBM + Attrition (Yes/No) เงินเดือนบาท
    เงินเดือนเทียบอันดับกับคนในไฟล์เอง (รวมคนที่ลาออกไปแล้ว) ไม่ใช่พนักงานปัจจุบันในระบบ"""
    labels = (raw["Attrition"] == "Yes").astype(int).to_numpy()
    if len(raw) < MIN_ROWS:
        raise HTTPException(422, f"ต้องมีพนักงานอย่างน้อย {MIN_ROWS} คน (มี {len(raw)} คน) ผลปรับเทียบจากข้อมูลน้อยกว่านี้ไม่น่าเชื่อถือ")
    if labels.min() == labels.max():
        raise HTTPException(422, "ต้องมีทั้งพนักงานที่ลาออกและที่ยังอยู่")
    try:
        scores = ms.risk_scores(ms.to_features(raw[sorted(ms.input_columns())], raw["MonthlyIncome"]))
    except (KeyError, ValueError, TypeError) as e:
        # SEC-08: ไม่ส่งรายละเอียดให้ผู้ใช้ และ log แค่ชนิด error (ข้อความ exception อาจมีค่าข้อมูลพนักงาน)
        log.warning("recalibrate: แปลงข้อมูลไม่ได้ (%s)", type(e).__name__)
        raise HTTPException(422, "ข้อมูลไม่ตรงรูปแบบ ตรวจว่าแต่ละคอลัมน์เป็นตัวเลข/ตัวเลือกเดียวกับไฟล์ตัวอย่าง")

    params = calibration.fit(scores, labels, method)
    record = {"method": method, "params": params}
    calibrated = calibration.apply(record, scores)
    metrics = {
        "brier_before": float(brier_score_loss(labels, scores)),
        "brier_after": float(brier_score_loss(labels, calibrated)),
    }
    saved = calibration.save(tenant_id, method, params, len(raw), float(np.mean(labels)), metrics)
    after = calibration.apply(record, np.array(EXAMPLE_SCORES))
    grid = np.linspace(0, 1, 51)
    edges = np.minimum((scores * 10).astype(int), 9)  # ช่วงคะแนน 0–0.1, 0.1–0.2, ...
    bins = [
        Bin(score=float(scores[edges == b].mean()), rate=float(labels[edges == b].mean()), n=int((edges == b).sum()))
        for b in range(10)
        if (edges == b).sum() >= 5
    ]
    return RecalibrateResponse(
        tenant_id=saved["tenant_id"],
        method=saved["method"],
        n_samples=saved["n_samples"],
        positive_rate=saved["positive_rate"],
        calibrated_at=saved["calibrated_at"],
        examples=[Example(before=b, after=float(a)) for b, a in zip(EXAMPLE_SCORES, after)],
        curve=[Example(before=float(g), after=float(a)) for g, a in zip(grid, calibration.apply(record, grid))],
        bins=bins,
        **metrics,
    )


@router.post("/recalibrate", response_model=RecalibrateResponse)
def recalibrate(req: RecalibrateRequest, background: BackgroundTasks, user: dict = Depends(auth.require_admin)):
    raw = pd.DataFrame(req.records)
    if ms.OFFICE_DAYS not in raw:  # ไม่บังคับ ไม่มี = เข้าออฟฟิศทุกวัน
        raw[ms.OFFICE_DAYS] = ms.FULL_WEEK
    missing = sorted((ms.input_columns() | {"Attrition"}) - set(raw.columns))
    if missing:
        raise HTTPException(422, f"ขาดคอลัมน์: {missing}")
    if not raw["Attrition"].isin(["Yes", "No"]).all():
        raise HTTPException(422, 'Attrition ต้องเป็น "Yes" หรือ "No" เท่านั้น')
    result = _fit(raw, req.method, user["tenant_id"])
    background.add_task(batch_score.refresh_in_background, user["tenant_id"])  # คะแนนปรับเทียบในตารางผลทำนายเปลี่ยน
    return result


def demo_employees(n: int = DEMO_ROWS, seed: int = DEMO_SEED) -> pd.DataFrame:
    """พนักงานจำลอง n คน (ไม่ใช่คนใน IBM ที่โมเดลเคยเห็นตอนเทรน) พร้อมผลลาออกที่สุ่มขึ้น
    แต่ละคนตั้งต้นจากคนใน IBM แบบสุ่ม แล้วสุ่มปรับอายุ เงินเดือน ระยะทาง ความพึงพอใจ OT ฯลฯ
    แผนก/ตำแหน่ง/ระดับยังคู่กันแบบสมเหตุสมผล และคุมให้ผ่านกฎของ schemas.EmployeeInput (อายุงาน <= อายุ ฯลฯ)"""
    rng = np.random.default_rng(seed)
    ibm = ms.reference_employees()  # ตั้งต้นจากคนใน IBM เสมอ ไม่ใช่พนักงานของบริษัทผู้ใช้
    df = ibm.iloc[rng.integers(0, len(ibm), n)].reset_index(drop=True).copy()
    jitter = lambda col, lo, hi: df[col] + rng.integers(lo, hi + 1, n)  # noqa: E731
    df["Age"] = jitter("Age", -4, 4).clip(18, 60)
    df["TotalWorkingYears"] = jitter("TotalWorkingYears", -2, 2).clip(lower=0).clip(upper=df["Age"] - 18)
    df["YearsAtCompany"] = jitter("YearsAtCompany", -2, 2).clip(lower=0).clip(upper=df["TotalWorkingYears"])
    for col in ("YearsInCurrentRole", "YearsSinceLastPromotion", "YearsWithCurrManager"):
        df[col] = df[col].clip(upper=df["YearsAtCompany"])
    df["NumCompaniesWorked"] = jitter("NumCompaniesWorked", -1, 1).clip(0, 9)
    df["DistanceFromHome"] = jitter("DistanceFromHome", -3, 3).clip(1, 29)
    low, high = (df["JobLevel"].map({lv: band[i] for lv, band in DEMO_SALARY_THB.items()}) for i in (0, 1))
    df["MonthlyIncome"] = (pd.Series(rng.uniform(low, high), index=df.index) / 100).round().astype(int) * 100
    df["PercentSalaryHike"] = jitter("PercentSalaryHike", -2, 2).clip(11, 25)
    for col in eu.SURVEY_FIELDS:  # 30% ของคนได้คำตอบแบบสำรวจใหม่
        redraw = rng.random(n) < 0.3
        df.loc[redraw, col] = rng.integers(1, 5, redraw.sum())
    flip = rng.random(n) < 0.15
    df.loc[flip, "OverTime"] = df.loc[flip, "OverTime"].map({"Yes": "No", "No": "Yes"})
    df["Gender"] = rng.choice(["Male", "Female"], n)
    for col, (lo, hi) in {"DailyRate": (102, 1499), "HourlyRate": (30, 100), "MonthlyRate": (2094, 26999)}.items():
        df[col] = rng.integers(lo, hi + 1, n)
    df["EmployeeNumber"] = range(1, n + 1)
    df = db.demo_labels(df)  # แผนก/ตำแหน่งภาษาไทยชุดเดียวกับข้อมูลทดลองในภาพรวม (8 ฝ่าย)
    df[eu.NAME[0]] = [f"{rng.choice(DEMO_FIRST_NAMES[g])} {rng.choice(DEMO_LAST_NAMES)}" for g in df["Gender"]]
    score = np.clip(ms.risk_scores(ms.to_features(df, df["MonthlyIncome"])), 1e-6, 1 - 1e-6)  # เทียบอันดับในกลุ่มจำลองเอง
    true_p = 1 / (1 + np.exp(-(np.log(score / (1 - score)) - DEMO_SHIFT)))
    df["Attrition"] = np.where(rng.random(n) < true_p, "Yes", "No")
    return df


@router.get("/recalibrate/template")
def recalibrate_template(demo: bool = False, _: dict = Depends(auth.require_admin)):
    """demo=false: หัวคอลัมน์ + 2 แถวตัวอย่าง, demo=true: พนักงานจำลอง 300 คนพร้อมผลลาออก ไว้ทดลองปรับเทียบ"""
    rows = demo_rows(demo_employees(), label=True) if demo else eu._example_rows(2, label=True)
    name = "recalibrate_demo.xlsx" if demo else "recalibrate_template.xlsx"
    return eu.template_response(rows, [*eu.TEMPLATE_COLUMNS, eu.LABEL], name)


def demo_rows(people: pd.DataFrame, label: bool) -> list[dict]:
    """พนักงานจำลอง -> แถวในไฟล์ Excel (template_rows ไม่รู้จักช่องที่ใช้แสดงผล ใส่ชื่อ/แผนก/ตำแหน่งเพิ่มตามลำดับแถว)"""
    shown = people[[f for f, _, _ in eu.DISPLAY]].to_dict("records")
    return [r | {th: s[f] for f, th, _ in eu.DISPLAY} for r, s in zip(eu.template_rows(people, label), shown)]


@router.post("/recalibrate/upload", response_model=UploadResult)
def recalibrate_upload(  # def ไม่ใช่ async: ตรวจไฟล์ + fit ใน threadpool ไม่บล็อก request อื่น (SEC-15)
    background: BackgroundTasks,
    file: UploadFile = File(...),
    method: Method = Form("platt"),
    user: dict = Depends(auth.require_admin),
):
    valid, check = eu._check(file, label=True)
    if check.missing_columns or check.n_invalid or not valid:
        return UploadResult(check=check, message="ไฟล์ยังมีคอลัมน์ที่ขาดหรือแถวที่ผิด แก้แล้วอัปโหลดใหม่")
    result = _fit(eu.whole_baht(pd.DataFrame(valid)), method, user["tenant_id"])
    background.add_task(batch_score.refresh_in_background, user["tenant_id"])
    return UploadResult(check=check, result=result)


@router.get("/recalibrate/history")
def recalibrate_history(user: dict = Depends(auth.current_user)):
    return {"tenant_id": user["tenant_id"], "history": calibration.history(user["tenant_id"])}


@router.delete("/recalibrate")
def recalibrate_reset(background: BackgroundTasks, user: dict = Depends(auth.require_admin)):
    removed = calibration.reset(user["tenant_id"])
    background.add_task(batch_score.refresh_in_background, user["tenant_id"])
    return {"tenant_id": user["tenant_id"], "removed": removed}
