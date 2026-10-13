// บัญชีผู้ใช้ของบริษัท (เฉพาะ admin): GET /auth/users ดูรายชื่อ, POST /auth/users เพิ่มบัญชี HR / admin
// บัญชีที่เพิ่มเก็บในตาราง app_users (ต้องต่อ database) รหัสผ่านเก็บเป็น hash ฝั่ง backend
import { useRef, useState } from 'react'
import { accountProblem, api, focusField, inputClass, serverProblem, useApi } from './theme'
import { Alert, Card, CheckedField, Field, Icon, PrimaryButton, Skeleton } from './ui'

const ROLE = { admin: 'ผู้ดูแลระบบ', hr: 'ฝ่ายบุคคล' }
const EMPTY = { name: '', username: '', password: '', confirm: '', role: 'hr' }

export default function Users() {
  const [version, setVersion] = useState(0)
  const { data, error } = useApi([`/auth/users?v=${version}`])
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('') // เพิ่มบัญชีสำเร็จ
  const [problem, setProblem] = useState(null) // ช่องแรกที่ผิด { field, text } ผู้ช่วยชี้ช่องนั้น
  const formRef = useRef(null)
  const set = (k) => (e) => (setForm((f) => ({ ...f, [k]: e.target.value })), problem?.field === k && setProblem(null))
  const point = (p) => (setProblem(p), p.field && focusField(formRef.current, p.field))

  async function add(e) {
    e.preventDefault()
    setMessage('')
    const found = accountProblem(form)
    if (found) return point(found)
    setBusy(true)
    setProblem(null)
    try {
      const { confirm: _, ...body } = form
      const made = await api('/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, name: body.name.trim() }),
      })
      setMessage(`เพิ่มบัญชี ${made.username} (${ROLE[made.role]}) แล้ว ส่งชื่อผู้ใช้กับรหัสผ่านให้เจ้าของบัญชี`)
      setForm(EMPTY)
      setVersion((v) => v + 1)
    } catch (err) {
      point(serverProblem(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card icon="user" title="บัญชีของบริษัทนี้" subtitle="ทุกคนในรายการนี้เห็นข้อมูลพนักงานของบริษัทนี้">
        {error && <Alert>{error}</Alert>}
        {!data && !error && <Skeleton className="h-32" />}
        {data && (
          <ul className="divide-y divide-line">
            {data[0].users.map((u) => (
              <li key={u.username} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-fg">
                  <Icon name="user" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{u.name}</span>
                  <span className="block font-mono text-xs text-muted-fg" translate="no">
                    {u.username}
                  </span>
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-fg">
                  {ROLE[u.role]}
                  {u.demo && ' · บัญชีทดลอง'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card icon="user" title="เพิ่มบัญชี" subtitle="เช่น ให้เพื่อนในฝ่ายบุคคลเข้ามาดูความเสี่ยงของพนักงาน">
        <form ref={formRef} onSubmit={add} noValidate className="space-y-4">
          <CheckedField label="ชื่อที่จะแสดง" name="name" problem={problem} value={form.name} onChange={set('name')} maxLength={100} />
          <CheckedField label="ชื่อผู้ใช้ (a-z ตัวเล็ก ตัวเลข _ . -)" name="username" problem={problem} value={form.username} onChange={set('username')} autoComplete="off" spellCheck={false} />
          <div className="grid grid-flow-dense items-start gap-4 sm:grid-cols-2">
            <CheckedField label="รหัสผ่าน (อย่างน้อย 8 ตัว)" name="password" problem={problem} type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
            <CheckedField side="right" label="ยืนยันรหัสผ่าน" name="confirm" problem={problem} type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          </div>
          <Field label="สิทธิ์">
            <select className={inputClass} value={form.role} onChange={set('role')}>
              <option value="hr">ฝ่ายบุคคล: ดูภาพรวม SHAP What-if ตรวจไฟล์นำเข้า</option>
              <option value="admin">ผู้ดูแลระบบ: ทุกอย่าง + บันทึกไฟล์นำเข้า ปรับเทียบ เพิ่มบัญชี</option>
            </select>
          </Field>
          {message && <p className="text-sm font-medium text-risk-low">{message}</p>}
          {problem && !problem.field && <Alert>{problem.text}</Alert>}
          <PrimaryButton loading={busy} loadingText="กำลังเพิ่ม…">
            เพิ่มบัญชี
          </PrimaryButton>
        </form>
      </Card>
    </div>
  )
}
