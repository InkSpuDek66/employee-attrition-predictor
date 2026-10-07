import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Mascot from './Mascot'
import Overview from './Overview'
import { inputClass, loadMascot, saveMascot, THB_PER_USD } from './theme'
import { Field, Icon, PrimaryButton, Skeleton } from './ui'
import WhatIfSimulator from './WhatIfSimulator'

// SHAP Viewer ใช้ recharts (ก้อนใหญ่) โหลดแยกตอนเปิดใช้ หน้าแรกจะเปิดเร็วขึ้น
const ShapViewer = lazy(() => import('./ShapViewer'))

// หน้าหลัก: แต่ละคนเพิ่ม component ของตัวเอง (เช่น Intervention Tracker) เป็นแท็บใหม่ใน TABS
// component ของเครื่องมือรายคนได้ prop:
//   query = { id, tenant, n } ของพนักงานที่เลือก (n เพิ่มทุกครั้งที่กดโหลด ให้โหลดซ้ำได้)
//   onRisk({ id, band, score, label } | { error, notFound }) = แจ้งตัวการ์ตูนใน sidebar
//   onDone() = โหลดเสร็จ (สำเร็จหรือพัง) ให้ปุ่ม "โหลด" เลิกหมุน
//   rate = บาทต่อ 1 ดอลลาร์ (ค่าคงที่ THB_PER_USD ใน theme.js), dark = ธีม (กราฟ recharts ต้องรู้เพื่อเลือกสี), who = ผู้ช่วยที่เลือก
// แท็บ/รหัสพนักงาน/รหัสบริษัทเก็บใน URL (?tab=whatif&id=5) แชร์ลิงก์ได้ และปุ่ม back ใช้ได้
const TABS = [
  { id: 'overview', icon: 'chart', label: 'ภาพรวมบริษัท', hint: 'ใครเสี่ยงลาออก และเพราะอะไร' },
  { id: 'shap', icon: 'search', label: 'SHAP Viewer', hint: 'ทำไมพนักงานคนนี้ถึงเสี่ยง', Component: ShapViewer },
  { id: 'whatif', icon: 'sliders', label: 'What-if Simulator', hint: 'ถ้าปรับเงื่อนไข ความเสี่ยงจะเปลี่ยนไหม', Component: WhatIfSimulator },
]
const PER_EMPLOYEE = TABS.filter((t) => t.Component).map((t) => t.id)

function fromUrl() {
  const p = new URLSearchParams(location.search)
  const tab = TABS.some((t) => t.id === p.get('tab')) ? p.get('tab') : 'overview'
  const id = Number(p.get('id')) > 0 ? p.get('id') : ''
  return { tab, id, tenant: p.get('tenant') ?? '' }
}

export default function App() {
  const [initial] = useState(fromUrl) // อ่าน URL ครั้งเดียวตอนเปิดหน้า
  const [tab, setTab] = useState(initial.tab)
  const [employeeId, setEmployeeId] = useState(initial.id || '1')
  const [tenantId, setTenantId] = useState(initial.tenant)
  const [query, setQuery] = useState(initial.id ? { id: Number(initial.id), tenant: initial.tenant, n: 1 } : null)
  const [pending, setPending] = useState(() => (initial.id ? Object.fromEntries(PER_EMPLOYEE.map((t) => [t, true])) : {}))
  const rate = THB_PER_USD // คงที่ ผู้ใช้ไม่ต้องรู้ว่าโมเดลใช้ดอลลาร์เบื้องหลัง
  const [risk, setRisk] = useState({}) // ความเสี่ยงล่าสุดแยกตามแท็บ
  const [who, setWho] = useState(loadMascot) // ผู้ช่วยที่เลือก ใช้ทั้ง sidebar และหน้าว่าง
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  // handler คงที่ต่อแท็บ ใส่ใน deps ของ effect ได้โดยไม่ทำให้โหลดซ้ำ
  const onRisk = useMemo(() => Object.fromEntries(PER_EMPLOYEE.map((t) => [t, (r) => setRisk((m) => ({ ...m, [t]: r }))])), [])
  const onDone = useMemo(() => Object.fromEntries(PER_EMPLOYEE.map((t) => [t, () => setPending((p) => ({ ...p, [t]: false }))])), [])
  const current = TABS.find((t) => t.id === tab)

  // เขียนสถานะลง URL (ระบบภายนอก) — เปลี่ยนแท็บ/โหลดพนักงานใหม่ = 1 รายการใน history
  // ครั้งแรกตอนเปิดหน้าใช้ replace ไม่งั้นต้องกด back สองครั้งถึงออกจากเว็บ
  const firstUrlWrite = useRef(true)
  useEffect(() => {
    const p = new URLSearchParams({ tab })
    if (query) p.set('id', query.id)
    if (query?.tenant) p.set('tenant', query.tenant)
    const next = `?${p}`
    if (firstUrlWrite.current) history.replaceState(null, '', next)
    else if (next !== location.search) history.pushState(null, '', next)
    firstUrlWrite.current = false
  }, [tab, query])

  // ปุ่ม back/forward: อ่าน URL แล้วตั้งสถานะตาม
  useEffect(() => {
    function onPop() {
      const u = fromUrl()
      setTab(u.tab)
      setEmployeeId(u.id || '1')
      setTenantId(u.tenant)
      if (!u.id) return setQuery(null)
      setQuery((q) => {
        if (q?.id === Number(u.id) && q.tenant === u.tenant) return q // คนเดิม ไม่ต้องโหลดใหม่
        setPending(Object.fromEntries(PER_EMPLOYEE.map((t) => [t, true])))
        return { id: Number(u.id), tenant: u.tenant, n: (q?.n ?? 0) + 1 }
      })
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  function load(id, tenant) {
    setQuery((q) => ({ id: Number(id), tenant, n: (q?.n ?? 0) + 1 }))
    setPending(Object.fromEntries(PER_EMPLOYEE.map((t) => [t, true])))
  }

  function submit(e) {
    e.preventDefault()
    load(employeeId, tenantId.trim())
    if (tab === 'overview') setTab('shap')
  }

  // เลือกพนักงานจากรายชื่อ (ภาพรวม/หน้าว่าง) แล้วไปดูว่าทำไมถึงเสี่ยง
  function pick(id) {
    setEmployeeId(String(id))
    load(id, tenantId.trim())
    if (tab === 'overview') setTab('shap')
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
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      {/* Sidebar (จอใหญ่) / แถบบน (มือถือ) */}
      <aside className="border-b border-line bg-card lg:fixed lg:border-b-0 lg:border-r lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center gap-2.5 px-4 py-4 lg:py-6">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-on-primary">
            <Icon name="trend" className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="whitespace-nowrap text-sm font-semibold text-fg" translate="no">
              Attrition Predictor
            </div>
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

        <div className="hidden flex-1 items-center justify-center lg:flex">
          <Mascot risk={risk[tab]} who={who} onChoose={(v) => (setWho(v), saveMascot(v))} />
        </div>

        <div className="hidden border-t border-line px-5 py-4 text-xs text-muted-fg lg:block">
          โมเดล{' '}
          <span className="font-medium text-fg" translate="no">
            attrition-xgboost-P
          </span>
          <br />
          คะแนนใช้จัดลำดับความเสี่ยง ไม่ใช่คำตัดสิน
        </div>
      </aside>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        <header className="mb-6 flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <div className="text-sm font-medium text-muted-fg">{current.label}</div>
            <h1 className="mt-0.5 text-balance text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{current.hint}</h1>
          </div>
          <form
            onSubmit={submit}
            className="grid gap-3 rounded-xl border border-line bg-card p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end 2xl:w-[36rem]"
          >
            <Field label="รหัสพนักงาน" icon="user">
              <input
                className={inputClass}
                name="employee_id"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                min="1"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </Field>
            <Field label="รหัสบริษัท (ถ้าปรับเทียบแล้ว)">
              <input
                className={inputClass}
                name="tenant_id"
                autoComplete="off"
                spellCheck={false}
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="ไม่ระบุก็ได้ เช่น acme_th…"
              />
            </Field>
            <PrimaryButton loading={!!pending[tab]}>
              โหลด <Icon name="right" className="size-4" />
            </PrimaryButton>
          </form>
        </header>

        <div hidden={tab !== 'overview'}>
          <Overview rate={rate} tenant={query?.tenant ?? ''} onPick={pick} />
        </div>
        {/* เก็บทุกแท็บไว้ (ซ่อนด้วย hidden) สลับแท็บแล้วข้อมูลที่โหลดไว้ไม่หาย */}
        <Suspense fallback={<Skeleton className="h-96" />}>
          {TABS.filter((t) => t.Component).map(({ id, Component }) => (
            <div key={id} hidden={tab !== id}>
              <Component query={query} rate={rate} dark={dark} who={who} tenant={query?.tenant ?? ''} onRisk={onRisk[id]} onDone={onDone[id]} onPick={pick} />
            </div>
          ))}
        </Suspense>
      </main>
    </div>
  )
}
