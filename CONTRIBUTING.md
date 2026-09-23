# Contributing Guide

กติกาการทำงานร่วมกันของทีม (นอกเหนือจากแผนงานใน [TASKS.md](TASKS.md) และ [README.md](README.md))

## Commit Message

**รูปแบบ:**

```
<บรรทัดแรก: สรุปสั้นๆ ว่าทำอะไร ใช้กริยารูปคำสั่ง ไม่เกิน ~70 ตัวอักษร>

<เว้นบรรทัดว่าง แล้วอธิบายเพิ่ม 1-3 บรรทัดว่า "ทำไม" ถึงทำ (ถ้าจำเป็น)>
```

**หลักการ:**

- บรรทัดแรกใช้กริยารูปคำสั่ง (imperative) เช่น `Add`, `Fix`, `Update`, `Remove` — ไม่ใช่ `Added`/`Fixed` เพราะเขียนต่อจาก "This commit will..." ได้พอดี
- บรรทัดแรกบอกว่า **"ทำอะไร"** ให้คนอื่นเข้าใจได้ทันทีจากแค่ `git log --oneline` ไม่ต้องเปิดดู diff
- ส่วนอธิบายเพิ่มเติม (ถ้ามี) เน้น **"ทำไม"** ถึงทำแบบนี้ ไม่ใช่ไล่บอกว่าแก้บรรทัดไหนบ้าง เพราะ `git diff` บอกอยู่แล้ว
- 1 commit ทำ 1 เรื่อง — ถ้างานสองเรื่องไม่เกี่ยวกัน (เช่น แก้โค้ด data cleaning + แก้ README) แยกเป็นคนละ commit เพื่อให้ review/revert ทีละเรื่องได้ง่าย

**ตัวอย่าง:**

```
Add wk1 data cleaning notebook and shared pipeline

Download IBM HR dataset via kagglehub, clean it (drop noise
columns, encode target + categoricals) in 01_cleaning_S.ipynb,
and extract the logic into src/clean_pipeline.py for the team
to reuse in wk2-3 feature engineering.
```

```
Fix broken Mermaid diagram in README
```
