"""เทรนโมเดล XGBoost ตัวที่เสนอเป็นตัวสุดท้าย (ชุดฟีเจอร์ + hyperparameter ของ Puripat) แล้ว register เข้า MLflow

ใช้แทนการรัน notebook เมื่อต้องการโมเดลที่ทำซ้ำได้ เช่น เทรนตัวสุดท้ายครั้งเดียวบน MLflow กลาง หรือให้ CI เทรนก่อนรัน test
รัน (จากรากโปรเจกต์): python src/train.py [--name attrition-xgboost-P]
MLflow ปลายทางตาม .env (ดู src/mlflow_setup.py) test AUC ประมาณ 0.81 แต่ไม่ได้โมเดลตัวเดียวกันทุกเครื่อง
เพราะ XGBoost ให้ผลต่างกันตามจำนวน thread และ OS แม้ seed เดียวกัน ตัวเลขในรายงานจึงต้องมาจากโมเดลที่ register แล้ว
"""

import argparse
import hashlib
import os
import platform
import sys

import mlflow
import mlflow.xgboost
import numpy as np
import pandas as pd
from mlflow.models import infer_signature
from sklearn.metrics import average_precision_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from xgboost import XGBClassifier

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import mlflow_setup  # noqa: E402
from clean_pipeline import RAW_FILENAME, TARGET_COLUMN, clean_data, load_raw_data  # noqa: E402
from feature_pipeline import SELECTED_FEATURES, add_features  # noqa: E402

# ผล Optuna ของ Puripat (notebooks/04_tuning_P.ipynb) ตัวเดียวกับ P_BEST ใน notebooks/04_tuning_S.ipynb
PARAMS = {"n_estimators": 500, "max_depth": 2, "learning_rate": 0.03132429398213804, "subsample": 0.664952951683747,
          "colsample_bytree": 0.5305253930212119, "min_child_weight": 10, "reg_lambda": 1.2338780559789992}
N_JOBS = 4  # จำนวน thread มีผลต่อโมเดลที่ได้ จึงบันทึกเป็น tag ด้วย
# เกณฑ์ขั้นต่ำก่อน register (CI fail ถ้าต่ำกว่านี้) ต่ำกว่าช่วงที่วัดได้จริง 0.805-0.815 พอให้ไม่ fail เพราะต่างเครื่อง
MIN_TEST_AUC = 0.75
RAW_PATH = f"data/raw/{RAW_FILENAME}"  # relative เพราะ source ถูก log ขึ้น MLflow ห้ามมี path ในเครื่อง


def bootstrap_auc_ci(y, p, n=1000, seed=42):
    """95% CI ของ AUC โดยสุ่มแถว test ซ้ำแบบใส่คืน (วิธีเดียวกับ notebooks/07_imbalance_S.ipynb หัวข้อ 5)"""
    rng = np.random.default_rng(seed)
    aucs = [roc_auc_score(y[i], p[i]) for i in (rng.integers(0, len(y), len(y)) for _ in range(n))]
    return np.percentile(aucs, [2.5, 97.5])


def train(name: str) -> str:
    raw = load_raw_data(os.path.join(mlflow_setup.ROOT, RAW_PATH))
    df = add_features(clean_data(raw), only=SELECTED_FEATURES)
    X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)  # เหมือน notebook 04
    spw = (ytr == 0).sum() / (ytr == 1).sum()
    model = XGBClassifier(**PARAMS, scale_pos_weight=spw, random_state=42, n_jobs=N_JOBS).fit(Xtr, ytr)

    p = model.predict_proba(Xte)[:, 1]
    cv_auc = cross_val_score(XGBClassifier(**PARAMS, scale_pos_weight=spw, random_state=42, n_jobs=N_JOBS), Xtr, ytr,
                             cv=StratifiedKFold(5, shuffle=True, random_state=42), scoring="roc_auc")
    ci_low, ci_high = bootstrap_auc_ci(yte.to_numpy(), p)
    metrics = {"test_auc": roc_auc_score(yte, p), "test_pr_auc": average_precision_score(yte, p),
               "test_f1": f1_score(yte, p > 0.5), "test_auc_ci_low": ci_low, "test_auc_ci_high": ci_high,
               "cv_auc_mean": cv_auc.mean(), "cv_auc_std": cv_auc.std()}
    print({k: round(float(v), 3) for k, v in metrics.items()})
    if metrics["test_auc"] < MIN_TEST_AUC:
        sys.exit(f"test AUC {metrics['test_auc']:.3f} ต่ำกว่าเกณฑ์ {MIN_TEST_AUC} ไม่ register โมเดล")

    with mlflow.start_run(run_name=f"train-{name}"):
        # mlflow.source.name ค่าเดิมเป็น path เต็มในเครื่อง (MLflow ติด commit ของ git ให้เองใน mlflow.source.git.commit)
        mlflow.set_tags({"source": "src/train.py", "mlflow.source.name": "src/train.py", "feature_set": "P_selected",
                         "platform": platform.platform(), "n_jobs": N_JOBS, "cpu_count": os.cpu_count(),
                         # hash จากค่าในตาราง ไม่ใช่ byte ของไฟล์ จึงไม่เปลี่ยนตาม line ending ของแต่ละ OS
                         "data_sha256": hashlib.sha256(pd.util.hash_pandas_object(raw, index=False).values).hexdigest()})
        mlflow.log_input(mlflow.data.from_pandas(raw, source=RAW_PATH, name="ibm-hr-raw"), context="training")
        mlflow.log_params({**PARAMS, "scale_pos_weight": round(spw, 2), "n_features": X.shape[1]})
        mlflow.log_metrics(metrics)
        # ใช้แค่ signature ไม่ใส่ input_example เพราะจะอัปโหลดแถวข้อมูลพนักงานขึ้น MLflow ซึ่งบน DagsHub เป็นสาธารณะ
        info = mlflow.xgboost.log_model(model, name="model", registered_model_name=name,
                                        signature=infer_signature(Xtr, model.predict(Xtr)))
    return f"models:/{name}/{info.registered_model_version}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="attrition-xgboost-P", help="ชื่อใน MLflow Model Registry")
    args = parser.parse_args()
    print("MLflow:", mlflow_setup.setup("attrition-xgboost-train"))
    print("registered:", train(args.name))
