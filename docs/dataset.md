# Dataset Card: IBM HR Analytics Employee Attrition & Performance

ข้อมูลในหน้านี้ตรวจจากหน้า dataset บน Kaggle และ Kaggle API เมื่อ 30 ก.ย. 2026

## ที่มา

| รายการ | ค่า |
| :--- | :--- |
| ชื่อ | IBM HR Analytics Employee Attrition & Performance |
| คำโปรย | "Predict attrition of your valuable employees" |
| ลิงก์ | https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset |
| ผู้อัปโหลดบน Kaggle | pavansubhash (บัญชีบุคคล ไม่ใช่บัญชีทางการของ IBM) |
| ผู้สร้างข้อมูล | IBM data scientists (ตามคำอธิบายบน Kaggle) |
| อัปเดตล่าสุด / เวอร์ชัน | 31 มี.ค. 2017 / version 1 |
| ไฟล์ที่ใช้ | `WA_Fn-UseC_-HR-Employee-Attrition.csv` (~228 KB, 1,470 แถว × 35 คอลัมน์) |
| วิธีโหลดในโปรเจกต์ | `kagglehub.dataset_download("pavansubhasht/ibm-hr-analytics-attrition-dataset")` ใน [src/clean_pipeline.py](../src/clean_pipeline.py) |

## สัญญาอนุญาต (License)

Kaggle ระบุว่า "Database: Open Database, Contents: Database Contents" หมายถึงใช้ 2 สัญญาคู่กัน:

- ตัวฐานข้อมูล (โครงสร้าง การคัดเลือก และการจัดเรียงข้อมูล): [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- เนื้อหาแต่ละค่าในฐานข้อมูล: [Database Contents License (DbCL) v1.0](https://opendatacommons.org/licenses/dbcl/1-0/)

สิ่งที่อนุญาต: คัดลอก แจกจ่าย ดัดแปลง และใช้งาน รวมถึงใช้เชิงพาณิชย์

เงื่อนไขที่ต้องทำตาม:

1. Attribute (ให้เครดิต): ถ้าเผยแพร่ฐานข้อมูลนี้หรือฐานข้อมูลที่ดัดแปลงจากมัน ต้องแจ้งว่าใช้ ODbL และบอกที่มา ถ้าเผยแพร่ Produced Work (สิ่งที่สร้างจากฐานข้อมูล เช่น กราฟ รายงาน หรือโมเดลที่เทรนจากข้อมูลนี้) ต่อสาธารณะ ต้องมีข้อความแจ้งที่มาด้วย
2. Share-Alike: ถ้าเผยแพร่ฐานข้อมูลที่ดัดแปลง (Derivative Database) ต่อสาธารณะ ต้องเผยแพร่ภายใต้ ODbL เหมือนกัน เงื่อนไขนี้ใช้กับตัวข้อมูลเท่านั้น ไม่ครอบคลุมโค้ดหรือ Produced Work
3. Keep open: ถ้าแจกจ่ายฐานข้อมูลในรูปแบบที่ใส่ DRM หรือล็อกไว้ ต้องแจกเวอร์ชันที่ไม่ล็อกให้ด้วย

### ผลต่อโปรเจกต์นี้

| สิ่งในโปรเจกต์ | สถานะตาม ODbL | สิ่งที่ต้องทำ |
| :--- | :--- | :--- |
| `data/raw/WA_Fn-UseC_-HR-Employee-Attrition.csv` (อยู่ใน git) | ตัวฐานข้อมูลเดิม | แจ้ง license และที่มาไว้ใน [data/README.md](../data/README.md) (ทำแล้ว) |
| `data/processed/*.csv` (ผลการ clean) | Derivative Database | ถ้า repo เป็น public ไฟล์เหล่านี้อยู่ภายใต้ ODbL ด้วย (แจ้งไว้ใน data/README.md แล้ว) |
| โมเดล XGBoost, SHAP, กราฟ, รายงาน, สไลด์ | Produced Work | ใส่เครดิต dataset ในรายงาน สไลด์ และหน้า About ของเว็บ |
| โค้ด (Python/React) | ไม่อยู่ใต้ ODbL | เลือก license ของโค้ดเองได้ |

ข้อความเครดิตที่ใช้ในรายงาน สไลด์ และหน้าเว็บ:

> Dataset: "IBM HR Analytics Employee Attrition & Performance" (fictional data created by IBM data scientists), retrieved from Kaggle (https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset), licensed under ODbL v1.0 (database) and DbCL v1.0 (contents).

### ข้อควรระวัง

- ที่มาต้นทางไม่ได้มาจาก IBM โดยตรง ผู้อัปโหลดเป็นบุคคลทั่วไป ข้อมูลชุดนี้เดิมเผยแพร่เป็น sample data ของ IBM Watson Analytics แต่ Kaggle ไม่ได้ลิงก์ไปยังแหล่งต้นทางของ IBM หรือระบุเงื่อนไขเดิมของ IBM สัญญาอนุญาตที่อ้างได้จึงมีแค่ ODbL/DbCL ที่ผู้อัปโหลดเลือกไว้บน Kaggle
- ส่วนนี้ไม่ใช่คำปรึกษาทางกฎหมาย ถ้าจะนำไปขายจริง ควรให้ฝ่ายกฎหมายตรวจอีกครั้ง แนวทางที่ปลอดภัยคือ ผลิตภัณฑ์ขายซอฟต์แวร์ และให้บริษัทลูกค้าใช้ข้อมูลของตัวเอง (ดู README หัวข้อ 6.5) ส่วน IBM dataset ใช้แค่เทรนโมเดลตั้งต้นและเดโม พร้อมใส่เครดิตตามด้านบน

## ลักษณะข้อมูล (ตามคำอธิบายบน Kaggle)

คำอธิบายต้นฉบับ:

> "Uncover the factors that lead to employee attrition and explore important questions such as 'show me a breakdown of distance from home by job role and attrition' or 'compare average monthly income by education and attrition'. This is a fictional data set created by IBM data scientists."

- เป็นข้อมูลสมมติ (fictional/synthetic) ไม่ใช่ข้อมูลพนักงานจริง จึงไม่มีข้อมูลส่วนบุคคลของคนจริง และตัว dataset ไม่ติดเงื่อนไข PDPA ข้อเสียคือผลที่ได้ใช้เป็นหลักฐานพฤติกรรมของพนักงานจริงไม่ได้
- Kaggle ไม่ได้อธิบายวิธีสร้างข้อมูล การกระจายตัว หรือประเทศ/อุตสาหกรรมที่ใช้อ้างอิง (บริบทเป็นแบบอเมริกัน ดู README หัวข้อ 4 เรื่อง Localization)

### ความหมายของคอลัมน์ที่เป็นรหัส (จากหน้า Kaggle)

| คอลัมน์ | 1 | 2 | 3 | 4 | 5 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Education` | Below College | College | Bachelor | Master | Doctor |
| `EnvironmentSatisfaction` | Low | Medium | High | Very High | |
| `JobInvolvement` | Low | Medium | High | Very High | |
| `JobSatisfaction` | Low | Medium | High | Very High | |
| `PerformanceRating` | Low | Good | Excellent | Outstanding | |
| `RelationshipSatisfaction` | Low | Medium | High | Very High | |
| `WorkLifeBalance` | Bad | Good | Better | Best | |

คอลัมน์อื่นไม่มีคำอธิบายบน Kaggle ส่วนที่ทีมตัดทิ้งเพราะไม่มีข้อมูล (มีค่าเดียวทั้งคอลัมน์หรือเป็นรหัส) ดูใน [src/clean_pipeline.py](../src/clean_pipeline.py)
