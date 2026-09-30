"""เทรนโมเดล XGBoost ตัวที่เสนอเป็นตัวสุดท้าย (ชุดฟีเจอร์ + hyperparameter ของ Puripat) แล้ว register เข้า MLflow

ใช้แทนการรัน notebook เมื่อต้องการโมเดลที่ทำซ้ำได้ เช่น เทรนตัวสุดท้ายครั้งเดียวบน MLflow กลาง หรือให้ CI เทรนก่อนรัน test
รัน (จากรากโปรเจกต์): python src/train.py [--name attrition-xgboost-P]
MLflow ปลายทางตาม .env (ดู src/mlflow_setup.py) ค่าที่ได้ควรตรงกับ notebooks/04_tuning_S.ipynb (test AUC ~0.81)
"""

import argparse
import os
import sys

import mlflow
import mlflow.xgboost
from sklearn.metrics import average_precision_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import mlflow_setup  # noqa: E402
from clean_pipeline import RAW_FILENAME, TARGET_COLUMN, clean_data, load_raw_data  # noqa: E402
from feature_pipeline import SELECTED_FEATURES, add_features  # noqa: E402

# ผล Optuna ของ Puripat (notebooks/04_tuning_P.ipynb) ตัวเดียวกับ P_BEST ใน notebooks/04_tuning_S.ipynb
PARAMS = {"n_estimators": 500, "max_depth": 2, "learning_rate": 0.03132429398213804, "subsample": 0.664952951683747,
          "colsample_bytree": 0.5305253930212119, "min_child_weight": 10, "reg_lambda": 1.2338780559789992}


def train(name: str) -> str:
    df = add_features(clean_data(load_raw_data(os.path.join(mlflow_setup.ROOT, "data", "raw", RAW_FILENAME))),
                      only=SELECTED_FEATURES)
    X, y = df.drop(columns=TARGET_COLUMN), df[TARGET_COLUMN]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)  # เหมือน notebook 04
    spw = (ytr == 0).sum() / (ytr == 1).sum()
    model = XGBClassifier(**PARAMS, scale_pos_weight=spw, random_state=42, n_jobs=4).fit(Xtr, ytr)

    p = model.predict_proba(Xte)[:, 1]
    metrics = {"test_auc": roc_auc_score(yte, p), "test_pr_auc": average_precision_score(yte, p),
               "test_f1": f1_score(yte, p > 0.5)}
    with mlflow.start_run(run_name=f"train-{name}"):
        mlflow.set_tags({"source": "src/train.py", "feature_set": "P_selected"})
        mlflow.log_params({**PARAMS, "scale_pos_weight": round(spw, 2), "n_features": X.shape[1]})
        mlflow.log_metrics(metrics)
        info = mlflow.xgboost.log_model(model, name="model", registered_model_name=name, input_example=Xte.head(3))
    print({k: round(v, 3) for k, v in metrics.items()})
    return f"models:/{name}/{info.registered_model_version}"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="attrition-xgboost-P", help="ชื่อใน MLflow Model Registry")
    args = parser.parse_args()
    print("MLflow:", mlflow_setup.setup("attrition-xgboost-train"))
    print("registered:", train(args.name))
