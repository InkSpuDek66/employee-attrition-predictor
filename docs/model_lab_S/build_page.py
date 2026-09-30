"""สร้าง docs/model_lab_S/index.html จากผลของ notebook 05 + 06

รัน (จากรากโปรเจกต์) หลังรัน notebooks/05_model_comparison_S.ipynb และ 06_param_sweep_S.ipynb:
    python docs/model_lab_S/build_page.py

- results.json มาจาก 05 (ผลเทียบโมเดล), sweeps.json มาจาก 06 (กราฟปรับค่า + threshold + CV แบบ nested)
- ฝังข้อมูลลง page_template.html ตรงตำแหน่ง __DATA__ ได้ไฟล์ HTML ไฟล์เดียว เปิดในเบราว์เซอร์ได้เลย
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name: str) -> dict:
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        return json.load(f)


def build() -> str:
    data = load("results.json")
    extra = load("sweeps.json")
    for name, model in data["models"].items():
        model.pop("trials", None)  # หน้าเว็บไม่ใช้ ลดขนาดไฟล์
        model["cv"].update(extra["nested"].get(name, {}))
    data["sweeps"], data["threshold_curve"] = extra["sweeps"], extra["threshold_curve"]

    # กัน "</script>" ในข้อความปิด tag ก่อนเวลา
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    with open(os.path.join(HERE, "page_template.html"), encoding="utf-8") as f:
        page = f.read().replace("__DATA__", payload)
    out = os.path.join(HERE, "index.html")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(page)
    return out


if __name__ == "__main__":
    print("written", build())
