import { useState } from 'react'
import ShapViewer from './ShapViewer'
import { DEFAULT_RATE, inputClass } from './theme'
import { Field, Icon, PrimaryButton } from './ui'
import WhatIfSimulator from './WhatIfSimulator'

// หน้าหลัก: แต่ละคนเพิ่ม component ของตัวเอง (Intervention Tracker, Company Summary) เป็นแท็บใหม่ใน TABS
// component ได้ prop query = { id, tenant, n } ของพนักงานที่เลือก (n เพิ่มทุกครั้งที่กดโหลด ให้โหลดซ้ำได้)
// rate = บาทต่อ 1 ดอลลาร์ ใช้แปลงเงินใน dataset, dark = ธีมปัจจุบัน (กราฟ recharts ต้องรู้เพื่อเลือกสี)
const TABS = [
  { id: 'shap', icon: 'search', label: 'SHAP Viewer', hint: 'ทำไมพนักงานคนนี้ถึงเสี่ยง', Component: ShapViewer },
  { id: 'whatif', icon: 'sliders', label: 'What-if Simulator', hint: 'ถ้าปรับเงื่อนไข ความเสี่ยงจะเปลี่ยนไหม', Component: WhatIfSimulator },
]

export default function App() {
  const [tab, setTab] = useState('shap')
  const [employeeId, setEmployeeId] = useState('1')
  const [tenantId, setTenantId] = useState('')
  const [query, setQuery] = useState(null)
  const [rate, setRate] = useState(DEFAULT_RATE)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const current = TABS.find((t) => t.id === tab)

  function submit(e) {
    e.preventDefault()
    setQuery((q) => ({ id: Number(employeeId), tenant: tenantId.trim(), n: (q?.n ?? 0) + 1 }))
  }

  function toggleTheme() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // private mode / storage ปิด: สลับได้แต่ไม่จำ
    }
    setDark(next)
  }

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar (จอใหญ่) / แถบบน (มือถือ) */}
      <aside className="border-b border-line bg-card lg:fixed lg:border-b-0 lg:border-r lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center gap-2.5 px-4 py-4 lg:py-6">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-on-primary">
            <Icon name="trend" className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="whitespace-nowrap text-sm font-semibold text-fg">Attrition Predictor</div>
            <div className="text-xs text-muted-fg">HR Analytics</div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            title={dark ? 'โหมดสว่าง' : 'โหมดมืด'}
            className="ml-auto grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-muted-fg transition-colors duration-200 hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Icon name={dark ? 'sun' : 'moon'} className="size-5" />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0" aria-label="เครื่องมือ">
          <div className="hidden px-2 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-fg/70 lg:block">
            เครื่องมือวิเคราะห์
          </div>
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  active ? 'bg-muted text-fg' : 'text-muted-fg hover:bg-muted hover:text-fg'
                }`}
              >
                {active && <span className="absolute inset-y-2 left-0 hidden w-1 rounded-r bg-primary lg:block" />}
                <Icon name={t.icon} className="size-5" />
                {t.label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto hidden border-t border-line px-5 py-4 text-xs text-muted-fg lg:block">
          โมเดล <span className="font-medium text-fg">attrition-xgboost-P</span>
          <br />
          คะแนนใช้จัดลำดับความเสี่ยง ไม่ใช่คำตัดสิน
        </div>
      </aside>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        <header className="mb-6 flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <div className="text-sm font-medium text-muted-fg">{current.label}</div>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{current.hint}</h1>
          </div>
          <form
            onSubmit={submit}
            className="grid gap-3 rounded-xl border border-line bg-card p-3 sm:grid-cols-[8rem_1fr_8rem_auto] sm:items-end 2xl:w-[44rem]"
          >
            <Field label="รหัสพนักงาน" icon="user">
              <input className={inputClass} type="number" min="1" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
            </Field>
            <Field label="รหัสบริษัท (ถ้าปรับเทียบแล้ว)">
              <input className={inputClass} value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="ไม่ระบุก็ได้" />
            </Field>
            <Field label="บาท / 1 ดอลลาร์">
              <input
                className={inputClass}
                type="number"
                min="1"
                step="0.5"
                value={rate}
                onChange={(e) => e.target.value > 0 && setRate(Number(e.target.value))}
                title="dataset เป็นดอลลาร์ หน้าเว็บแปลงเป็นบาทด้วยอัตรานี้"
              />
            </Field>
            <PrimaryButton>
              โหลด <Icon name="right" className="size-4" />
            </PrimaryButton>
          </form>
        </header>

        {/* เก็บทุกแท็บไว้ (ซ่อนด้วย hidden) สลับแท็บแล้วข้อมูลที่โหลดไว้ไม่หาย */}
        {TABS.map(({ id, Component }) => (
          <div key={id} hidden={tab !== id}>
            <Component query={query} rate={rate} dark={dark} />
          </div>
        ))}
      </main>
    </div>
  )
}
