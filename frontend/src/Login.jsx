// หน้าเข้าสู่ระบบ POST /auth/login ได้ token เก็บใน sessionStorage (theme.js saveSession)
// ponytail: บัญชีทดลองแสดงบนหน้านี้ชั่วคราวให้ทีม/กรรมการลองได้ ลบกล่อง DEMO_ACCOUNTS ออกเมื่อมีระบบผู้ใช้จริง (SEC-01)
import { useRef, useState } from 'react'
import Logo from '../logo/Logo'
import { PointHint, WelcomeMascots } from './mascot/Mascot'
import { accountProblem, api, focusField, friendly, inputClass, invalidClass, serverProblem } from './theme'
import { Alert, CheckedField, Field, Icon, PrimaryButton, ThemeToggle } from './ui'

const DEMO_ACCOUNTS = [
  { username: 'hr_demo', password: 'hr-demo-1234', role: 'ฝ่ายบุคคล', can: 'ดูภาพรวม, ทำไมถึงเสี่ยง, ลองปรับเงื่อนไข, ตรวจไฟล์นำเข้า' },
  { username: 'admin_demo', password: 'admin-demo-1234', role: 'ผู้ดูแลระบบ', can: 'ทุกอย่างของ HR + บันทึกไฟล์นำเข้า + ปรับเทียบโมเดล' },
  // บริษัทที่เริ่มจากว่าง: ไม่เห็นข้อมูล IBM ลองนำเข้าพนักงานของบริษัทเองได้
  { username: 'newco_admin', password: 'newco-admin-1234', role: 'ผู้ดูแลระบบ · บริษัทใหม่', can: 'เริ่มจากบริษัทที่ยังไม่มีข้อมูล ใช้ทดสอบการนำเข้าพนักงาน (ไม่เห็นข้อมูล IBM)' },
  { username: 'newco_hr', password: 'newco-hr-1234', role: 'ฝ่ายบุคคล · บริษัทใหม่', can: 'ดูพนักงานที่ผู้ดูแลของบริษัทใหม่นำเข้า' },
]

// expired = ถูกพากลับมาเพราะ token หมดอายุ/backend restart (บอกเหตุผล ไม่ให้งงว่าทำไมหลุด)
export default function Login({ onLogin, themeMode, onToggleTheme, expired }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const demo = useRef(null) // กล่องบัญชีทดลองมุมซ้ายล่าง (<details>) ปิดเองหลังเลือกบัญชี
  // สร้างบริษัทใหม่: ได้บริษัทว่าง (ไม่เห็นข้อมูลบริษัทอื่น) + บัญชี admin แล้วเข้าระบบให้เลย (POST /auth/register)
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [company, setCompany] = useState({ company_name: '', name: '', username: '', password: '', confirm: '' })
  // ช่องแรกที่ผิด { field, text } ผู้ช่วยชี้ช่องนั้น (field null = ข้อความรวมใต้ฟอร์ม) แก้ช่องนั้นแล้วหายเอง
  const [problem, setProblem] = useState(null)
  const registerForm = useRef(null)
  const loginForm = useRef(null)
  const setField = (k) => (e) => (setCompany((c) => ({ ...c, [k]: e.target.value })), problem?.field === k && setProblem(null))
  const switchTo = (m) => (setMode(m), setProblem(null))
  const point = (p) => (setProblem(p), p.field && focusField(registerForm.current, p.field))
  // หน้าเข้าสู่ระบบ: credentials = ชื่อผู้ใช้/รหัสผ่านไม่ตรง (backend ไม่บอกว่าช่องไหน) แดงทั้งสองช่อง โฟกัสรหัสผ่าน
  const pointLogin = (p) => (setProblem(p), p.field && focusField(loginForm.current, p.field === 'credentials' ? 'password' : p.field))
  const typed = (set, k) => (e) => (set(e.target.value), [k, 'credentials'].includes(problem?.field) && setProblem(null))
  const loginBad = (k) => [k, 'credentials'].includes(loginProblem?.field)
  // ฟอร์มที่ซ่อนอยู่ไม่แสดงผู้ช่วยชี้ (ช่องชื่อ username/password ซ้ำกัน ไม่งั้นฟอร์มที่ซ่อนจะยืดตามจนการ์ดสูงขึ้น)
  const regProblem = mode === 'register' ? problem : null
  const loginProblem = mode === 'login' ? problem : null
  // ยังไม่ได้เลือกผู้ช่วย: ช่องฝั่งซ้ายให้จอย+ปุกปุยชี้ ฝั่งขวาให้กิต+ส้มฉุน ตามที่ยืนอยู่ข้างฟอร์ม
  const LEFT = { who: 'joy', pet: 'dog' }
  const RIGHT = { who: 'kit', pet: 'cat' }
  const BOTH = { ...LEFT, partner: RIGHT } // ช่องชื่อบริษัทกว้างเต็มแถว มาทั้งสองคู่
  // ตัวที่ออกมาชี้หายจากข้างฟอร์ม (ช่องซ้าย = จอย+ปุกปุย, ช่องขวา = กิต+ส้มฉุน, ชื่อบริษัท = ทั้งหมด)
  // หน้าเข้าสู่ระบบ: ชื่อผู้ใช้ = จอย+ปุกปุย, รหัสผ่าน = กิต+ส้มฉุน, รหัสผิด = ทั้งหมด
  const ALL = ['joy', 'dog', 'kit', 'cat']
  const pointing = mode === 'register'
    ? { company_name: ALL, name: ['joy', 'dog'], password: ['joy', 'dog'], username: ['kit', 'cat'], confirm: ['kit', 'cat'] }
    : { username: ['joy', 'dog'], password: ['kit', 'cat'], credentials: ALL }
  const away = pointing[problem?.field] || []

  async function createCompany(e) {
    e.preventDefault()
    const found = accountProblem(company)
    if (found) return point(found)
    setBusy(true)
    setProblem(null)
    try {
      const { confirm: _, ...body } = company
      onLogin(
        await api('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, company_name: body.company_name.trim(), name: body.name.trim() }),
        }),
      )
    } catch (err) {
      point(serverProblem(err))
      setBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    const found = !username.trim() ? { field: 'username', text: 'กรอกชื่อผู้ใช้ก่อนนะ' } : !password ? { field: 'password', text: 'กรอกรหัสผ่านก่อนนะ' } : null
    if (found) return pointLogin(found)
    setBusy(true)
    setProblem(null)
    try {
      onLogin(
        await api('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        }),
      )
    } catch (err) {
      pointLogin(err.status === 401 ? { field: 'credentials', text: err.message } : { field: null, text: friendly(err) })
      setBusy(false)
    }
  }

  // สองฟอร์มซ้อนในช่องเดียวกัน (ฟอร์มที่ไม่ได้ใช้ซ่อนไว้) การ์ดสูงเท่ากัน ลิงก์สลับหน้าอยู่ล่างสุดตำแหน่งเดิม กดสลับไปมาไม่กระโดด
  const forms = (
    <div className="grid">
      <form ref={registerForm} onSubmit={createCompany} noValidate inert={mode !== 'register'} className={`flex flex-col [grid-area:1/1] ${mode === 'register' ? '' : 'invisible max-lg:hidden'} space-y-3 rounded-xl border border-line bg-card p-6`}>
        <div>
          <h1 className="text-xl font-semibold text-fg">สร้างบริษัทใหม่</h1>
          <p className="text-sm text-muted-fg">ได้บริษัทว่างพร้อมบัญชีผู้ดูแลระบบ แล้วนำเข้าพนักงานของบริษัทเองได้ ไม่เห็นข้อมูลบริษัทอื่น</p>
        </div>
        <CheckedField mascot={BOTH} label="ชื่อบริษัท" name="company_name" problem={regProblem} value={company.company_name} onChange={setField('company_name')} maxLength={100} />
        <div className="grid grid-flow-dense items-start gap-3 sm:grid-cols-2">
          <CheckedField mascot={LEFT} label="ชื่อของคุณ" name="name" problem={regProblem} value={company.name} onChange={setField('name')} maxLength={100} />
          <CheckedField side="right" mascot={RIGHT} label="ชื่อผู้ใช้ (a-z ตัวเลข)" name="username" problem={regProblem} value={company.username} onChange={setField('username')} autoComplete="username" spellCheck={false} />
          <CheckedField mascot={LEFT} label="รหัสผ่าน (8 ตัวขึ้นไป)" name="password" problem={regProblem} type="password" value={company.password} onChange={setField('password')} autoComplete="new-password" />
          <CheckedField side="right" mascot={RIGHT} label="ยืนยันรหัสผ่าน" name="confirm" problem={regProblem} type="password" value={company.confirm} onChange={setField('confirm')} autoComplete="new-password" />
        </div>
        {regProblem && !regProblem.field && <Alert>{regProblem.text}</Alert>}
        <div className="grid">
          <PrimaryButton loading={busy} loadingText="กำลังสร้าง…">
            สร้างบริษัทและเข้าสู่ระบบ <Icon name="right" className="size-4" />
          </PrimaryButton>
        </div>
        <p className="mt-auto text-center text-sm text-muted-fg">
          มีบัญชีแล้ว?{' '}
          <button type="button" onClick={() => switchTo('login')} className="cursor-pointer font-medium text-accent hover:underline">
            เข้าสู่ระบบ
          </button>
        </p>
      </form>
      <form ref={loginForm} onSubmit={submit} noValidate style={{ '--enter': '120ms' }} inert={mode !== 'login'} className={`login-enter flex flex-col [grid-area:1/1] ${mode === 'login' ? '' : 'invisible max-lg:hidden'} space-y-4 rounded-xl border border-line bg-card p-6`}>
      <div>
        <h1 className="text-xl font-semibold text-fg">เข้าสู่ระบบ</h1>
        <p className="text-sm text-muted-fg">ข้อมูลพนักงานเป็นข้อมูลส่วนบุคคล ต้องเข้าสู่ระบบก่อนใช้งาน</p>
      </div>
      <Field label="ชื่อผู้ใช้" icon="user">
        <input
          className={`${inputClass} ${loginBad('username') ? invalidClass : ''}`}
          name="username"
          autoComplete="username"
          spellCheck={false}
          aria-invalid={loginBad('username') || undefined}
          value={username}
          onChange={typed(setUsername, 'username')}
        />
      </Field>
      {loginProblem?.field === 'username' && (
        <PointHint key={loginProblem.text} {...LEFT} className="-mt-2">
          {loginProblem.text}
        </PointHint>
      )}
      <Field label="รหัสผ่าน">
        <span className="relative block">
          <input
            className={`${inputClass} pr-12 ${loginBad('password') ? invalidClass : ''}`}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={loginBad('password') || undefined}
            value={password}
            onChange={typed(setPassword, 'password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-muted-fg transition-colors duration-150 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name={showPassword ? 'eyeOff' : 'eye'} className="size-5" />
          </button>
        </span>
      </Field>
      {['password', 'credentials'].includes(loginProblem?.field) && (
        <PointHint key={loginProblem.text} {...(loginProblem.field === 'password' ? { ...RIGHT, align: 'right' } : BOTH)} className="-mt-2">
          {loginProblem.text}
        </PointHint>
      )}
      {expired && !loginProblem && <Alert tone="warning">หมดเวลาการใช้งาน หรือระบบเพิ่งเริ่มใหม่ กรุณาเข้าสู่ระบบอีกครั้ง</Alert>}
      {loginProblem && !loginProblem.field && <Alert>{loginProblem.text}</Alert>}
      <div className="grid">
        <PrimaryButton loading={busy} loadingText="กำลังเข้าสู่ระบบ…">
          เข้าสู่ระบบ <Icon name="right" className="size-4" />
        </PrimaryButton>
      </div>
      <p className="mt-auto text-center text-sm text-muted-fg">
        ยังไม่มีบัญชี?{' '}
        <button type="button" onClick={() => switchTo('register')} className="cursor-pointer font-medium text-accent hover:underline">
          สร้างบริษัทใหม่
        </button>
      </p>
      </form>
    </div>
  )
  // แบ่งครึ่งจอ: ซ้าย = ผืนสีหลักของระบบ (โหมดมืดเป็นกรมท่า) ชื่อระบบ + ประโยคเดียว + ผู้ช่วยทั้งสี่ยืนบนแถบพื้น / ขวา = ฟอร์มบนพื้นขาว
  // มือถือ: ผืนสีเป็นแถบบน ผู้ช่วยทั้งสี่ตัวเล็กยืนบนแถบพื้น ฟอร์มอยู่ล่าง (การ์ดสูงพอดีฟอร์มที่ใช้อยู่) เว้นที่ล่างให้ปุ่มบัญชีทดลองไม่ทับลิงก์
  return (
    <main className="relative isolate grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* มือถือ: ปุ่มอยู่บนแถบสี ใช้สีตัวหนังสือของแถบ */}
      <ThemeToggle mode={themeMode} onToggle={onToggleTheme} className="absolute right-4 top-4 z-20 max-lg:border-current/30! max-lg:text-on-action! dark:max-lg:text-fg!" />
      <section className="relative flex flex-col overflow-hidden bg-action pl-6 pr-16 pt-8 text-on-action lg:px-14 lg:pt-14 dark:bg-primary-soft dark:text-fg">
        <div className="login-enter flex items-center gap-4 lg:flex-col lg:items-start">
          <Logo className="size-20 shrink-0 lg:size-28" />
          <div>
            <div className="text-2xl font-semibold tracking-tight lg:mt-4 lg:text-5xl" translate="no">
              Attrition Predictor
            </div>
            <p className="mt-1 max-w-md text-base opacity-90 lg:mt-4 lg:text-xl">
              รู้ก่อนว่าพนักงานคนไหน<span className="whitespace-nowrap">เสี่ยงลาออก</span> และเพราะอะไร
            </p>
          </div>
        </div>
        {/* พื้นที่ผู้ช่วยยืน: แถบสีเข้มกว่าผืนหนึ่งขั้นที่ขอบล่าง (-mr-10 บนมือถือชดเชย pr-16 ที่เว้นให้ปุ่มธีม ผู้ช่วยจะได้อยู่กลาง) ตัวที่ออกไปชี้ช่องในฟอร์มจางหายจากตรงนี้ (away) */}
        <div className="relative -mr-10 mt-auto pt-6 lg:mr-0 lg:pt-10">
          <div className="absolute inset-x-[-3.5rem] bottom-0 h-10 bg-[color-mix(in_oklab,var(--color-action)_82%,var(--color-ink))] dark:bg-secondary" aria-hidden="true" />
          <WelcomeMascots keys={['dog', 'joy', 'kit', 'cat']} enter="left" away={away} className="relative justify-center gap-2 pb-4 lg:gap-3 lg:pb-6 xl:gap-6 [&_svg]:h-24 [&_[data-kind=pet]_svg]:h-16 lg:[&_svg]:h-44 lg:[&_[data-kind=pet]_svg]:h-28 xl:[&_svg]:h-56 xl:[&_[data-kind=pet]_svg]:h-32" />
        </div>
      </section>
      <section className="grid place-items-center px-4 pb-24 pt-8 lg:pb-8">
        <div className="w-full max-w-md">{forms}</div>
      </section>

      {/* บัญชีทดลอง: พับเก็บไว้มุมซ้ายล่างของฝั่งฟอร์ม กดเพื่อเปิด แล้วกดบัญชีเพื่อกรอกให้ */}
      <details ref={demo} className={`group fixed bottom-4 z-10 left-4 lg:left-[calc(50%+1rem)] max-w-[calc(100vw-2rem)] text-sm`}>
        <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-risk-mid/25 bg-risk-mid-soft px-4 font-medium text-risk-mid shadow-sm transition-colors duration-150 hover:bg-risk-mid-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
          <Icon name="info" className="size-4" />
          บัญชีทดลอง
          <Icon name="chevron" className="size-3.5 rotate-180 transition-transform duration-150 group-open:rotate-0" />
        </summary>
        <div className="absolute bottom-12 left-0 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-3 shadow-lg">
          <p className="mb-2 px-1 text-xs text-muted-fg">ชั่วคราว ใช้กับข้อมูลตัวอย่างเท่านั้น · กดเพื่อกรอกให้</p>
          <ul className="space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <button
                  type="button"
                  onClick={() => (setUsername(a.username), setPassword(a.password), setProblem(null), (demo.current.open = false))}
                  className="w-full cursor-pointer rounded-xl bg-muted/60 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
