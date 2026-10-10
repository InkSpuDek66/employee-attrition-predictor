// ชิ้นส่วน UI ที่ SHAP Viewer กับ What-if Simulator ใช้ร่วมกัน
import { BAND, bandOf, GAUGE, HIGH, LOW } from './theme'

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
  moon: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z',
  upload: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5',
  download: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
  check: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
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

export function PrimaryButton({ loading, children, loadingText = 'กำลังโหลด…' }) {
  return (
    <button
      disabled={loading}
      className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 font-medium text-on-primary transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/30 disabled:cursor-wait disabled:opacity-60"
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />}
      {loading ? loadingText : children}
    </button>
  )
}

export function Card({ title, subtitle, icon, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-line bg-card p-5 sm:p-6 ${className}`}>
      {title && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon name={icon} className="size-5" />
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-fg">{title}</h2>
              {subtitle && <p className="text-sm text-muted-fg">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
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
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />
}

// คะแนนใหญ่ + แถบไล่สีเขียว เหลือง แดง พร้อมหมุดตำแหน่งคะแนนและเส้นเกณฑ์
export function RiskGauge({ title, score, band = bandOf(score), bandTh, size = 'lg' }) {
  const b = BAND[band]
  const pct = Math.min(100, Math.max(0, score * 100))
  return (
    <div>
      <div className="text-xs font-medium tracking-wide text-muted-fg">{title}</div>
      <div className="mt-1 flex items-end gap-2">
        <span className={`${size === 'lg' ? 'text-5xl' : 'text-4xl'} font-semibold leading-none tabular-nums ${b.text}`}>
          {Math.round(pct)}
        </span>
        <span className="pb-0.5 text-sm text-muted-fg">/ 100</span>
        <span className={`ml-auto rounded-md px-2.5 py-1 text-sm font-semibold ring-1 ${b.pill}`}>เสี่ยง{bandTh ?? b.th}</span>
      </div>
      <div
        className="relative mt-4 h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, ${GAUGE[0]} 0 ${LOW * 100}%, ${GAUGE[1]} 0 ${HIGH * 100}%, ${GAUGE[2]} 0)`,
        }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={title}
      >
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-fg ring-1 ring-line transition-[left] duration-300"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-muted-fg">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${LOW * 100}%` }}>{LOW * 100}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${HIGH * 100}%` }}>{HIGH * 100}</span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  )
}

export function Segmented({ options, value, onChange, label, size = 'md' }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => {
        const active = String(v) === String(value)
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={`flex-1 cursor-pointer whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              size === 'sm' ? 'h-8' : 'h-10'
            } ${active ? 'bg-card text-primary ring-1 ring-line' : 'text-muted-fg hover:text-fg'}`}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
