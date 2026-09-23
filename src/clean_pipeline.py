"""ไปป์ไลน์ทำความสะอาดข้อมูล (Data Cleaning) สำหรับ IBM HR Analytics Employee Attrition dataset

รวมผลงานจากโน้ตบุ๊กของ Saphondanai (`01_cleaning_S.ipynb`) และของ Puripat
(`01_cleaning_P.ipynb`) ในสัปดาห์ที่ 1 ตามที่ระบุใน TASKS.md
งาน feature engineering ในสัปดาห์ที่ 2-3 ควร import ฟังก์ชัน `clean_data`
จากไฟล์นี้ไปใช้ต่อ ไม่ควรเขียน logic การ clean ซ้ำใหม่
"""

import pandas as pd

# คอลัมน์ที่ค่าคงที่ทุกแถว (zero variance) หรือเป็นแค่ตัวระบุแถว (identifier)
# ไม่ใช่ปัญหา data leakage แต่เป็น "noise" ที่ไม่มีประโยชน์ต่อการเทรนโมเดล
# ตรวจสอบตาม README หัวข้อ 6.2 Data Leakage Guard แล้ว: ทุกคอลัมน์ที่เหลือ
# ถูกบันทึก ณ ตอนรับเข้างาน/ตอนถ่ายภาพข้อมูล (snapshot) ไม่ใช่หลังจากพนักงาน
# ตัดสินใจลาออกแล้ว จึงไม่มีคอลัมน์ไหนถูกตัดออกเพราะเหตุผลเรื่อง leakage
NOISE_COLUMNS = ["EmployeeCount", "StandardHours", "Over18", "EmployeeNumber"]

TARGET_COLUMN = "Attrition"

# BusinessTravel มีลำดับความถี่ตามธรรมชาติ จึงเข้ารหัสแบบ ordinal
# แทนที่จะทำ one-hot เพื่อให้โมเดลเรียนรู้ความสัมพันธ์แบบเป็นลำดับได้
BUSINESS_TRAVEL_ORDER = {
    "Non-Travel": 0,
    "Travel_Rarely": 1,
    "Travel_Frequently": 2,
}

# คอลัมน์หมวดหมู่แบบ binary (มีแค่ 2 ค่า) -> เข้ารหัสเป็น {0, 1}
BINARY_COLUMNS = {
    "OverTime": {"No": 0, "Yes": 1},
    "Gender": {"Female": 0, "Male": 1},
}

# คอลัมน์หมวดหมู่แบบ nominal (ไม่มีลำดับ) -> เข้ารหัสแบบ one-hot
NOMINAL_COLUMNS = ["Department", "EducationField", "JobRole", "MaritalStatus"]


def load_raw_data(path: str) -> pd.DataFrame:
    return pd.read_csv(path)


def check_missing(df: pd.DataFrame) -> pd.Series:
    """คืนค่าจำนวน missing value ของแต่ละคอลัมน์ (จะเป็น 0 ทุกคอลัมน์ถ้าข้อมูลสมบูรณ์)"""
    return df.isna().sum().sort_values(ascending=False)


def drop_noise_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.drop(columns=[c for c in NOISE_COLUMNS if c in df.columns])


def encode_target(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df[TARGET_COLUMN] = df[TARGET_COLUMN].map({"No": 0, "Yes": 1}).astype(int)
    return df


def encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    if "BusinessTravel" in df.columns:
        df["BusinessTravel"] = df["BusinessTravel"].map(BUSINESS_TRAVEL_ORDER)

    for col, mapping in BINARY_COLUMNS.items():
        if col in df.columns:
            df[col] = df[col].map(mapping)

    nominal_present = [c for c in NOMINAL_COLUMNS if c in df.columns]
    if nominal_present:
        df = pd.get_dummies(df, columns=nominal_present, prefix=nominal_present, dtype=int)

    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """ไปป์ไลน์ทำความสะอาดข้อมูลฉบับเต็มของสัปดาห์ที่ 1: ตัดคอลัมน์ noise,
    เข้ารหัสตัวแปรเป้าหมายและตัวแปรหมวดหมู่

    ฟังก์ชันนี้สมมติว่า `df` ไม่มี missing value (จริงสำหรับไฟล์ CSV ดิบของ
    IBM) ถ้าข้อมูลแหล่งอื่นในอนาคตมี missing value ต้องจัดการ (impute) ก่อน
    เรียกฟังก์ชันนี้ เพื่อให้เห็นวิธีจัดการชัดเจนและตรวจสอบได้
    """
    df = drop_noise_columns(df)
    df = encode_target(df)
    df = encode_categoricals(df)
    return df


def save_processed(df: pd.DataFrame, path: str) -> None:
    df.to_csv(path, index=False)
