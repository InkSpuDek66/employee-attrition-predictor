import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Logo from '../logo/Logo'
import Login from './Login'
import { mascotLine } from './mascot/line'
import { Bubble, MascotLoader, MascotSwitch, SpeakingMascot } from './mascot/Mascot'
import Overview from './Overview'
import { api, BAND, employeeLabel, inputClass, loadMascot, loadRecent, loadSession, pushRecent, saveMascot, saveRecent, saveSession, THEME_NEXT } from './theme'
import { Field, Icon, PrimaryButton, Skeleton, ThemeToggle } from './ui'
import WhatIfSimulator from './WhatIfSimulator'

// หน้าที่ไม่ได้ใช้ตอนเปิดเว็บ โหลดแยกเป็นไฟล์ย่อย หน้าแรกจะเปิดเร็วขึ้น
const ShapViewer = lazy(() => import('./ShapViewer'))
const Upload = lazy(() => import('./Upload'))
const Calibrate = lazy(() => import('./Calibrate'))
const Users = lazy(() => import('./Users'))

// หน้าหลัก: แต่ละคนเพิ่ม component ของตัวเอง (เช่น Intervention Tracker) เป็นแท็บใหม่ใน TABS
// component ของเครื่องมือรายคนได้ prop:
//   query = { id, tenant, n } ของพนักงานที่เลือก (n เพิ่มทุกครั้งที่กดโหลด ให้โหลดซ้ำได้, tenant = บริษัทของผู้ login)
//   onRisk({ id, band, score, label } | { error, notFound }) = แจ้งตัวการ์ตูนใน sidebar
//   onDone() = โหลดเสร็จ (สำเร็จหรือพัง) ให้ปุ่ม "โหลด" เลิกหมุน
//   เงินจาก API เป็นบาทแล้ว (DE-01) ไม่ต้องแปลง, dark = ธีม (สีแท่งกราฟ SHAP เลือกตามธีม), who = ผู้ช่วยที่เลือก
// แท็บ/รหัสพนักงานเก็บใน URL (?tab=whatif&id=5) แชร์ลิงก์ได้ และปุ่ม back ใช้ได้
// ต้อง login ก่อน (Login.jsx) บริษัทมาจากผู้ใช้ ไม่ให้พิมพ์เอง (SEC-02)
const TABS = [
  { id: 'overview', icon: 'chart', label: 'ภาพรวมบริษัท', short: 'ภาพรวม', hint: 'ใครเสี่ยงลาออก และเพราะอะไร' },
  { id: 'shap', icon: 'search', label: 'ทำไมถึงเสี่ยง', short: 'ทำไมเสี่ยง', hint: 'ทำไมพนักงานคนนี้ถึงเสี่ยง', Component: ShapViewer },
  { id: 'whatif', icon: 'sliders', label: 'ลองปรับเงื่อนไข', short: 'ลองปรับ', hint: 'ถ้าปรับเงื่อนไข ความเสี่ยงจะเปลี่ยนไหม', Component: WhatIfSimulator },
  { id: 'calibrate', icon: 'scale', label: 'ปรับเทียบโมเดล', short: 'ปรับเทียบ', hint: 'ปรับคะแนนให้ตรงกับอัตราลาออกจริงของบริษัท', admin: true },
  { id: 'import', icon: 'upload', label: 'นำเข้าข้อมูล', short: 'นำเข้า', hint: 'อัปโหลดรายชื่อพนักงานของบริษัท' },
  { id: 'users', icon: 'user', label: 'บัญชีผู้ใช้', short: 'บัญชี', hint: 'ใครเข้าระบบของบริษัทนี้ได้บ้าง', admin: true },
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
  const [welcome, setWelcome] = useState(false) // เพิ่งสร้างบริษัทใหม่: ผู้ช่วยต้อนรับในแอป (ไม่หน่วงหน้า login)
  // ธีมอยู่ระดับบนสุด หน้า login กับหน้าหลักใช้ค่าเดียวกัน (index.html ตั้ง class ไว้ก่อน render แล้ว)
  // mode: system = ตามเบราว์เซอร์ (ค่าเริ่มต้น เปลี่ยนตามทันทีเมื่อเครื่องสลับธีม) | light | dark
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('themeMode') || 'system'
    } catch {
      return 'system'
    }
  })
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const follow = (e) => setSystemDark(e.matches)
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [])
  const dark = mode === 'system' ? systemDark : mode === 'dark'
  useEffect(() => void document.documentElement.classList.toggle('dark', dark), [dark])
  function toggleTheme() {
    const next = THEME_NEXT[mode]
    try {
      if (next === 'system') localStorage.removeItem('themeMode')
      else localStorage.setItem('themeMode', next)
    } catch {
      // private mode / storage ปิด: สลับได้แต่ไม่จำ
    }
    setMode(next)
  }
  // backend ตอบ 401 (token หมดอายุ / backend restart) = กลับไปหน้า login
  useEffect(() => {
    const expire = () => (saveSession(null), setSession(null), setExpired(true))
    addEventListener('session-expired', expire)
    return () => removeEventListener('session-expired', expire)
  }, [])
  const theme = { dark, themeMode: mode, onToggleTheme: toggleTheme }
  if (!session) return <Login onLogin={(s, fresh) => (saveSession(s), setSession(s), setExpired(false), setWelcome(!!fresh))} expired={expired} {...theme} />
  return <Workspace user={session.user} welcome={welcome} onLogout={() => (saveSession(null), setSession(null), setExpired(false), setWelcome(false), history.replaceState(null, '', location.pathname))} {...theme} />
}

// ผู้ช่วยใน sidebar ตอนยังไม่มีอะไรให้ดู: หน้าที่ไม่ใช่รายคนพูดเรื่องของหน้านั้น (ไม่ชวนเลือกพนักงาน)
const IDLE = {
  calibrate: { text: 'มาปรับคะแนนให้ตรงกับบริษัทกัน', sub: 'ใช้ไฟล์พนักงานที่รู้ผลแล้วว่าใครลาออก' },
  import: { text: 'นำเข้ารายชื่อพนักงานกัน!', sub: 'ดาวน์โหลดไฟล์ตัวอย่างแล้วกรอกได้เลย' },
  users: { text: 'ชวนเพื่อนในทีมมาใช้ได้นะ', sub: 'เพิ่มบัญชีแล้วส่งชื่อผู้ใช้กับรหัสผ่านให้' },
}

function Workspace({ user, welcome, onLogout, dark, themeMode, onToggleTheme }) {
  const tenant = user.tenant_id
  const tabs = TABS.filter((t) => !t.admin || user.role === 'admin') // แท็บ admin ไม่โชว์ให้ HR
  const [initial] = useState(fromUrl) // อ่าน URL ครั้งเดียวตอนเปิดหน้า
  const [wantedTab, setTab] = useState(initial.tab)
  const tab = tabs.some((t) => t.id === wantedTab) ? wantedTab : 'overview' // HR เปิดลิงก์แท็บ admin = ไปหน้าภาพรวม
  // ข้อมูลเปลี่ยน (ปรับเทียบ/นำเข้าพนักงาน) = เพิ่มเลขนี้ หน้าภาพรวม/SHAP/What-if โหลดใหม่ด้วยคะแนนล่าสุด
  const [dataVersion, setDataVersion] = useState(0)
  const refreshData = () => setDataVersion((v) => v + 1)
  // ผู้ช่วยพูดหลังทำอะไรสำเร็จ: จอใหญ่ = กล่องคำพูดออกจากผู้ช่วยในแท่งเมนู (ท่าดีใจ) / มือถือ = กล่องลอยมุมล่าง
  // หายเองใน 4.5 วินาที ms = null ค้างไว้จนกดปิดหรือกดที่ผู้ช่วย (คำต้อนรับบริษัทใหม่)
  const [say, setSay] = useState(null)
  const sayTimer = useRef(null)
  function speak(text, sub, ms = 4500) {
    clearTimeout(sayTimer.current)
    setSay((s) => ({ n: (s?.n ?? 0) + 1, text, sub, sticky: ms == null }))
    if (ms != null) sayTimer.current = setTimeout(() => setSay(null), ms)
  }
  const hush = () => (clearTimeout(sayTimer.current), setSay(null))
  // เพิ่งสร้างบริษัทใหม่: ต้อนรับครั้งเดียวตอนเข้าแอป และชวนไปนำเข้าข้อมูล (บริษัทใหม่ยังไม่มีพนักงาน) เข้าสู่ระบบปกติไม่มี
  const welcomed = useRef(false)
  useEffect(() => {
    if (!welcome || welcomed.current) return
    welcomed.current = true
    // จอใหญ่ผู้ช่วยอยู่ในแท่งเมนูข้างกล่องคำพูด / มือถือแท่งหุบอยู่ บอกให้หาในเมนู
    const where = matchMedia('(min-width: 1024px)').matches ? 'กดที่ตัวเราเพื่อเลือกผู้ช่วย' : 'เลือกผู้ช่วยได้ในเมนู'
    speak('ยินดีต้อนรับ บริษัทของคุณพร้อมแล้ว!', `${where} แล้วเริ่มจากนำเข้ารายชื่อพนักงาน`, null)
  })
  const [employeeId, setEmployeeId] = useState(initial.id || '1') // ช่องรหัสแบบย่อที่ลอยมุมขวาบน
  // ช่องหาพนักงานด้านบน: ค้างรหัสของคนที่โหลดล่าสุดไว้จนออกจากระบบ (กดที่ช่อง = เลือกทั้งข้อความ พิมพ์ชื่อใหม่ทับได้เลย)
  const [findText, setFindText] = useState(initial.id)
  const [query, setQuery] = useState(initial.id ? { id: Number(initial.id), tenant, n: 1 } : null)
  const [pending, setPending] = useState(() => (initial.id ? Object.fromEntries(PER_EMPLOYEE.map((t) => [t, true])) : {}))
  const [risk, setRisk] = useState({}) // ความเสี่ยงล่าสุดแยกตามแท็บ
  const [who, setWho] = useState(loadMascot) // ผู้ช่วยที่เลือก ใช้ทั้ง sidebar และหน้าว่าง
  // handler คงที่ต่อแท็บ ใส่ใน deps ของ effect ได้โดยไม่ทำให้โหลดซ้ำ
  // โหลดสำเร็จ (มี band) = จำไว้ในรายการที่เพิ่งดู รหัสที่พิมพ์ผิด/โหลดไม่ได้ไม่ถูกจำ
  const [recent, setRecent] = useState(() => loadRecent(tenant))
  // ลำดับความเสี่ยงทั้งบริษัท (เรียงแบบเดียวกับ "ควรคุยกับใครก่อน") ไว้กดคนก่อนหน้า/ถัดไปในหน้ารายคน (critique รอบ 6)
  // โหลดครั้งเดียวต่อเวอร์ชันข้อมูล บริษัทใหญ่เกิน 2,000 คนเลื่อนได้แค่ 2,000 อันดับแรก
  const [ranking, setRanking] = useState({ version: -1, ids: [] })
  const perEmployee = PER_EMPLOYEE.includes(wantedTab)
  useEffect(() => {
    if (!perEmployee || ranking.version === dataVersion) return
    const ctrl = new AbortController()
    api('/company-summary/top-employees?n=2000', { signal: ctrl.signal }).then(
      (d) => setRanking({ version: dataVersion, ids: d.employees.map((e) => e.employee_id) }),
      () => {},
    )
    return () => ctrl.abort()
  }, [perEmployee, dataVersion, ranking.version])
  useEffect(() => saveRecent(tenant, recent), [tenant, recent])
  const onRisk = useMemo(
    () =>
      Object.fromEntries(
        PER_EMPLOYEE.map((t) => [
          t,
          (r) => {
            setRisk((m) => ({ ...m, [t]: r }))
            if (r.band) setRecent((l) => pushRecent(l, r.name ? { id: r.id, name: r.name } : { id: r.id }))
          },
        ]),
      ),
    [],
  )
  const onDone = useMemo(() => Object.fromEntries(PER_EMPLOYEE.map((t) => [t, () => setPending((p) => ({ ...p, [t]: false }))])), [])
  const current = TABS.find((t) => t.id === tab)
  const line = mascotLine({ risk: risk[tab], idle: IDLE[tab] }) // หัวเพจไม่พูดซ้ำกับผู้ช่วยในแท่งเมนู

  // มือถือ: เลื่อนลงไปไกลแล้วมีปุ่มกลับขึ้นด้านบน (หน้าภาพรวมบนมือถือยาวกว่า 3,000 px) จอใหญ่ซ่อนไว้
  // มือถือ/แท็บเล็ต: แท่งเมนูหุบเหลือโลโก้ กดโลโก้ = กาง
  // ตอนกาง: เนื้อหาด้านหลังเป็น inert (กด Tab ไม่หลุดออกไปหลังพื้นหรี่) โฟกัสอยู่ที่ปุ่มโลโก้ Tab ต่อเข้าเมนู
  // หุบด้วย Esc / พื้นหลัง = โฟกัสกลับมาที่โลโก้ ขยายจอจนเป็นจอใหญ่ = หุบเอง (ไม่ให้ main ค้าง inert)
  const [railOpen, setRailOpen] = useState(false)
  const railToggle = useRef(null)
  function closeRail() {
    setRailOpen(false)
    railToggle.current?.focus()
  }
  useEffect(() => {
    if (!railOpen) return
    const onKey = (e) => e.key === 'Escape' && closeRail()
    const desktop = matchMedia('(min-width: 1024px)')
    const onWide = (e) => e.matches && setRailOpen(false)
    addEventListener('keydown', onKey)
    desktop.addEventListener('change', onWide)
    return () => (removeEventListener('keydown', onKey), desktop.removeEventListener('change', onWide))
  }, [railOpen])

  const [farDown, setFarDown] = useState(false)
  useEffect(() => {
    const onScroll = () => setFarDown(scrollY > 1200)
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])

  // จอใหญ่: ช่องรหัสพนักงานด้านบนเลื่อนพ้นจอ = โชว์ช่องรหัสแบบย่อลอยมุมขวาบน เปลี่ยนคนได้ขณะดูข้อมูลด้านล่าง
  // (อยู่คอลัมน์เดียวกับการ์ดคะแนนที่ล็อกไว้ในหน้า SHAP / What-if ซึ่งล็อกที่ top-20 ให้พ้นช่องนี้)
  const headerForm = useRef(null)
  const [formOut, setFormOut] = useState(false)
  useEffect(() => {
    const el = headerForm.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setFormOut(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [tab])

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
      setFindText(u.id)
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
    const typed = (e.currentTarget === headerForm.current ? findText : employeeId).trim()
    if (!/^\d+$/.test(typed)) return // พิมพ์ชื่อ = เลือกจากรายการค้นหา (EmployeeSearch จัดการ Enter เอง)
    setEmployeeId(typed)
    setFindText(typed)
    load(typed)
    if (!PER_EMPLOYEE.includes(tab)) setTab('shap') // แท็บที่ไม่ใช่รายคน (ภาพรวม, นำเข้า) พาไปดูคนนั้น
  }

  // เลือกพนักงานจากรายชื่อ (ภาพรวม/หน้าว่าง) แล้วไปดูว่าทำไมถึงเสี่ยง
  function pick(id) {
    setEmployeeId(String(id))
    setFindText(String(id))
    load(id)
    if (!PER_EMPLOYEE.includes(tab)) setTab('shap') // แท็บที่ไม่ใช่รายคน (ภาพรวม, นำเข้า) พาไปดูคนนั้น
  }

  return (
    <div className="relative isolate min-h-screen lg:pl-28 print:pl-0">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      {/* แท่งเมนูลอยซ้ายแบบ frontend/ref ไอคอนล้วน ชื่อเมนูขึ้นเป็นป้ายตอนชี้/โฟกัส (จอใหญ่)
          มือถือ/แท็บเล็ต: เหลือแค่โลโก้ลอยมุมซ้ายบน กดแล้วแท่งเปิดลงมาด้วย clip-path (.rail-reveal ไม่ขยับความสูงจริง) ไอคอนค่อยๆ โผล่ พื้นหลังหรี่
          กดพื้นหลัง / Esc / เลือกเมนู = หุบ ตอนหุบเมนูข้างในเป็น display: none กด Tab ไม่หลงเข้าไป
          ผู้ช่วยย่อเหลือปุ่มหน้าการ์ตูน (กดแล้วเลือกตัว) ชื่อผู้ใช้/บริษัทอยู่ในป้ายของปุ่มออกจากระบบ */}
      {railOpen && <div className="fade-in fixed inset-0 z-20 bg-ink/40 lg:hidden print:hidden" onClick={closeRail} aria-hidden="true" />}
      <aside
        className={`fixed left-2 top-2 z-30 flex w-16 flex-col items-center gap-2 rounded-[2rem] border border-line bg-card py-2 print:hidden lg:inset-y-4 lg:left-4 lg:max-h-none lg:w-20 lg:overflow-visible lg:py-5 lg:shadow-sm ${
          railOpen ? 'rail-reveal max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-xl' : 'shadow-md'
        }`}
      >
        <button
          ref={railToggle}
          type="button"
          onClick={() => setRailOpen((o) => !o)}
          aria-expanded={railOpen}
          aria-controls="rail-menu"
          aria-label={railOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        >
          <Logo className={`size-10 transition-transform duration-300 ${railOpen ? '-rotate-6 scale-90' : ''}`} />
        </button>
        <Logo className="mb-4 hidden size-11 shrink-0 lg:block" />
        <div
          id="rail-menu"
          className={`flex-1 flex-col items-center gap-2 pt-2 lg:flex lg:pt-0 ${railOpen ? 'fade-up flex' : 'hidden'}`}
        >
          <nav className="flex flex-col items-center gap-2" aria-label="เครื่องมือ">
            {tabs.map((t) => (
              <RailItem key={t.id} label={t.label} active={tab === t.id} onClick={() => (setTab(t.id), setRailOpen(false))}>
                <Icon name={t.icon} className="size-5" />
              </RailItem>
            ))}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-2 pt-4">
            <div className="relative">
              <MascotSwitch who={who} onChoose={(v) => (setWho(v), saveMascot(v))} mood={say ? 'Low' : 'none'} nudge={!!say} onOpen={() => say?.sticky && hush()} />
              {say && (
                <div key={say.n} className="fade-up absolute bottom-0 left-full z-40 ml-6 hidden w-72 lg:block">
                  <SayText say={say} onClose={hush} tail="left" />
                </div>
              )}
            </div>
            <ThemeToggle mode={themeMode} onToggle={onToggleTheme} className="size-11! rounded-full! border-0!" />
            <LogoutButton user={user} onLogout={onLogout} className="size-11! rounded-full! border-0!" />
          </div>
        </div>
      </aside>

      {/* ภาพรวมไม่มีหัวเพจของ App: ข้อความผู้ช่วยหลังทำอะไรสำเร็จ (ดาวน์โหลด CSV) ขึ้นเป็นกล่องลอยมุมล่าง */}
      {/* มือถือ: แท่งเมนูหุบอยู่ ผู้ช่วยพูดในกล่องลอยมุมล่างแทน ทำท่าดีใจข้างข้อความ */}
      {say && (
        <div key={say.n} className="fade-up fixed bottom-5 left-4 right-4 z-30 rounded-2xl bg-card py-2 pl-2 pr-3 shadow-lg ring-1 ring-line lg:hidden print:hidden">
          <SpeakingMascot who={who} mood="Low" replay={say.n} size="plain">
            <SayText say={say} onClose={hush} />
          </SpeakingMascot>
        </div>
      )}

      <main id="main" inert={railOpen || undefined} className="mx-auto max-w-7xl px-4 pb-28 pt-20 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8 print:max-w-none print:p-0">
        {/* หัวเพจ (ยกเว้นภาพรวมที่มีหัวของตัวเอง): ผู้ช่วยพูดหัวข้อ = คำถามของ HR ท่า/คำพูดเปลี่ยนตามความเสี่ยงของคนที่ดูอยู่
            ช่องรหัสพนักงานอยู่ในหัวเพจเฉพาะแท็บรายคน (ภาพรวม/นำเข้า เลือกคนจากรายชื่อแทน) */}
        <header
          className={`mb-6 flex-col gap-4 print:hidden xl:flex-row xl:justify-between ${PER_EMPLOYEE.includes(tab) ? 'xl:items-start' : 'xl:items-end'} ${
            tab === 'overview' ? 'hidden' : 'flex'
          }`}
        >
          {PER_EMPLOYEE.includes(tab) ? (
            // หน้ารายคน: หัวเตี้ย หัวข้อ + คำพูดสั้นของผู้ช่วยในบรรทัดเดียว
            <SpeakingMascot who={who} mood={line.mood} size="plain">
              <h1 className="text-balance text-2xl font-semibold leading-snug tracking-tight text-fg sm:text-[2rem]">{current.hint}</h1>
              <p className="mt-1 text-sm text-muted-fg" aria-live="polite">
                <span className="font-medium">{line.text}</span>
                <span className="hidden sm:inline"> {line.sub}</span>
                {risk[tab]?.band && (
                  <span className="tabular-nums text-muted-fg"> (#{risk[tab].id} {risk[tab].label} {Math.round(risk[tab].score * 100)})</span>
                )}
              </p>
            </SpeakingMascot>
          ) : (
            <SpeakingMascot who={who} mood={line.mood} size="plain">
              <h1 className="text-balance text-[1.75rem] font-semibold leading-[1.3] tracking-tight text-fg sm:text-[2.5rem]">{current.label}</h1>
              <p className="mt-1.5 text-sm text-muted-fg" aria-live="polite">
                {/* คำอธิบายหน้า + คำแนะนำของผู้ช่วย (ไม่พูดเรื่องเดียวกันซ้ำ) */}
                {current.hint} {line.sub}
              </p>
            </SpeakingMascot>
          )}
          {PER_EMPLOYEE.includes(tab) && (
            <form
              ref={headerForm}
              onSubmit={submit}
              className="grid gap-2 sm:max-w-md sm:grid-cols-[1fr_auto] sm:items-end xl:w-[24rem] xl:shrink-0"
            >
              <Field label="รหัสหรือชื่อพนักงาน" icon="user">
                <EmployeeSearch value={findText} onChange={setFindText} onPick={pick} />
              </Field>
              <PrimaryButton loading={!!pending[tab]}>
                โหลด <Icon name="right" className="size-4" />
              </PrimaryButton>
              <StepButtons ids={ranking.ids} current={query?.id} onPick={pick} />
              {recent.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs sm:col-span-2">
                  <span className="mr-0.5 flex items-center gap-1 text-muted-fg">
                    <Icon name="clock" className="size-3.5" />
                    ดูล่าสุด
                  </span>
                  {recent.map((r) => {
                    const current = query?.id === Number(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pick(r.id)}
                        disabled={current}
                        aria-current={current ? 'true' : undefined}
                        title={employeeLabel(r.id, r.name)}
                        className={`h-11 rounded-full border px-3 font-medium sm:h-10 tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          current
                            ? 'cursor-default border-transparent bg-primary-soft text-on-primary dark:text-fg'
                            : 'cursor-pointer border-line bg-card text-fg hover:border-accent/40 hover:text-accent'
                        }`}
                      >
                        {r.name ? `${r.name.split(' ')[0]} · #${r.id}` : `#${r.id}`}
                      </button>
                    )
                  })}
                </div>
              )}
            </form>
          )}
        </header>

        {PER_EMPLOYEE.includes(tab) && formOut && (
          <div className="sticky top-0 z-20 hidden h-0 lg:block print:hidden">
            <form
              onSubmit={submit}
              className="fade-up absolute right-0 top-4 flex w-[22rem] items-center gap-2 rounded-2xl border border-line bg-card p-2 shadow-md"
            >
              <label className="flex min-w-0 flex-1 items-center gap-2 pl-1.5 text-muted-fg">
                <Icon name="user" className="size-4 shrink-0" />
                <span className="sr-only">รหัสพนักงาน</span>
                <input
                  className={inputClass.replace('h-11', 'h-9')}
                  type="number"
                  inputMode="numeric"
                  autoComplete="off"
                  min="1"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </label>
              <button
                disabled={!!pending[tab]}
                className="inline-flex h-11 sm:h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-action px-4 text-sm font-medium text-on-action transition-colors duration-200 hover:bg-action-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
              >
                {pending[tab] ? <MascotLoader /> : 'โหลด'}
              </button>
            </form>
          </div>
        )}

        <div hidden={tab !== 'overview'} key={`overview-${dataVersion}`} className="fade-up">
          <Overview
            who={who}
            onPick={pick}
            onImport={() => setTab('import')}
            onCsv={() => speak('ดาวน์โหลดรายชื่อให้แล้ว', 'เปิดใน Excel ได้เลย')}
          />
        </div>
        <Suspense fallback={['import', 'calibrate', 'users'].includes(tab) ? <Skeleton className="h-96" /> : null}>
          <div hidden={tab !== 'import'} className="fade-up">
            <Upload
              who={who}
              onSay={speak}
              ibmDemo={tenant === 'ibm_demo'}
              canSave={user.role === 'admin'}
              onSaved={() => (refreshData(), speak('บันทึกพนักงานเรียบร้อย!', 'กดชื่อด้านล่างเพื่อดูความเสี่ยงได้เลย'))}
              onPick={pick}
            />
          </div>
          {user.role === 'admin' && (
            <div hidden={tab !== 'calibrate'} className="fade-up">
              <Calibrate
                who={who}
                onSay={speak}
                onChanged={(reset) => (
                  refreshData(),
                  reset
                    ? speak('ยกเลิกการปรับเทียบแล้ว', 'กลับไปใช้คะแนนตั้งต้นของระบบ')
                    : speak('ปรับเทียบเสร็จแล้ว!', 'ทุกหน้าใช้คะแนนที่ตรงกับบริษัทแล้วนะ')
                )}
              />
            </div>
          )}
          {user.role === 'admin' && tab === 'users' && (
            <div className="fade-up">
              <Users />
            </div>
          )}
        </Suspense>
        {/* เก็บทุกแท็บไว้ (ซ่อนด้วย hidden) สลับแท็บแล้วข้อมูลที่โหลดไว้ไม่หาย */}
        <Suspense fallback={<Skeleton className="h-96" />}>
          {TABS.filter((t) => t.Component).map(({ id, Component }) => (
            <div key={`${id}-${dataVersion}`} hidden={tab !== id} className="fade-up">
              <Component query={query} dark={dark} who={who} tenant={tenant} onRisk={onRisk[id]} onDone={onDone[id]} onPick={pick} onTab={setTab} />
            </div>
          ))}
        </Suspense>
      </main>

      {farDown && (
        <button
          type="button"
          onClick={() => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
          aria-label="กลับขึ้นด้านบน"
          title="กลับขึ้นด้านบน"
          // What-if มีแถบคะแนนติดขอบล่างบนมือถือ ยกปุ่มขึ้นไปเหนือแถบ
          className={`fade-up fixed right-4 z-20 grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-card text-fg shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden print:hidden ${
            tab === 'whatif' ? 'bottom-24' : 'bottom-5'
          }`}
        >
          <Icon name="up" className="size-5" />
        </button>
      )}
    </div>
  )
}

// ปุ่มเมนูในแท่ง: วงกลมไอคอน ตัวที่เลือก = ฟ้าอ่อน + ขีดฟ้าชิดขอบแท่ง ชื่อเมนูเป็นป้ายดำโผล่ขวาตอนชี้/โฟกัส (ตาม frontend/ref)
function RailItem({ label, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className={`lift group relative grid size-12 cursor-pointer place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active ? 'bg-primary-soft text-fg' : 'text-muted-fg hover:bg-muted hover:text-fg'
      }`}
    >
      {children}
      {active && <span className="absolute -left-2 h-5 w-1 rounded-r-full bg-accent lg:-left-4" aria-hidden="true" />}
      <span
        className="pointer-events-none absolute left-full ml-5 hidden -translate-x-1 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 lg:block"
        aria-hidden="true"
      >
        {label}
      </span>
    </button>
  )
}

// ข้อความของผู้ช่วย: tail = มีกล่องคำพูดหางชี้ไปหาผู้ช่วย (จอใหญ่ ข้างแท่งเมนู) ไม่มี = ข้อความเปล่าในกล่องลอย (มือถือ)
// sticky = ค้างไว้ มีปุ่มปิด
function SayText({ say, onClose, tail }) {
  const body = (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1" role="status">
        <div className="text-sm font-semibold text-fg">{say.text}</div>
        <div className="text-xs text-muted-fg">{say.sub}</div>
      </div>
      {say.sticky && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดข้อความของผู้ช่วย"
          className="-my-1 -mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted-fg hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="error" className="size-4" />
        </button>
      )}
    </div>
  )
  return tail ? (
    <Bubble tail={tail} className="px-4 py-3 shadow-lg">
      {body}
    </Bubble>
  ) : (
    body
  )
}

// คนก่อนหน้า/ถัดไปตามลำดับความเสี่ยง (ไล่คุยทีละคนจากรายชื่อหน้าแรก ไม่ต้องกลับไปหน้าภาพรวม)
// คีย์ลัด [ และ ] (ดูตำแหน่งปุ่ม e.code ใช้ได้ทั้งแป้นไทย/อังกฤษ) ไม่ทำงานตอนพิมพ์ในช่องกรอก
function StepButtons({ ids, current, onPick }) {
  const i = ids.indexOf(current)
  const step = (d) => i >= 0 && ids[i + d] !== undefined && onPick(ids[i + d])
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (e.code === 'BracketLeft' && i > 0) onPick(ids[i - 1])
      if (e.code === 'BracketRight' && i >= 0 && i < ids.length - 1) onPick(ids[i + 1])
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [ids, i, onPick])
  if (i < 0) return null
  const cls =
    'inline-flex h-11 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border sm:h-10 border-line bg-card px-3 text-xs font-medium text-fg transition-colors duration-150 hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-50 disabled:hover:border-line disabled:hover:text-fg'
  return (
    <div className="flex items-center gap-2 sm:col-span-2">
      <button type="button" className={cls} onClick={() => step(-1)} disabled={i === 0} aria-label="คนก่อนหน้า (เสี่ยงมากกว่า)" aria-keyshortcuts="[" title="คีย์ลัด [">
        <Icon name="left" className="size-3.5" /> คนก่อนหน้า
      </button>
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-fg" title="อันดับตามความเสี่ยง จากมากไปน้อย">
        อันดับ {(i + 1).toLocaleString()} จาก {ids.length.toLocaleString()}
        <span className="sr-only"> ตามความเสี่ยง</span>
      </span>
      <button type="button" className={cls} onClick={() => step(1)} disabled={i === ids.length - 1} aria-label="คนถัดไป (เสี่ยงน้อยกว่า)" aria-keyshortcuts="]" title="คีย์ลัด ]">
        คนถัดไป <Icon name="right" className="size-3.5" />
      </button>
    </div>
  )
}

// ชื่อผู้ใช้/บริษัทอยู่ใน title (มือถือไม่มีแถวผู้ใช้ กดค้างหรือชี้แล้วเห็นว่าเป็นใคร)
function LogoutButton({ user, onLogout, className = '' }) {
  const label = `ออกจากระบบ (${user.name} · ${user.tenant_name ?? user.tenant_id})`
  return (
    <button
      type="button"
      onClick={onLogout}
      aria-label={label}
      title={label}
      className={`grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border sm:size-9 border-line text-muted-fg transition-colors duration-200 hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      <Icon name="logout" className="size-5" />
    </button>
  )
}

// ช่องหาพนักงาน (combobox): พิมพ์รหัสแล้วกดโหลด หรือพิมพ์ชื่อ แผนก ตำแหน่ง แล้วเลือกจากรายการ (เรียงตามความเสี่ยง)
// HR นึกถึงคนจากชื่อ ไม่ใช่รหัส (critique 2026-10-16) ค้นหาด้วย /company-summary/top-employees?q=
function EmployeeSearch({ value, onChange, onPick }) {
  const [open, setOpen] = useState(false) // เปิดรายการหลังพิมพ์เท่านั้น (ค่าเริ่มต้น "1" ไม่ต้องค้น)
  const [found, setFound] = useState({ text: '', hits: [] }) // ผลของคำค้นไหน (ยังไม่ตรงกับที่พิมพ์ = กำลังค้น)
  const [active, setActive] = useState(0)
  const text = value.trim()
  useEffect(() => {
    if (!open || !text) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      api(`/company-summary/top-employees?${new URLSearchParams({ q: text, n: 8 })}`, { signal: ctrl.signal }).then(
        (d) => (setFound({ text, hits: d.employees }), setActive(0)),
        () => {},
      )
    }, 200)
    return () => (clearTimeout(timer), ctrl.abort())
  }, [open, text])
  const hits = open && found.text === text ? found.hits : []
  const choose = (e) => (setOpen(false), onPick(e.employee_id))
  function onKeyDown(e) {
    if (e.key === 'Escape' || (e.key === 'Enter' && /^\d+$/.test(text))) return setOpen(false) // รหัสล้วน Enter = โหลด ปิดรายการ (ช่องค้างรหัสไว้)
    if (!hits.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length)
    } else if (e.key === 'Enter' && !/^\d+$/.test(text)) {
      e.preventDefault() // พิมพ์รหัสล้วน Enter = โหลดรหัสนั้น (submit ของฟอร์ม) พิมพ์คำ = เลือกคนที่ไฮไลต์
      choose(hits[active])
    }
  }
  return (
    <div className="relative">
      <input
        className={inputClass}
        name="employee_id"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls="employee-hits"
        aria-activedescendant={hits.length ? `employee-hit-${hits[active].employee_id}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        required
        placeholder="เช่น 622 หรือ สมชาย"
        value={value}
        onChange={(e) => (onChange(e.target.value), setOpen(true))}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
        onBlur={() => setOpen(false)}
      />
      {hits.length > 0 && (
        <ul id="employee-hits" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-card p-1 shadow-lg">
          {hits.map((e, i) => (
            <li
              key={e.employee_id}
              id={`employee-hit-${e.employee_id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => (ev.preventDefault(), choose(e))} // mousedown: ก่อนช่องเสียโฟกัสแล้วรายการปิด
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${i === active ? 'bg-muted' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{employeeLabel(e.employee_id, e.name)}</span>
                <span className="block truncate text-xs text-muted-fg">
                  {e.job_role}, {e.department}
                </span>
              </span>
              <span className={`text-sm font-semibold tabular-nums ${BAND[e.risk_band].text}`}>
                {Math.round((e.calibrated_risk_score ?? e.risk_score) * 100)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && text && !/^\d+$/.test(text) && found.text === text && !found.hits.length && (
        <p role="status" className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-muted-fg shadow-lg">
          ไม่พบพนักงานที่ตรงกับ “{text}”
        </p>
      )}
    </div>
  )
}
