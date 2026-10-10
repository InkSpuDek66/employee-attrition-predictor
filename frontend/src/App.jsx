import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Logo from '../logo/Logo'
import Login from './Login'
import Mascot from './mascot/Mascot'
import Overview from './Overview'
import { inputClass, loadMascot, loadSession, saveMascot, saveSession, THB_PER_USD } from './theme'
import { Field, Icon, PrimaryButton, Skeleton, ThemeToggle } from './ui'
import WhatIfSimulator from './WhatIfSimulator'

// หน้าที่ไม่ได้ใช้ตอนเปิดเว็บ โหลดแยกเป็นไฟล์ย่อย หน้าแรกจะเปิดเร็วขึ้น
const ShapViewer = lazy(() => import('./ShapViewer'))
const Upload = lazy(() => import('./Upload'))
const Calibrate = lazy(() => import('./Calibrate'))

// หน้าหลัก: แต่ละคนเพิ่ม component ของตัวเอง (เช่น Intervention Tracker) เป็นแท็บใหม่ใน TABS
// component ของเครื่องมือรายคนได้ prop:
//   query = { id, tenant, n } ของพนักงานที่เลือก (n เพิ่มทุกครั้งที่กดโหลด ให้โหลดซ้ำได้, tenant = บริษัทของผู้ login)
//   onRisk({ id, band, score, label } | { error, notFound }) = แจ้งตัวการ์ตูนใน sidebar
//   onDone() = โหลดเสร็จ (สำเร็จหรือพัง) ให้ปุ่ม "โหลด" เลิกหมุน
//   rate = บาทต่อ 1 ดอลลาร์ (backend ส่งมาตอน login, สำรองด้วย THB_PER_USD ใน theme.js), dark = ธีม (สีแท่งกราฟ SHAP เลือกตามธีม), who = ผู้ช่วยที่เลือก
// แท็บ/รหัสพนักงานเก็บใน URL (?tab=whatif&id=5) แชร์ลิงก์ได้ และปุ่ม back ใช้ได้
// ต้อง login ก่อน (Login.jsx) บริษัทมาจากผู้ใช้ ไม่ให้พิมพ์เอง (SEC-02)
const TABS = [
  { id: 'overview', icon: 'chart', label: 'ภาพรวมบริษัท', short: 'ภาพรวม', hint: 'ใครเสี่ยงลาออก และเพราะอะไร' },
  { id: 'shap', icon: 'search', label: 'SHAP Viewer', short: 'SHAP', hint: 'ทำไมพนักงานคนนี้ถึงเสี่ยง', Component: ShapViewer },
  { id: 'whatif', icon: 'sliders', label: 'What-if Simulator', short: 'What-if', hint: 'ถ้าปรับเงื่อนไข ความเสี่ยงจะเปลี่ยนไหม', Component: WhatIfSimulator },
  { id: 'calibrate', icon: 'scale', label: 'ปรับเทียบโมเดล', short: 'ปรับเทียบ', hint: 'ปรับคะแนนให้ตรงกับอัตราลาออกจริงของบริษัท', admin: true },
  { id: 'import', icon: 'upload', label: 'นำเข้าข้อมูล', short: 'นำเข้า', hint: 'อัปโหลดรายชื่อพนักงานของบริษัท' },
]
const PER_EMPLOYEE = TABS.filter((t) => t.Component).map((t) => t.id)

function fromUrl() {
  const p = new URLSearchParams(location.search)
  const tab = TABS.some((t) => t.id === p.get('tab')) ? p.get('tab') : 'overview'
  const id = Number(p.get('id')) > 0 ? p.get('id') : ''
  return { tab, id }
}

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [expired, setExpired] = useState(false)
  // ธีมอยู่ระดับบนสุด หน้า login กับหน้าหลักใช้ค่าเดียวกัน (index.html ตั้ง class ไว้ก่อน render แล้ว)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
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
  // backend ตอบ 401 (token หมดอายุ / backend restart) = กลับไปหน้า login
  useEffect(() => {
    const expire = () => (saveSession(null), setSession(null), setExpired(true))
    addEventListener('session-expired', expire)
    return () => removeEventListener('session-expired', expire)
  }, [])
  const theme = { dark, onToggleTheme: toggleTheme }
  if (!session) return <Login onLogin={(s) => (saveSession(s), setSession(s), setExpired(false))} expired={expired} {...theme} />
  return <Workspace user={session.user} settings={session.settings} onLogout={() => (saveSession(null), setSession(null), setExpired(false))} {...theme} />
}

function Workspace({ user, settings, onLogout, dark, onToggleTheme }) {
  const tenant = user.tenant_id
  const tabs = TABS.filter((t) => !t.admin || user.role === 'admin') // แท็บ admin ไม่โชว์ให้ HR
  const [initial] = useState(fromUrl) // อ่าน URL ครั้งเดียวตอนเปิดหน้า
  const [wantedTab, setTab] = useState(initial.tab)
  const tab = tabs.some((t) => t.id === wantedTab) ? wantedTab : 'overview' // HR เปิดลิงก์แท็บ admin = ไปหน้าภาพรวม
  // ข้อมูลเปลี่ยน (ปรับเทียบ/นำเข้าพนักงาน) = เพิ่มเลขนี้ หน้าภาพรวม/SHAP/What-if โหลดใหม่ด้วยคะแนนล่าสุด
  const [dataVersion, setDataVersion] = useState(0)
  const refreshData = () => setDataVersion((v) => v + 1)
  const [employeeId, setEmployeeId] = useState(initial.id || '1')
  const [query, setQuery] = useState(initial.id ? { id: Number(initial.id), tenant, n: 1 } : null)
  const [pending, setPending] = useState(() => (initial.id ? Object.fromEntries(PER_EMPLOYEE.map((t) => [t, true])) : {}))
  const rate = settings?.thb_per_usd ?? THB_PER_USD // จาก backend (DE-01) ผู้ใช้ไม่ต้องรู้ว่าโมเดลใช้ดอลลาร์เบื้องหลัง
  const [risk, setRisk] = useState({}) // ความเสี่ยงล่าสุดแยกตามแท็บ
  const [who, setWho] = useState(loadMascot) // ผู้ช่วยที่เลือก ใช้ทั้ง sidebar และหน้าว่าง
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
      if (!u.id) return setQuery(null)
      setQuery((q) => {
        if (q?.id === Number(u.id)) return q // คนเดิม ไม่ต้องโหลดใหม่
        setPending(Object.fromEntries(PER_EMPLOYEE.map((t) => [t, true])))
        return { id: Number(u.id), tenant, n: (q?.n ?? 0) + 1 }
      })
    }
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [tenant])

  function load(id) {
    setQuery((q) => ({ id: Number(id), tenant, n: (q?.n ?? 0) + 1 }))
    setPending(Object.fromEntries(PER_EMPLOYEE.map((t) => [t, true])))
  }

  function submit(e) {
    e.preventDefault()
    load(employeeId)
    if (!PER_EMPLOYEE.includes(tab)) setTab('shap') // แท็บที่ไม่ใช่รายคน (ภาพรวม, นำเข้า) พาไปดูคนนั้น
  }

  // เลือกพนักงานจากรายชื่อ (ภาพรวม/หน้าว่าง) แล้วไปดูว่าทำไมถึงเสี่ยง
  function pick(id) {
    setEmployeeId(String(id))
    load(id)
    if (!PER_EMPLOYEE.includes(tab)) setTab('shap') // แท็บที่ไม่ใช่รายคน (ภาพรวม, นำเข้า) พาไปดูคนนั้น
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
      {/* จอเตี้ย (แล็ปท็อปซูม 100%): sidebar เลื่อนได้ในตัว กล่องผู้ใช้ + ปุ่มออกจากระบบติดขอบล่างเสมอ */}
      <aside className="border-b border-line bg-card lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-4 py-4 lg:py-6">
          <Logo className="size-10 shrink-0" />
          <div className="leading-tight">
            <div className="whitespace-nowrap text-sm font-semibold text-fg" translate="no">
              Attrition Predictor
            </div>
            <div className="text-xs text-muted-fg">HR Analytics</div>
          </div>
          <ThemeToggle dark={dark} onToggle={onToggleTheme} className="ml-auto" />
        </div>

        {/* มือถือ: 4 ช่องเท่ากัน ไอคอนบนชื่อสั้น เห็นครบทุกแท็บไม่ต้องเลื่อน / จอใหญ่: รายการแนวตั้งใน sidebar */}
        <nav
          className="grid gap-1 px-2 pb-2 lg:flex lg:flex-col lg:px-3 lg:pb-0"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          aria-label="เครื่องมือ"
        >
          <div className="hidden px-2 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-fg/70 lg:block">
            เครื่องมือวิเคราะห์
          </div>
          {tabs.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-left lg:text-sm ${
                  active ? 'bg-primary-soft text-fg' : 'text-muted-fg hover:bg-muted hover:text-fg'
                }`}
              >
                {active && <span className="absolute inset-y-2 left-0 hidden w-1 rounded-r bg-accent lg:block" />}
                <Icon name={t.icon} className="size-5" />
                <span className="lg:hidden">{t.short}</span>
                <span className="hidden lg:inline">{t.label}</span>
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
        <div className="flex items-center gap-3 border-t border-line bg-card px-4 py-3 lg:sticky lg:bottom-0 lg:px-5">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-fg">
            <Icon name="user" className="size-5" />
          </div>
          <div className="min-w-0 flex-1 leading-tight" title={`${user.username} · ${user.tenant_id}`}>
            <div className="truncate text-sm font-medium text-fg">{user.name}</div>
            <div className="text-xs text-muted-fg">{user.tenant_name ?? user.tenant_id}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-muted-fg transition-colors duration-200 hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Icon name="logout" className="size-5" />
          </button>
        </div>

      </aside>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-sm font-medium text-muted-fg">{current.label}</div>
            <h1 className="mt-0.5 text-balance text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{current.hint}</h1>
          </div>
          {/* ช่องรหัสพนักงานใช้เฉพาะแท็บรายคน (ภาพรวม/นำเข้า เลือกคนจากรายชื่อแทน) */}
          {PER_EMPLOYEE.includes(tab) && (
            <form
              onSubmit={submit}
              className="grid gap-3 rounded-xl border border-line bg-card p-3 sm:max-w-md sm:grid-cols-[1fr_auto] sm:items-end xl:w-[22rem] xl:shrink-0"
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
              <PrimaryButton loading={!!pending[tab]}>
                โหลด <Icon name="right" className="size-4" />
              </PrimaryButton>
            </form>
          )}
        </header>

        <div hidden={tab !== 'overview'} key={`overview-${dataVersion}`}>
          <Overview rate={rate} onPick={pick} />
        </div>
        <Suspense fallback={tab === 'import' || tab === 'calibrate' ? <Skeleton className="h-96" /> : null}>
          <div hidden={tab !== 'import'}>
            <Upload canSave={user.role === 'admin'} onSaved={refreshData} onPick={pick} />
          </div>
          {user.role === 'admin' && (
            <div hidden={tab !== 'calibrate'}>
              <Calibrate onChanged={refreshData} />
            </div>
          )}
        </Suspense>
        {/* เก็บทุกแท็บไว้ (ซ่อนด้วย hidden) สลับแท็บแล้วข้อมูลที่โหลดไว้ไม่หาย */}
        <Suspense fallback={<Skeleton className="h-96" />}>
          {TABS.filter((t) => t.Component).map(({ id, Component }) => (
            <div key={`${id}-${dataVersion}`} hidden={tab !== id}>
              <Component query={query} rate={rate} dark={dark} who={who} tenant={tenant} onRisk={onRisk[id]} onDone={onDone[id]} onPick={pick} />
            </div>
          ))}
        </Suspense>
      </main>
    </div>
  )
}
