import { useEffect, useRef, useState } from 'react'
// ค่าคงที่และ helper ที่ SHAP Viewer กับ What-if Simulator ใช้ร่วมกัน

// เกณฑ์ระดับตาม README 6.1 ชุดเดียวกับ src/business_rules.py (MEDIUM_RISK / HIGH_RISK) แก้ต้องแก้คู่กัน
export const LOW = 0.4
export const HIGH = 0.7

// เงิน: ถือว่า MonthlyIncome ใน IBM dataset เป็นดอลลาร์ (แนวเดียวกับ src/app_pages/whatif_page.py)
// หน้าเว็บรับ/แสดงเป็นบาท แล้วหารด้วยอัตรานี้ก่อนส่งเข้าโมเดล ผู้ใช้ปรับไม่ได้และไม่เห็นดอลลาร์
// อัตราจริงอยู่ที่ src/business_rules.py (DE-01) backend ส่งมาตอน login ค่าด้านล่างเป็นค่าสำรองสำหรับ session เก่า
export const THB_PER_USD = 35 // ค่าสำรอง: ค่าจริงมาจาก backend ตอน login (session.settings.thb_per_usd) มี test เช็กว่าตรงกัน
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

export const inputClass =
  'h-11 w-full rounded-lg border border-line bg-card px-3 text-fg outline-none transition-colors duration-200 placeholder:text-muted-fg/60 hover:border-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/20'

export const BAND = {
  Low: { th: 'ต่ำ', text: 'text-risk-low', pill: 'bg-risk-low-soft text-risk-low ring-risk-low/15' },
  Medium: { th: 'ปานกลาง', text: 'text-risk-mid', pill: 'bg-risk-mid-soft text-risk-mid ring-risk-mid/15' },
  High: { th: 'สูง', text: 'text-risk-high', pill: 'bg-risk-high-soft text-risk-high ring-risk-high/15' },
}

export const bandOf = (score) => (score < LOW ? 'Low' : score < HIGH ? 'Medium' : 'High')

// What-if: ระดับเดิม -> ใหม่ ควรเด้งข้อความแบบไหน (null = ระดับไม่เปลี่ยน ไม่ต้องเด้ง)
const BAND_RANK = { Low: 0, Medium: 1, High: 2 }
export const toastKind = (from, to) =>
  from === to ? null : BAND_RANK[to] < BAND_RANK[from] ? (to === 'Low' ? 'low' : 'midDown') : to === 'High' ? 'high' : 'midUp'

// ผู้ช่วยในหน้า (mascot/Mascot.jsx) ลำดับนี้ใช้ทั้งปุ่มเลือกและหน้าขอโทษ ตัวที่เลือกจำใน localStorage
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

// ผู้ใช้ที่ login: { access_token, user: { username, name, role, tenant_id } } เก็บใน sessionStorage (ปิดแท็บ = ออกจากระบบ)
const SESSION_KEY = 'session'
export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}
// คำขอของ session ปัจจุบันผูกกับ controller นี้ ออกจากระบบ = ยกเลิกคำขอที่ค้างทั้งหมด
let sessionAbort = new AbortController()

export function saveSession(session) {
  if (!session) {
    sessionAbort.abort()
    sessionAbort = new AbortController()
  }
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // storage ปิด: ใช้ได้จนรีเฟรชหน้า
  }
}

// ทุกคำขอแนบ token ถ้า backend ตอบ 401 (token หมดอายุ/backend restart) แจ้ง App ให้กลับไปหน้า login
// แจ้งเฉพาะเมื่อ token ที่ใช้ยังเป็นของ session ปัจจุบัน (คำขอเก่าที่ตอบกลับหลัง logout ไม่ทำให้ขึ้น "หมดเวลา" ผิดจังหวะ)
async function call(path, options = {}) {
  const token = loadSession()?.access_token
  const headers = { ...options.headers, ...(token && { Authorization: `Bearer ${token}` }) }
  const signals = [options.signal, token && sessionAbort.signal].filter(Boolean)
  const signal = signals.length > 1 && AbortSignal.any ? AbortSignal.any(signals) : signals[0]
  const res = await fetch(`/api${path}`, { ...options, headers, signal })
  if (res.status === 401 && token && token === loadSession()?.access_token) dispatchEvent(new Event('session-expired'))
  return res
}

async function fail(res) {
  const body = await res.json().catch(() => null)
  const err = new Error(typeof body?.detail === 'string' ? body.detail : `เรียก API ไม่สำเร็จ (${res.status})`)
  err.status = res.status // 404 = ไม่พบพนักงาน (กรอกผิด) แยกจากระบบพัง, 403 = ไม่มีสิทธิ์
  return err
}

// ดาวน์โหลดไฟล์จาก API (ลิงก์ <a href> ธรรมดาแนบ token ไม่ได้)
export async function download(path, filename) {
  const res = await call(path)
  if (!res.ok) throw await fail(res)
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export async function api(path, options) {
  const res = await call(path, options)
  if (!res.ok) throw await fail(res)
  return res.json().catch(() => null)
}

// โหลดหลาย endpoint พร้อมกัน ผูกผลกับ key ของคำขอ (key เปลี่ยน = กำลังโหลดใหม่) ไม่ต้อง setState ใน effect ตอนเริ่ม
export function useApi(paths) {
  const key = paths.join('|')
  const [res, setRes] = useState({ key: null })
  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all(key.split('|').map((p) => api(p, { signal: ctrl.signal }))).then(
      (data) => setRes({ key, data }),
      (err) => err.name !== 'AbortError' && setRes({ key, error: friendly(err) }),
    )
    return () => ctrl.abort()
  }, [key])
  return { loading: res.key !== key, data: res.data, error: res.error }
}

export function postFile(path, file, fields = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  return api(path, { method: 'POST', body: form })
}

// ตัวเลขค่อยๆ นับไปหาค่าใหม่ (ease-out) ตอนแสดงครั้งแรกนับจาก start, ตอนค่าเปลี่ยนนับจากค่าเดิม
// เครื่องที่ตั้ง "ลดการเคลื่อนไหว" กระโดดไปค่าสุดท้ายทันที
export function useCountUp(target, { ms = 450, start = 0 } = {}) {
  const [shown, setShown] = useState(start)
  const from = useRef(start)
  useEffect(() => {
    const begin = performance.now()
    const a = from.current
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let id = requestAnimationFrame(function step(now) {
      const t = reduce ? 1 : Math.min(1, (now - begin) / ms)
      from.current = a + (target - a) * (1 - (1 - t) ** 3)
      setShown(from.current)
      if (t < 1) id = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(id)
  }, [target, ms])
  return shown
}
