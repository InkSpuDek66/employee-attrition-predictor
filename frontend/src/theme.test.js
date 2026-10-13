// test ตรรกะเงิน/เกณฑ์ และการเรียก API (ใช้ node:test ในตัว ไม่ต้องลง library) รัน: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accountProblem, api, bahtShort, bandOf, csvCell, employeeLabel, loadMascot, pushRecent, toastKind, friendly, incomeBounds, parseIncomeBaht, postFile, saveSession, toApiChanges } from './theme.js'

test('ขอบเขตเงินเดือน: ขั้นต่ำ 15,000 บาท ขั้นสูง 20,000 ดอลลาร์ × อัตรา', () => {
  assert.deepEqual(incomeBounds(35), [15000, 700000])
  assert.deepEqual(incomeBounds(32.5), [15000, 650000])
})

test('พิมพ์เงินเดือนแล้วดันเข้าขอบเขต', () => {
  assert.equal(parseIncomeBaht('50,000', 35, 1), 50000)
  assert.equal(parseIncomeBaht('100', 35, 1), 15000) // ต่ำกว่าแถบ
  assert.equal(parseIncomeBaht('99,999,999', 35, 1), 700000) // สูงกว่าแถบ
  assert.equal(parseIncomeBaht('abc', 35, 42000), 42000) // พิมพ์มั่ว = ค่าเดิม
  assert.equal(parseIncomeBaht('', 35, 42000), 42000)
})

test('ส่งเงินเดือนเข้า API เป็นดอลลาร์จำนวนเต็ม (backend ปฏิเสธทศนิยม)', () => {
  assert.deepEqual(toApiChanges({ MonthlyIncome: 50000 / 35, OverTime: 'No' }), { MonthlyIncome: 1429, OverTime: 'No' })
  const other = { OverTime: 'No' }
  assert.equal(toApiChanges(other), other)
})

test('ย่อเงินก้อนใหญ่เป็นล้านบาท ต่ำกว่าล้านแสดงเต็ม', () => {
  assert.equal(bahtShort(457969584), '~458 ล้านบาท')
  assert.equal(bahtShort(2450000), '~2.5 ล้านบาท')
  assert.equal(bahtShort(45000), '45,000 บาท')
})

test('พนักงานที่เพิ่งดู: ใหม่สุดอยู่หน้า ไม่ซ้ำ ไม่เกิน 5 คน', () => {
  const list = [1, 2, 3, 4, 5].map((id) => ({ id }))
  assert.deepEqual(pushRecent(list, { id: 3, band: 'High' }).map((r) => r.id), [3, 1, 2, 4, 5])
  assert.deepEqual(pushRecent(list, { id: 9 }).map((r) => r.id), [9, 1, 2, 3, 4])
  assert.equal(pushRecent([{ id: 3, name: 'สมชาย' }], { id: 3 })[0].name, 'สมชาย') // ไม่มีชื่อมา ไม่ลบชื่อเดิม
})

test('CSV: กันสูตร Excel ในช่องข้อความ ตัวเลขไม่ถูกแตะ', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell('+66 1'), `"'+66 1"`)
  assert.equal(csvCell('สมชาย'), '"สมชาย"')
  assert.equal(csvCell(-5), '"-5"')
})

test('ชื่อพนักงาน: มีชื่อแสดงคู่รหัส ไม่มีแสดงแค่รหัส', () => {
  assert.equal(employeeLabel(622, 'สมชาย ใจดี'), 'สมชาย ใจดี · #622')
  assert.equal(employeeLabel(622, null), 'พนักงาน #622')
})

test('แบ่งระดับความเสี่ยงที่ 40/70 (README 6.1)', () => {
  assert.deepEqual([0.399, 0.4, 0.699, 0.7].map(bandOf), ['Low', 'Medium', 'Medium', 'High'])
})

// ---- api(): token, หมดเวลา, คำขอค้างตอน logout, ข้อความ error ----
// จำลอง sessionStorage / fetch / dispatchEvent ของเบราว์เซอร์ fetch ตอบตามลำดับใน replies (ส่ง Promise ได้ ไว้ทดสอบคำขอค้าง)
function browser(replies) {
  const store = new Map()
  globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
  const events = []
  globalThis.dispatchEvent = (e) => events.push(e.type)
  const calls = []
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts })
    const r = await replies.shift()
    return new Response(JSON.stringify(r.body ?? null), { status: r.status ?? 200 })
  }
  return { calls, events }
}
const login = (token = 'tok') => saveSession({ access_token: token, user: { username: 'hr_demo' } })

test('แนบ token เฉพาะตอน login แล้ว', async () => {
  const { calls } = browser([{ body: 1 }, { body: 2 }])
  saveSession(null)
  await api('/x')
  login()
  assert.equal(await api('/y'), 2)
  assert.equal(calls[0].opts.headers.Authorization, undefined)
  assert.equal(calls[1].opts.headers.Authorization, 'Bearer tok')
  assert.equal(calls[1].url, '/api/y')
})

test('401 ของ session ปัจจุบัน = แจ้งหมดเวลา แต่ login ผิดไม่แจ้ง', async () => {
  const { events } = browser([{ status: 401, body: { detail: 'หมดเวลา' } }, { status: 401, body: { detail: 'รหัสผิด' } }])
  login()
  await assert.rejects(api('/x'), { message: 'หมดเวลา', status: 401 })
  assert.deepEqual(events, ['session-expired'])
  saveSession(null)
  await assert.rejects(api('/auth/login', { method: 'POST' }), { message: 'รหัสผิด' })
  assert.deepEqual(events, ['session-expired'])
})

test('logout ระหว่างรอคำตอบ: ยกเลิกคำขอ และไม่ขึ้นหมดเวลาผิดจังหวะ', async () => {
  let answer
  const { calls, events } = browser([new Promise((resolve) => (answer = resolve))])
  login('old')
  const pending = api('/slow')
  await new Promise((r) => setTimeout(r)) // ให้ fetch ถูกเรียกก่อน
  saveSession(null)
  assert.equal(calls[0].opts.signal.aborted, true)
  answer({ status: 401, body: { detail: 'x' } })
  await assert.rejects(pending)
  assert.deepEqual(events, [])
})

test('ข้อความ error: ใช้ detail ภาษาไทยจาก backend หรือข้อความกลางถ้าไม่ใช่ข้อความ', async () => {
  browser([{ status: 404, body: { detail: 'ไม่พบพนักงาน' } }, { status: 422, body: { detail: [{ msg: 'x' }] } }])
  saveSession(null)
  await assert.rejects(api('/a'), { message: 'ไม่พบพนักงาน', status: 404 })
  await assert.rejects(api('/b'), { message: 'เรียก API ไม่สำเร็จ (422)', status: 422 })
  assert.match(friendly(new Error('Failed to fetch')), /ติดต่อ backend ไม่ได้/)
  assert.equal(friendly(new Error('อื่นๆ')), 'อื่นๆ')
})

test('postFile ส่งไฟล์และฟิลด์เพิ่มเป็น FormData', async () => {
  const { calls } = browser([{ body: { ok: true } }])
  login()
  await postFile('/recalibrate/upload', new Blob(['a,b']), { method: 'platt' })
  const form = calls[0].opts.body
  assert.equal(calls[0].opts.method, 'POST')
  assert.equal(form.get('method'), 'platt')
  assert.ok(form.get('file'))
})

test('What-if: ข้อความเด้งตามทิศที่ระดับความเสี่ยงเปลี่ยน', () => {
  assert.equal(toastKind('High', 'Low'), 'low')
  assert.equal(toastKind('Medium', 'Low'), 'low')
  assert.equal(toastKind('High', 'Medium'), 'midDown')
  assert.equal(toastKind('Low', 'Medium'), 'midUp')
  assert.equal(toastKind('Low', 'High'), 'high')
  assert.equal(toastKind('Medium', 'High'), 'high')
  assert.equal(toastKind('Low', 'Low'), null) // ไม่เปลี่ยน = ไม่เด้ง (เดิมเคยฉลองซ้ำตอนปรับครั้งแรกของคนที่ต่ำอยู่แล้ว)
})

test('มาสคอตที่เคยเลือกไว้ด้วยชื่อรุ่นก่อน (chibiGirl / chibiBoy) ได้ตัวเดิม', () => {
  const saved = globalThis.localStorage
  for (const [old, now] of [['chibiGirl', 'joy'], ['chibiBoy', 'kit'], ['cat', 'cat'], ['ไม่รู้จัก', 'joy']]) {
    globalThis.localStorage = { getItem: () => old }
    assert.equal(loadMascot(), now)
  }
  globalThis.localStorage = saved
})

test('ตรวจข้อมูลบัญชีก่อนส่ง: ชื่อผู้ใช้ตามกติกาเดียวกับ backend, รหัสผ่าน 8 ตัวขึ้นไปและตรงกัน', () => {
  const ok = { name: 'สมชาย', username: 'somchai.k', password: 'abcd1234', confirm: 'abcd1234' }
  assert.equal(accountProblem(ok), null)
  assert.equal(accountProblem({ ...ok, username: 'Somchai' }).field, 'username') // มาสคอตชี้ช่องนี้
  assert.match(accountProblem({ ...ok, username: 'ab' }).text, /3–32/)
  assert.equal(accountProblem({ ...ok, password: 'short', confirm: 'short' }).field, 'password')
  assert.equal(accountProblem({ ...ok, confirm: 'abcd12345' }).field, 'confirm')
  assert.equal(accountProblem({ ...ok, name: '  ' }).field, 'name')
  assert.equal(accountProblem({ ...ok, company_name: '' }).field, 'company_name') // ฟอร์มสร้างบริษัท
  assert.equal(accountProblem({ ...ok, company_name: 'บริษัท ก' }), null)
})
