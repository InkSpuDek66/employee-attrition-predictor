"""ลองรันโมเดลที่ register ไว้ใน MLflow (ตัวทดลอง) กับ test set ชุดเดียวกับ notebook 04

รัน: python src/predict_demo.py   (จากรากโปรเจกต์ ต้องมี mlflow.db จากการรัน notebook 04 ก่อน)
"""

import os
import sys

import mlflow.xgboost
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from clean_pipeline import RAW_FILENAME, clean_data, load_raw_data
from feature_pipeline import SELECTED_FEATURES, add_features

mlflow.set_tracking_uri("sqlite:///mlflow.db")
model = mlflow.xgboost.load_model("models:/attrition-xgboost-P/1")

df = add_features(clean_data(load_raw_data(f"data/raw/{RAW_FILENAME}")), only=SELECTED_FEATURES)
X, y = df.drop(columns="Attrition"), df["Attrition"]
_, Xte, _, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)  # ต้องตรงกับ notebook 04

risk = model.predict_proba(Xte[model.feature_names_in_])[:, 1]
print(f"test rows: {len(yte)} | actual leavers: {yte.sum()} | AUC: {roc_auc_score(yte, risk):.3f}\n")

top = Xte.assign(risk_score=risk.round(3), actually_left=yte).sort_values("risk_score", ascending=False)
print("10 คนที่โมเดลมองว่าเสี่ยงสุด:")
print(top[["risk_score", "actually_left", "OverTime", "JobLevel", "MonthlyIncome", "Age"]].head(10).to_string())

for t in (0.5, 0.3):
    print(f"\nthreshold {t}:")
    print(classification_report(yte, risk > t, target_names=["stay", "leave"], digits=2))
