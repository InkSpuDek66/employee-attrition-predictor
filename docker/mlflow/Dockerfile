# MLflow tracking server + driver PostgreSQL (image ทางการไม่มี psycopg2)
# เวอร์ชันต้องตรงกับ mlflow ฝั่ง client ใน .venv ของทีม
FROM ghcr.io/mlflow/mlflow:v3.16.1
RUN pip install --no-cache-dir psycopg2-binary
