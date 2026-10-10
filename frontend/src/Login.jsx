// หน้าเข้าสู่ระบบ POST /auth/login ได้ token เก็บใน sessionStorage (theme.js saveSession)
// ponytail: บัญชีทดลองแสดงบนหน้านี้ชั่วคราวให้ทีม/กรรมการลองได้ ลบกล่อง DEMO_ACCOUNTS ออกเมื่อมีระบบผู้ใช้จริง (SEC-01)
import { useState } from 'react'
import { api, friendly, inputClass } from './theme'
import { Alert, Field, Icon, PrimaryButton, ThemeToggle } from './ui'

const DEMO_ACCOUNTS = [
  { username: 'hr_demo', password: 'hr-demo-1234', role: 'ฝ่ายบุคคล', can: 'ดูภาพรวม, SHAP, What-if, ตรวจไฟล์นำเข้า' },
  { username: 'admin_demo', password: 'admin-demo-1234', role: 'ผู้ดูแลระบบ', can: 'ทุกอย่างของ HR + บันทึกไฟล์นำเข้า + ปรับเทียบโมเดล' },
]

// expired = ถูกพากลับมาเพราะ token หมดอายุ/backend restart (บอกเหตุผล ไม่ให้งงว่าทำไมหลุด)
export default function Login({ onLogin, dark, onToggleTheme, expired }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onLogin(
        await api('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        }),
      )
    } catch (err) {
      setError(friendly(err))
      setBusy(false)
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <ThemeToggle dark={dark} onToggle={onToggleTheme} className="absolute right-4 top-4" />
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-lg bg-primary text-on-primary">
            <Icon name="trend" className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-fg" translate="no">
              Attrition Predictor
            </div>
            <div className="text-xs text-muted-fg">HR Analytics</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-card p-6">
          <div>
            <h1 className="text-xl font-semibold text-fg">เข้าสู่ระบบ</h1>
            <p className="text-sm text-muted-fg">ข้อมูลพนักงานเป็นข้อมูลส่วนบุคคล ต้องเข้าสู่ระบบก่อนใช้งาน</p>
          </div>
          <Field label="ชื่อผู้ใช้" icon="user">
            <input
              className={inputClass}
              name="username"
              autoComplete="username"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label="รหัสผ่าน">
            <span className="relative block">
              <input
                className={`${inputClass} pr-12`}
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-muted-fg transition-colors duration-150 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} className="size-5" />
              </button>
            </span>
          </Field>
          {expired && !error && <Alert tone="warning">หมดเวลาการใช้งาน หรือระบบเพิ่งเริ่มใหม่ กรุณาเข้าสู่ระบบอีกครั้ง</Alert>}
          {error && <Alert>{error}</Alert>}
          <div className="grid">
            <PrimaryButton loading={busy} loadingText="กำลังเข้าสู่ระบบ…">
              เข้าสู่ระบบ <Icon name="right" className="size-4" />
            </PrimaryButton>
          </div>
        </form>

        <section className="rounded-xl border border-risk-mid/20 bg-risk-mid-soft p-5 text-sm" aria-labelledby="demo-title">
          <h2 id="demo-title" className="flex items-center gap-2 font-semibold text-risk-mid">
            <Icon name="info" className="size-5" />
            บัญชีทดลอง (ชั่วคราว ใช้กับข้อมูลตัวอย่างเท่านั้น)
          </h2>
          <ul className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <button
                  type="button"
                  onClick={() => (setUsername(a.username), setPassword(a.password))}
                  className="w-full cursor-pointer rounded-lg border border-line bg-card px-4 py-3 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-fg">{a.role}</span>
                    <span className="font-mono text-xs text-muted-fg" translate="no">
                      {a.username} / {a.password}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-fg">{a.can} · กดเพื่อกรอกให้</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
