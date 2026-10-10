// หน้าเข้าสู่ระบบ POST /auth/login ได้ token เก็บใน sessionStorage (theme.js saveSession)
// ponytail: บัญชีทดลองแสดงบนหน้านี้ชั่วคราวให้ทีม/กรรมการลองได้ ลบกล่อง DEMO_ACCOUNTS ออกเมื่อมีระบบผู้ใช้จริง (SEC-01)
import { useRef, useState } from 'react'
import Logo from '../logo/Logo'
import { WelcomeMascots } from './mascot/Mascot'
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
  const demo = useRef(null) // กล่องบัญชีทดลองมุมซ้ายล่าง (<details>) ปิดเองหลังเลือกบัญชี
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
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-canvas px-4 py-8">
      <div className="login-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <ThemeToggle dark={dark} onToggle={onToggleTheme} className="absolute right-4 top-4" />
      {/* จอใหญ่: ปุกปุย + จอย ทางซ้าย, กิต + ส้มฉุน ทางขวา (สัตว์ยืนด้านนอก) ยืนเสมอขอบล่างของฟอร์ม เห็นครบในจอเดียว */}
      <div className="flex w-full items-end justify-center gap-6 xl:gap-10">
        <WelcomeMascots keys={['dog', 'chibiGirl']} className="mb-2 hidden gap-2 lg:flex [&_svg]:h-40 xl:[&_svg]:h-48 [&_[data-kind=pet]_svg]:h-28 xl:[&_[data-kind=pet]_svg]:h-32" />
        <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-24 sm:size-28" />
          <div className="mt-3 text-2xl font-semibold tracking-tight text-fg" translate="no">
            Attrition Predictor
          </div>
          <div className="text-sm text-muted-fg">HR Analytics · ทำนายความเสี่ยงพนักงานลาออก</div>
        </div>

        <div>
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
        </div>
        </div>
        <WelcomeMascots keys={['chibiBoy', 'cat']} className="mb-2 hidden gap-2 lg:flex [&_svg]:h-40 xl:[&_svg]:h-48 [&_[data-kind=pet]_svg]:h-28 xl:[&_[data-kind=pet]_svg]:h-32" />
      </div>

      {/* บัญชีทดลอง: พับเก็บไว้มุมซ้ายล่าง กดเพื่อเปิด แล้วกดบัญชีเพื่อกรอกให้ */}
      <details ref={demo} className="group fixed bottom-4 left-4 z-10 max-w-[calc(100vw-2rem)] text-sm">
        <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-risk-mid/25 bg-risk-mid-soft px-4 font-medium text-risk-mid shadow-sm transition-colors duration-150 hover:bg-risk-mid-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
          <Icon name="info" className="size-4" />
          บัญชีทดลอง
          <Icon name="up" className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <div className="absolute bottom-12 left-0 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-3 shadow-lg">
          <p className="mb-2 px-1 text-xs text-muted-fg">ชั่วคราว ใช้กับข้อมูลตัวอย่างเท่านั้น · กดเพื่อกรอกให้</p>
          <ul className="space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <button
                  type="button"
                  onClick={() => (setUsername(a.username), setPassword(a.password), (demo.current.open = false))}
                  className="w-full cursor-pointer rounded-lg border border-line bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-fg">{a.role}</span>
                    <span className="font-mono text-xs text-muted-fg" translate="no">
                      {a.username} / {a.password}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-fg">{a.can}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </main>
  )
}
