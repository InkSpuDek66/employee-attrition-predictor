import { useEffect, useRef, useState } from 'react'
// ค่าคงที่และ helper ที่ SHAP Viewer กับ What-if Simulator ใช้ร่วมกัน

// เกณฑ์ระดับตาม README 6.1 ชุดเดียวกับ src/business_rules.py (MEDIUM_RISK / HIGH_RISK) แก้ต้องแก้คู่กัน
export const LOW = 0.4
export const HIGH = 0.7

// เงิน (DE-01): เงินเดือนและต้นทุนทุกตัวจาก API เป็นบาทจริงแล้ว หน้าเว็บแสดง/ส่งเป็นบาทตรงๆ ไม่ต้องแปลง
// backend แปลงเงินเดือนเป็นหน่วยของโมเดลเองตอนให้คะแนน (เทียบอันดับเงินเดือนในบริษัท src/income_scale.py)
export const INCOME_MIN_BAHT = 5000 // ขั้นต่ำของช่อง/แถบเงินเดือน (ต่ำกว่าค่าแรงขั้นต่ำรายเดือน กันพิมพ์ตกหลัก)
export const baht = (v) => `${Math.round(v).toLocaleString().replace('-', '−')} บาท`
// เงินก้อนใหญ่แบบย่อ อ่านง่ายในการ์ด: 457,969,584 -> "~458 ล้านบาท" (~ = ปัดแล้ว ประมาณ) ต่ำกว่าล้านแสดงเต็ม
export const bahtShort = (v) =>
  Math.abs(v) < 1e6 ? baht(v) : `~${(v / 1e6).toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) >= 1e8 ? 0 : 1 })} ล้านบาท`
const INCOME_STEP = 500 // แถบเลื่อนเงินเดือนขยับทีละ 500 บาท

// ขอบเขตช่อง/แถบเงินเดือน (บาท) ของพนักงานที่เงินเดือนเดิม base: ขั้นต่ำคงที่ ขั้นสูง 3 เท่าของเดิม อย่างน้อย 300,000
export const incomeBounds = (base) => [INCOME_MIN_BAHT, Math.round(Math.max(300000, base * 3) / INCOME_STEP) * INCOME_STEP]

// แปลงข้อความที่พิมพ์ในช่องเงินเดือน ("50,000") เป็นบาทในขอบเขต พิมพ์มั่ว/ว่าง = คืนค่าเดิม
export function parseIncomeBaht(text, base, fallback) {
  const [min, max] = incomeBounds(base)
  const n = Number(String(text).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

// changes ที่ส่งเข้า backend: เงินเดือนในหน้าอาจมีทศนิยม (ขึ้น 10% = 45,123.4) แต่ API รับบาทจำนวนเต็ม
export const toApiChanges = (changes) =>
  'MonthlyIncome' in changes ? { ...changes, MonthlyIncome: Math.round(changes.MonthlyIncome) } : changes

export const inputClass =
  'h-11 w-full rounded-xl border border-line bg-card px-3.5 text-fg outline-none transition-colors duration-200 placeholder:text-muted-fg hover:border-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/20'

export const BAND = {
  Low: { th: 'ต่ำ', text: 'text-risk-low', pill: 'bg-risk-low-soft text-risk-low ring-risk-low/15' },
  Medium: { th: 'ปานกลาง', text: 'text-risk-mid', pill: 'bg-risk-mid-soft text-risk-mid ring-risk-mid/15' },
  High: { th: 'สูง', text: 'text-risk-high', pill: 'bg-risk-high-soft text-risk-high ring-risk-high/15' },
}

// ระดับคิดจากคะแนนที่แสดง (x100 ปัด) ตรงกับ business_rules.risk_band: 39.75 แสดง 40 = ปานกลาง
export const bandOf = (score) => {
  const shown = Math.round(score * 100) / 100
  return shown < LOW ? 'Low' : shown < HIGH ? 'Medium' : 'High'
}

// What-if: ระดับเดิม -> ใหม่ ควรเด้งข้อความแบบไหน (null = ระดับไม่เปลี่ยน ไม่ต้องเด้ง)
const BAND_RANK = { Low: 0, Medium: 1, High: 2 }
export const toastKind = (from, to) =>
  from === to ? null : BAND_RANK[to] < BAND_RANK[from] ? (to === 'Low' ? 'low' : 'midDown') : to === 'High' ? 'high' : 'midUp'

// ผู้ช่วยในหน้า (mascot/Mascot.jsx) ลำดับนี้ใช้ทั้งปุ่มเลือกและหน้าขอโทษ ตัวที่เลือกจำใน localStorage
// คำเตือนยังไม่ปรับเทียบ ข้อความเดียวทุกหน้า (ui.jsx: UncalibratedNote, หน้าภาพรวม)
export const UNCALIBRATED = 'ยังไม่ปรับเทียบกับบริษัท: คะแนนใช้จัดลำดับว่าใครเสี่ยงกว่า ไม่ใช่โอกาสลาออกจริง'

export const MASCOTS = ['joy', 'kit', 'cat', 'dog']
const OLD_MASCOT_KEYS = { chibiGirl: 'joy', chibiBoy: 'kit' } // ชื่อรุ่นก่อนที่อาจจำไว้ในเบราว์เซอร์

const USERNAME = /^[a-z0-9_.-]{3,32}$/ // ตรงกับ backend (auth.USERNAME)

// ตรวจก่อนส่ง คืนช่องแรกที่ผิด { field, text } (มาสคอตชี้ช่องนั้น) หรือ null (backend ตรวจซ้ำอีกชั้น)
// company_name มีเฉพาะฟอร์มสร้างบริษัท (undefined = ไม่ตรวจ)
export function accountProblem({ company_name, name, username, password, confirm }) {
  if (company_name !== undefined && !company_name.trim()) return { field: 'company_name', text: 'กรอกชื่อบริษัทก่อนนะ' }
  if (!name.trim()) return { field: 'name', text: 'กรอกชื่อที่จะแสดงก่อนนะ' }
  if (!USERNAME.test(username)) return { field: 'username', text: 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z ตัวเล็ก ตัวเลข _ . - ยาว 3–32 ตัว' }
  if (password.length < 8) return { field: 'password', text: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว' }
  if (password !== confirm) return { field: 'confirm', text: 'รหัสผ่านสองช่องไม่ตรงกัน' }
  return null
}
// ชื่อผู้ใช้ซ้ำ (409 จาก backend) = ชี้ช่องชื่อผู้ใช้ error อื่น = ข้อความรวมด้านล่างฟอร์ม
export const serverProblem = (err) => (err.status === 409 ? { field: 'username', text: err.message } : { field: null, text: friendly(err) })
// ช่องที่ผิด: กรอบแดง (ต่อท้าย inputClass)
export const invalidClass = 'border-risk-high ring-2 ring-risk-high/20'
// โฟกัสช่องที่ผิดในฟอร์ม (input มี name ตรงกับ field)
export function focusField(form, field) {
  form?.querySelector(`[name="${field}"]`)?.focus()
}

// ปุ่มธีมกดวน: ตามเบราว์เซอร์ (ค่าเริ่มต้น) → สว่าง → มืด → ตามเบราว์เซอร์
export const THEME_NEXT = { system: 'light', light: 'dark', dark: 'system' }

export function loadMascot() {
  try {
    const saved = localStorage.getItem('mascot')
    const v = OLD_MASCOT_KEYS[saved] ?? saved
    return MASCOTS.includes(v) ? v : MASCOTS[0]
  } catch {
    return MASCOTS[0]
  }
}

// พนักงานที่เพิ่งดู (ปุ่มลัดใต้ช่องรหัส) ใหม่สุดอยู่หน้า ไม่ซ้ำ เก็บแค่ RECENT_MAX คน แยกตามบริษัท
const RECENT_MAX = 5
// item ที่ไม่มีชื่อ (เช่น What-if แจ้งมา) ไม่ลบชื่อที่จำไว้จากหน้า SHAP
export const pushRecent = (list, item) =>
  [{ ...list.find((r) => r.id === item.id), ...item }, ...list.filter((r) => r.id !== item.id)].slice(0, RECENT_MAX)
// ช่องใน CSV: ครอบด้วย " และกันสูตร Excel (ค่าที่ขึ้นต้นด้วย = + - @ tab CR ถูกรันเป็นสูตรเมื่อเปิดไฟล์)
// ใส่ ' นำหน้าให้ Excel อ่านเป็นข้อความ ตัวเลขจริง (คะแนน รหัส) ไม่ใช่ string จึงไม่ถูกแตะ
export const csvCell = (v) => {
  const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v)
  return `"${s.replaceAll('"', '""')}"`
}
// ชื่อที่แสดงของพนักงาน: มีชื่อ (บริษัทกรอกตอนนำเข้า) = "ชื่อ · #id" ไม่มี = "พนักงาน #id"
export const employeeLabel = (id, name) => (name ? `${name} · #${id}` : `พนักงาน #${id}`)
export function loadRecent(tenant) {
  try {
    const v = JSON.parse(localStorage.getItem(`recent:${tenant}`))
    return Array.isArray(v) ? v.map(({ id }) => ({ id })) : [] // ข้อมูลเก่าที่เคยมีชื่อ ไม่อ่านชื่อกลับมา
  } catch {
    return []
  }
}
// เก็บลงเครื่องแค่รหัส ชื่อ (ข้อมูลส่วนบุคคล) อยู่ในหน่วยความจำของหน้าเท่านั้น logout/ปิดหน้าแล้วหาย
export function saveRecent(tenant, list) {
  try {
    localStorage.setItem(`recent:${tenant}`, JSON.stringify(list.map(({ id }) => ({ id }))))
  } catch {
    // private mode / storage ปิด: ใช้ได้แค่จนปิดหน้า
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
