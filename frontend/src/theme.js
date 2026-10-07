// ค่าคงที่และ helper ที่ SHAP Viewer กับ What-if Simulator ใช้ร่วมกัน

// เกณฑ์ระดับตาม README 6.1 ชุดเดียวกับ src/business_rules.py (MEDIUM_RISK / HIGH_RISK) แก้ต้องแก้คู่กัน
export const LOW = 0.4
export const HIGH = 0.7

// สีกราฟ (recharts รับ class ไม่ได้) ชุดเดียวกับ token ใน index.css แยกตามธีม
export const CHART = {
  light: { up: '#ef4444', down: '#0070f3', axis: '#71717a', label: '#09090b', grid: '#e4e4e7', hover: '#f4f4f5', bg: '#ffffff' },
  dark: { up: '#f87171', down: '#3291ff', axis: '#a1a1aa', label: '#fafafa', grid: '#27272a', hover: '#1c1c1f', bg: '#111113' },
}

// เงิน: ถือว่า MonthlyIncome ใน IBM dataset เป็นดอลลาร์ (แนวเดียวกับ src/app_pages/whatif_page.py)
// หน้าเว็บรับ/แสดงเป็นบาท แล้วหารด้วยอัตราแลกเปลี่ยนก่อนส่งเข้าโมเดล
export const DEFAULT_RATE = 35
export const INCOME_RANGE_USD = [1009, 19999] // ช่วง MonthlyIncome ใน data/raw (นอกช่วงนี้โมเดลไม่เคยเห็น)
export const INCOME_MIN_BAHT = 15000 // ขั้นต่ำของช่อง/แถบเงินเดือน (ต่ำกว่าช่วง dataset ได้ แต่จะมีคำเตือน)
export const baht = (v) => `${Math.round(v).toLocaleString()} บาท`
const INCOME_STEP = 500 // แถบเลื่อนเงินเดือนขยับทีละ 500 บาท

// ขอบเขตช่อง/แถบเงินเดือนเป็นบาท: ขั้นต่ำคงที่ ขั้นสูงคิดจาก 20,000 ดอลลาร์ × อัตรา (ปัดเป็นขั้นแถบ)
export const incomeBounds = (rate) => [INCOME_MIN_BAHT, Math.round((20000 * rate) / INCOME_STEP) * INCOME_STEP]

// แปลงข้อความที่พิมพ์ในช่องเงินเดือน ("50,000") เป็นบาทในขอบเขต พิมพ์มั่ว/ว่าง = คืนค่าเดิม
export function parseIncomeBaht(text, rate, fallback) {
  const [min, max] = incomeBounds(rate)
  const n = Number(String(text).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

// changes ที่ส่งเข้า backend: เงินเดือนเก็บเป็นดอลลาร์ทศนิยม (ให้ช่องโชว์บาทตรงที่กรอก) แต่ API รับจำนวนเต็ม
export const toApiChanges = (changes) =>
  'MonthlyIncome' in changes ? { ...changes, MonthlyIncome: Math.round(changes.MonthlyIncome) } : changes

// อัตราแลกเปลี่ยนที่ผู้ใช้ตั้งไว้ จำในเบราว์เซอร์ รีเฟรชแล้วไม่กลับเป็นค่าตั้งต้น
export function loadRate() {
  try {
    const v = Number(localStorage.getItem('thbPerUsd'))
    return v > 0 ? v : DEFAULT_RATE
  } catch {
    return DEFAULT_RATE
  }
}

export function saveRate(v) {
  try {
    localStorage.setItem('thbPerUsd', String(v))
  } catch {
    // storage ปิด: ใช้ได้แต่ไม่จำ
  }
}
// ช่วงสีของแถบคะแนน ต่ำ / กลาง / สูง
export const GAUGE = ['#22c55e', '#eab308', '#ef4444']

export const inputClass =
  'h-11 w-full rounded-lg border border-line bg-card px-3 text-fg outline-none transition-colors duration-200 placeholder:text-muted-fg/60 hover:border-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/20'

export const BAND = {
  Low: { th: 'ต่ำ', text: 'text-risk-low', pill: 'bg-risk-low-soft text-risk-low ring-risk-low/15' },
  Medium: { th: 'ปานกลาง', text: 'text-risk-mid', pill: 'bg-risk-mid-soft text-risk-mid ring-risk-mid/15' },
  High: { th: 'สูง', text: 'text-risk-high', pill: 'bg-risk-high-soft text-risk-high ring-risk-high/15' },
}

export const bandOf = (score) => (score < LOW ? 'Low' : score < HIGH ? 'Medium' : 'High')

// ผู้ช่วยในหน้า (Mascot.jsx) ลำดับนี้ใช้ทั้งปุ่มเลือกและหน้าขอโทษ ตัวที่เลือกจำใน localStorage
export const MASCOTS = ['chibiGirl', 'chibiBoy', 'cat', 'dog']

export function loadMascot() {
  try {
    const v = localStorage.getItem('mascot')
    return MASCOTS.includes(v) ? v : MASCOTS[0]
  } catch {
    return MASCOTS[0]
  }
}

export function saveMascot(v) {
  try {
    localStorage.setItem('mascot', v)
  } catch {
    // storage ปิด: เลือกได้แต่ไม่จำ
  }
}

export function friendly(err) {
  return err.message === 'Failed to fetch' ? 'ติดต่อ backend ไม่ได้ — เปิด uvicorn ที่ port 8000 หรือยัง' : err.message
}

export async function api(path, options) {
  const res = await fetch(`/api${path}`, options)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(typeof body?.detail === 'string' ? body.detail : `เรียก API ไม่สำเร็จ (${res.status})`)
    err.status = res.status // 404 = ไม่พบพนักงาน (กรอกผิด) แยกจากระบบพัง
    throw err
  }
  return body
}
