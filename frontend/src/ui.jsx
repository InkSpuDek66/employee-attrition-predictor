// ชิ้นส่วน UI ที่ SHAP Viewer กับ What-if Simulator ใช้ร่วมกัน
import { MascotLoader, PointHint } from './mascot/Mascot'
import { BAND, bandOf, HIGH, inputClass, invalidClass, LOW, THEME_NEXT, UNCALIBRATED, useCountUp } from './theme'

// ไอคอนเส้น (path จาก Heroicons outline, MIT) ไม่ต้องลง library เพิ่ม
const ICONS = {
  search: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  sliders:
    'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75',
  chart:
    'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  list: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm0 5.25h.007v.008H3.75V12Zm0 5.25h.007v.008H3.75v-.008Z',
  money:
    'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  trend: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
  heart:
    'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  error: 'm9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  reset:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
  right: 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
  up: 'M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18',
  down: 'M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3',
  user: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
  sun: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
  sunMoon: 'M6.82 13.18A4.5 4.5 0 0 1 13.18 6.82ZM2 10h1.5M10 2v1.5M4.34 4.34l1.06 1.06M16.9 12.32A4.2 4.2 0 1 1 12.32 16.9A3.6 3.6 0 0 0 16.9 12.32ZM20 5L5 20',
  moon: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z',
  upload: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5',
  download: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  check: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  eye: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  eyeOff: 'M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88',
  scale: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
  info: 'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
}

export function Icon({ name, className = 'size-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

// ปุ่มธีม ใช้ทั้งหน้า login และ sidebar: ไอคอน = โหมดที่ใช้อยู่ (พระอาทิตย์ครึ่งดวงซ้ายบน + พระจันทร์เสี้ยวขวาล่าง = ตามเบราว์เซอร์) กดวน ตามเบราว์เซอร์ → สว่าง → มืด
const THEME_LABEL = { system: 'ตามเบราว์เซอร์', light: 'โหมดสว่าง', dark: 'โหมดมืด' }
const THEME_ICON = { system: 'sunMoon', light: 'sun', dark: 'moon' }
export function ThemeToggle({ mode, onToggle, className = '' }) {
  const label = `ธีม: ${THEME_LABEL[mode]} (กดเพื่อเปลี่ยนเป็น${THEME_LABEL[THEME_NEXT[mode]]})`
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-muted-fg transition-colors duration-200 hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      <Icon name={THEME_ICON[mode]} className="size-5" />
    </button>
  )
}

export function Field({ label, icon, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-medium text-muted-fg ${className}`}>
      <span className="flex items-center gap-1.5">
        {icon && <Icon name={icon} className="size-4 text-muted-fg" />}
        {label}
      </span>
      {children}
    </label>
  )
}

// ช่องกรอกที่ผู้ช่วยชี้ได้: problem = { field, text } (theme.js accountProblem / serverProblem)
// ช่องที่ผิด = กรอบแดง + ผู้ช่วยยกมือชี้จากด้านล่างพร้อมบอกว่าต้องแก้อะไร
// ในกริด 2 คอลัมน์ (ใส่ grid-flow-dense ที่กริด) กล่องคำพูดกว้างเต็มแถว side="right" = ช่องอยู่คอลัมน์ขวา ผู้ช่วยยืนขวา
// mascot = { who, pet } เลือกตัวที่ชี้เอง (หน้า login) ไม่ส่ง = ตัวที่ผู้ใช้เลือกไว้
export function CheckedField({ label, name, problem, side = 'left', mascot, ...input }) {
  const bad = problem?.field === name
  return (
    <>
      <Field label={label}>
        <input name={name} className={`${inputClass} ${bad ? invalidClass : ''}`} aria-invalid={bad || undefined} {...input} />
      </Field>
      {bad && (
        <PointHint key={problem.text} align={side} {...mascot} className="-mt-1 sm:col-span-2">
          {problem.text}
        </PointHint>
      )}
    </>
  )
}

export function PrimaryButton({ loading, children, loadingText = 'กำลังโหลด…' }) {
  return (
    <button
      disabled={loading}
      className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-action px-5 font-medium text-on-action transition-colors duration-200 hover:bg-action-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
    >
      {loading && <MascotLoader />}
      {loading ? loadingText : children}
    </button>
  )
}

// หัวการ์ดเป็นตัวหนังสือล้วน (เดิมมีกล่องไอคอนหน้าหัวข้อทุกการ์ด = หน้าตาแบบ template ทั่วไป, critique 2026-10-16)
// prop icon ยังรับไว้ให้ที่เรียกเดิมไม่พัง แต่ไม่วาดแล้ว
export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-line bg-card p-5 sm:p-6 ${className}`}>
      {title && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted-fg">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

// คำเตือน "ยังไม่ปรับเทียบ" ใช้ข้อความเดียวกันทุกหน้า (เดิม 4 แบบ คนเลยเลิกอ่าน critique 2026-10-16)
// ข้อความเต็มจาก backend อยู่ใน title ชี้ค้างแล้วเห็น
export function UncalibratedNote({ detail }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-risk-mid" title={detail}>
      <Icon name="warning" className="size-4 shrink-0" />
      {UNCALIBRATED}
    </p>
  )
}

export function Alert({ tone = 'error', children }) {
  const style = tone === 'error' ? 'border-risk-high/15 bg-risk-high-soft text-risk-high' : 'border-risk-mid/15 bg-risk-mid-soft text-risk-mid'
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`flex gap-2.5 rounded-lg border px-4 py-3 text-sm ${style}`}>
      <Icon name={tone} className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

// โครงสีเทากะพริบระหว่างโหลด กันหน้ากระโดด (CLS)
export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

export function CountUp({ value, format = Math.round }) {
  return format(useCountUp(value))
}

// คะแนนใหญ่ + แถบไล่สีเขียว เหลือง แดง พร้อมหมุดตำแหน่งคะแนนและเส้นเกณฑ์
// avg (0–1, ไม่บังคับ) = ค่าเฉลี่ยบริษัท วาดเป็นขีดบนแถบ + บอกว่าคนนี้สูง/ต่ำกว่าค่าเฉลี่ยกี่คะแนน
export function RiskGauge({ title, score, band = bandOf(score), bandTh, size = 'lg', avg }) {
  const b = BAND[band]
  const pct = Math.min(100, Math.max(0, score * 100))
  return (
    <div>
      <div className="text-xs font-medium tracking-wide text-muted-fg">{title}</div>
      <div className="mt-1 flex items-end gap-2">
        <span className={`${size === 'lg' ? 'text-5xl' : 'text-4xl'} font-semibold leading-none tabular-nums ${b.text}`}>
          <CountUp value={pct} />
        </span>
        <span className="pb-0.5 text-sm text-muted-fg">/ 100</span>
        <span className={`ml-auto whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-semibold ring-1 ${b.pill}`}>เสี่ยง{bandTh ?? b.th}</span>
      </div>
      <div
        className="relative mt-4 h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, var(--color-band-low) 0 ${LOW * 100}%, var(--color-band-mid) 0 ${HIGH * 100}%, var(--color-band-high) 0)`,
        }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={title}
      >
        {avg != null && (
          <div className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg/45" style={{ left: `${avg * 100}%` }} aria-hidden="true" />
        )}
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-fg ring-1 ring-line transition-[left] duration-300"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-xs tabular-nums text-muted-fg">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${LOW * 100}%` }}>{LOW * 100}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${HIGH * 100}%` }}>{HIGH * 100}</span>
        <span className="absolute right-0">100</span>
      </div>
      {avg != null && <AvgNote pct={pct} avg={Math.round(avg * 100)} />}
    </div>
  )
}

function AvgNote({ pct, avg }) {
  const diff = Math.round(pct) - avg
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-fg">
      <span className="h-3 w-0.5 shrink-0 rounded-full bg-fg/45" aria-hidden="true" />
      ค่าเฉลี่ยบริษัท {avg}
      <span className="text-fg">
        · {diff === 0 ? 'เท่าค่าเฉลี่ย' : `${diff > 0 ? 'สูงกว่า' : 'ต่ำกว่า'}ค่าเฉลี่ย ${Math.abs(diff)} คะแนน`}
      </span>
    </div>
  )
}

// กลุ่มตัวเลือกแบบเลือกได้อย่างเดียว ตามแบบ radio group: Tab เข้ากลุ่มครั้งเดียว แล้วใช้ลูกศรเลื่อนเลือก
export function Segmented({ options, value, onChange, label, size = 'md' }) {
  const current = Math.max(0, options.findIndex(([v]) => String(v) === String(value)))
  function onKeyDown(e) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (current + step + options.length) % options.length
    onChange(options[next][0])
    e.currentTarget.querySelectorAll('[role=radio]')[next]?.focus()
  }
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map(([v, text], i) => {
        const active = i === current
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(v)}
            className={`flex-1 cursor-pointer whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              size === 'sm' ? 'h-8' : 'h-10'
            } ${active ? 'bg-action font-semibold text-on-action shadow-sm' : 'text-muted-fg hover:bg-card hover:text-fg'}`}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
