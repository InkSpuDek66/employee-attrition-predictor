// ภาพรวมบริษัท (README 6.6) + รายชื่อพนักงานเสี่ยงสูงสุดให้กดเลือก ไม่ต้องรู้รหัสก่อน
// ใช้ /company-summary, /company-summary/departments, /company-summary/top-employees
// ทุกส่วนใช้คะแนนชุดเดียวกัน: ปรับเทียบแล้วถ้าบริษัทของผู้ใช้ปรับเทียบ (DE-11) ยังไม่ปรับ = backend ส่ง warning มา
import { useEffect, useState } from 'react'
import { featureLabel, featurePhrase, featureValue, JOB_LEVELS } from './featureLabels'
import { AssistantHint, SorryState, SpeakingMascot } from './mascot/Mascot'
import { api, baht, BAND, bahtShort, csvCell, employeeLabel, friendly, inputClass, UNCALIBRATED, useApi } from './theme'
import { Alert, Card, CountUp, Icon, Segmented, Skeleton } from './ui'

const shownScore = (e) => e.calibrated_risk_score ?? e.risk_score
// บริษัทมาจากผู้ใช้ที่ login (backend อ่านจาก token) บริษัทที่ปรับเทียบแล้วได้คะแนนปรับเทียบอัตโนมัติ
// วงกลมหน้าแถวพนักงาน: ตัวย่อชื่อคน (John Smith = JS, ภาษาไทยใช้พยัญชนะตัวแรก) ไม่มีชื่อ = ไอคอนคน
// (เดิมใช้ตัวย่อตำแหน่ง แต่ตำแหน่งภาษาไทยขึ้นต้นตัวเดียวกันเยอะ เช่น พนักงาน/ผู้จัดการ ดูไม่ออกว่าต่างกัน)
const initials = (name) => {
  const words = name.match(/[A-Za-z]+/g)
  return words ? words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') : name.replace(/^[เแโใไ]/, '').charAt(0)
}
const topQuery = (n, department, q, reasons) =>
  new URLSearchParams({ n, ...(department && { department }), ...(q && { q }), ...(reasons && { reasons: true }) })

// เหตุผลหลักหนึ่งบรรทัด ("ทำ OT และบ้านห่าง 13 กม. · ทำงานล่วงเวลา (OT)") ใช้ทั้งรายชื่อและไฟล์ CSV
const reasonText = (e) =>
  (e.reasons ?? [])
    .map((r) => featurePhrase(r.feature, r.value, r.feature === 'MonthlyIncome' ? baht(r.value) : featureValue(r.feature, r.value)))
    .join(' · ')

// ดาวน์โหลดรายชื่อเสี่ยงสูงเป็น CSV (เปิดใน Excel ภาษาไทยได้ เพราะใส่ BOM) ไว้ใช้ในประชุม/ส่งหัวหน้าแผนก
async function downloadCsv(department) {
  const { employees } = await api(`/company-summary/top-employees?${topQuery(100, department, '', true)}`)
  const header = ['อันดับ', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'คะแนนความเสี่ยง', 'ระดับ', 'แผนก', 'ตำแหน่ง', 'ระดับตำแหน่ง', 'เหตุผลหลัก']
  const rows = employees.map((e, i) => [i + 1, e.employee_id, e.name ?? '', Math.round(shownScore(e) * 100), e.risk_band_th, e.department, e.job_role, JOB_LEVELS[e.job_level] ?? e.job_level, reasonText(e)])
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `top-risk-${department || 'all'}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

export function CsvButton({ department, onDone = () => {} }) {
  const [state, setState] = useState('') // '' | 'busy' | ข้อความ error
  async function go() {
    setState('busy')
    try {
      await downloadCsv(department)
      onDone()
      setState('')
    } catch (err) {
      setState(friendly(err))
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={state === 'busy'}
      title={state && state !== 'busy' ? state : 'พนักงานเสี่ยงสูงสุด 100 คน'}
      className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
    >
      <Icon name="download" className="size-4" />
      {state === 'busy' ? 'กำลังเตรียม…' : state ? 'ลองใหม่' : 'CSV'}
    </button>
  )
}

// รายชื่อพนักงานเสี่ยงสูงสุด กดแถวแล้วไปดูรายละเอียดคนนั้น (คะแนนปรับเทียบถ้ามี ตรงกับหน้า SHAP/What-if)
// q = คำค้น (ชื่อ รหัส แผนก ตำแหน่ง) onMore = ปุ่มแสดงเพิ่ม (ดูได้ทุกคน ไม่ใช่แค่ 10 อันดับแรก)
// reasons = โชว์เหตุผลหลักหนึ่งบรรทัดต่อคน ("เคยทำงานมาแล้ว 8 บริษัท · ทำงานล่วงเวลา (OT)")
export function TopRiskList({ n = 10, department = '', q = '', reasons = false, onPick, onMore, onLess, compact = false }) {
  const { loading, data, error } = useApi([`/company-summary/top-employees?${topQuery(n, department, q, reasons)}`])
  const why = reasonText
  if (error) return <p className="text-sm text-risk-high">{error}</p>
  if (!data) return <Skeleton className={compact ? 'h-40' : 'h-80'} />
  const { employees, total } = data[0]
  if (employees.length === 0)
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-fg">{q ? `ไม่พบพนักงานที่ตรงกับ “${q}”` : 'ยังไม่มีพนักงาน นำเข้าข้อมูลก่อน'}</p>
    )
  return (
    <>
    <ul className={`divide-y divide-line transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      {data[0].employees.map((e, i) => {
        const b = BAND[e.risk_band]
        return (
          <li key={e.employee_id}>
            <button
              type="button"
              onClick={() => onPick(e.employee_id)}
              className={`lift flex w-full cursor-pointer gap-3 rounded-lg px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                reasons ? 'items-start py-3' : 'items-center py-2.5'
              }`}
            >
              <span className={`w-5 text-right text-xs tabular-nums text-muted-fg ${reasons ? 'pt-2' : ''}`}>{i + 1}</span>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 ${b.pill}`} title={e.job_role} aria-hidden="true">
                {e.name ? initials(e.name) : <Icon name="user" className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{employeeLabel(e.employee_id, e.name)}</span>
                {!compact && (
                  <span className="line-clamp-2 block text-xs text-muted-fg">
                    {e.job_role} · {e.department} · {JOB_LEVELS[e.job_level] ?? `ระดับ ${e.job_level}`}
                  </span>
                )}
                {reasons && e.reasons?.length > 0 && (
                  <span className="mt-1.5 flex items-start gap-1.5 text-sm text-fg">
                    <Icon name="up" className="mt-0.5 size-3.5 shrink-0 text-risk-high" />
                    <span>{why(e)}</span>
                  </span>
                )}
              </span>
              <span className={`text-lg font-semibold tabular-nums ${b.text}`}>{Math.round(shownScore(e) * 100)}</span>
              <span className={`hidden rounded-md px-2 py-0.5 text-xs font-medium ring-1 sm:inline ${b.pill}`}>{e.risk_band_th}</span>
              <Icon name="right" className="size-4 text-muted-fg" />
            </button>
          </li>
        )
      })}
    </ul>
    {(onMore || onLess) && (total > employees.length || n > 10) && (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <span className="text-muted-fg tabular-nums">
          แสดง {employees.length.toLocaleString()} จาก {total.toLocaleString()} คน
        </span>
        <span className="flex gap-2">
          {n > 10 && (
            <button type="button" onClick={onLess} className="h-10 cursor-pointer rounded-lg border border-line px-3 font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              ย่อเหลือ 10 คน
            </button>
          )}
          {total > employees.length && (
            <button type="button" onClick={onMore} disabled={loading} className="h-10 cursor-pointer rounded-lg border border-line px-3 font-medium text-accent transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait">
              แสดงเพิ่มอีก {Math.min(LIST_STEP, total - employees.length).toLocaleString()} คน
            </button>
          )}
        </span>
      </div>
    )}
    </>
  )
}

const LIST_STEP = 20

// OT กับ "ทำ OT ร่วมกับบ้านไกล" รวมเป็นรายการเดียวแบบหน้า SHAP / What-if (critique รอบ 14)
function mergeOT(factors) {
  const ix = factors.find((f) => f.feature === 'OverTimeXDistance')
  const ot = factors.find((f) => f.feature === 'OverTime')
  if (!ix || !ot) return factors
  return factors
    .filter((f) => f !== ix)
    .map((f) => (f === ot ? { ...f, share: f.share + ix.share } : f))
    .sort((a, b) => b.share - a.share)
}

// หน้าว่าง: ผู้ช่วยบอกวิธีใช้ + รายชื่อเสี่ยงสูงสุดให้กดเลือกได้เลย ไม่ต้องรู้รหัส
// คำแนะนำอยู่ในหัวการ์ดรายชื่อเลย (เดิมเป็นกล่องแยกด้านบน กินที่ครึ่งจอแต่มีแค่สองบรรทัด)
export function EmptyPicker({ title, children, onPick }) {
  return (
    <Card title={title} subtitle={<>{children} หรือเลือกจากรายชื่อพนักงานที่เสี่ยงสูงสุดด้านล่าง</>}>
      <TopRiskList n={5} onPick={onPick} />
    </Card>
  )
}

// ข้อมูลพนักงานเก่าแค่ไหน: ระบบไม่เพิ่มอายุ/อายุงานให้เอง (คนที่ได้เลื่อนตำแหน่ง/เปลี่ยนเงินเดือนระบบไม่รู้)
// จึงบอกวันที่ของข้อมูล และเตือนให้นำเข้าไฟล์ใหม่จากระบบ HR เมื่อเก่าเกิน STALE_DAYS วัน
const STALE_DAYS = 90
function ageText(days) {
  if (days < 1) return 'วันนี้'
  if (days < 31) return `ผ่านมา ${days} วัน`
  return `ผ่านมาประมาณ ${Math.round(days / 30)} เดือน`
}

function DataAsOf({ asOf, days }) {
  if (!asOf) return null
  const when = new Date(asOf).toLocaleDateString('th-TH', { dateStyle: 'long' })
  if (days > STALE_DAYS) {
    return (
      <Alert tone="warning">
        ข้อมูลพนักงานบันทึกล่าสุดเมื่อ {when} ({ageText(days)}) อายุงาน เงินเดือน และตำแหน่งอาจไม่ตรงกับปัจจุบันแล้ว
        นำเข้าไฟล์ล่าสุดจากระบบ HR ในแท็บ “นำเข้าข้อมูล” เพื่อให้คะแนนตรงขึ้น
      </Alert>
    )
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-fg">
      <Icon name="clock" className="size-3.5" />
      ข้อมูลพนักงาน ณ {when} ({ageText(days)})
    </p>
  )
}

// สัดส่วนต่ำ/กลาง/สูง เป็นแถบเดียว + ตัวเลขทุกช่วง (ไม่ใช้สีอย่างเดียว) ชี้ที่ช่วงเพื่อดูจำนวน
const BANDS = [
  ['Low', 'bg-band-low'],
  ['Medium', 'bg-band-mid'],
  ['High', 'bg-band-high'],
]

// ปัดแบบเศษเหลือมากสุดได้ก่อน ให้สามช่องรวมกันได้ 100% พอดี (เดิม 63+26+12 = 101)
function wholePercents(counts, total) {
  const exact = counts.map((c) => (c / total) * 100)
  const out = exact.map(Math.floor)
  const order = exact.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0])
  for (let i = 0; i < 100 - out.reduce((a, b) => a + b, 0); i++) out[order[i][1]]++
  return out
}

function BandBar({ bands, total }) {
  const pct = (k) => (bands[k] / total) * 100
  const shown = Object.fromEntries(BANDS.map(([k], i) => [k, wholePercents(BANDS.map(([b]) => bands[b]), total)[i]]))
  return (
    <div>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`พนักงาน ${total.toLocaleString()} คน: ${BANDS.map(([k]) => `เสี่ยง${BAND[k].th} ${bands[k]} คน`).join(', ')}`}
      >
        {BANDS.map(([k, fill]) => bands[k] > 0 && <div key={k} className={`bar-grow ${fill}`} style={{ width: `${pct(k)}%` }} title={`เสี่ยง${BAND[k].th} ${bands[k].toLocaleString()} คน`} />)}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {BANDS.map(([k, fill]) => (
          <div key={k}>
            <dt className="flex items-center gap-1.5 text-xs text-muted-fg">
              <span className={`size-2 shrink-0 rounded-sm ${fill}`} />
              เสี่ยง{BAND[k].th}
            </dt>
            <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${BAND[k].text}`}>
              <CountUp value={bands[k]} format={(v) => Math.round(v).toLocaleString()} />
            </dd>
            <dd className="text-xs tabular-nums text-muted-fg">{total ? shown[k] : 0}%</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// บริษัทที่ยังไม่มีพนักงาน (บริษัทใหม่ก่อนนำเข้า): ผู้ช่วยบอกให้ไปนำเข้าข้อมูล
function NoEmployees({ who, onImport }) {
  return (
    <div className="space-y-3">
      <AssistantHint who={who} title="ยังไม่มีพนักงานของบริษัทนี้">
        ไปที่แท็บ “นำเข้าข้อมูล” ดาวน์โหลดไฟล์ตัวอย่าง กรอกพนักงาน (ใช้ชื่อแผนก/ตำแหน่งจริงของบริษัทได้) แล้วอัปโหลด
        จากนั้นภาพรวมจะแสดงที่นี่
      </AssistantHint>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onImport}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-action px-4 text-sm font-medium text-on-action transition-colors duration-200 hover:bg-action-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent"
        >
          <Icon name="upload" className="size-4" />
          ไปนำเข้าข้อมูล
        </button>
      </div>
    </div>
  )
}

export default function Overview({ greeting, who, onPick, onImport, onCsv }) {
  const [department, setDepartment] = useState('')
  // ค้นหา/ดูทั้งหมดในการ์ดรายชื่อ (หน่วง 250ms ระหว่างพิมพ์ ไม่ยิง API ทุกตัวอักษร)
  const [find, setFind] = useState('')
  const [query, setQuery] = useState('')
  const [listN, setListN] = useState(10)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(find.trim()), 250)
    return () => clearTimeout(timer)
  }, [find])
  const [fullBaht, setFullBaht] = useState(false) // false = ย่อเป็นล้านบาท, true = จำนวนเต็มทุกหลัก
  const money = fullBaht ? baht : bahtShort
  const q = new URLSearchParams({ top_n: 5, ...(department && { department }) })
  const { loading, data, error } = useApi([`/company-summary?${q}`, '/company-summary/departments'])

  if (error) return <SorryState message={error} />
  if (!data) {
    return (
      <div className="space-y-3">
        {/* โหลดครั้งแรกอาจนานหลายวินาที บอกว่ากำลังทำอะไร ไม่ใช่กล่องว่างเงียบๆ (critique รอบ 14) */}
        <p className="text-sm text-muted-fg" role="status" aria-live="polite">กำลังโหลดข้อมูลพนักงาน…</p>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-[36rem]" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  const [s, { departments }] = data
  if (s.n_employees === 0 && !department) return <NoEmployees who={who} onImport={onImport} />
  const deptOptions = [['', 'ทั้งบริษัท'], ...departments.map((d) => [d.department, d.department])]
  // แผนกที่ควรดูก่อน = คนเสี่ยงสูงมากสุด (เดิมเรียงตามมูลค่าความเสี่ยงรวม แผนกที่ไม่มีคนเสี่ยงสูงแต่เงินเดือนสูงขึ้นมาก่อน)
  const byHighRisk = [...departments].sort((a, b) => b.risk_bands.High - a.risk_bands.High || b.mean_risk_score - a.mean_risk_score)
  const manyDepartments = departments.length > 4 // เกิน 4 ตัวเลือกเรียงปุ่มแล้วเลือกยาก (critique รอบ 6) ใช้ช่องเลือก
  const maxShare = Math.max(...mergeOT(s.top_factors).map((f) => f.share), 1e-9)
  const high = s.risk_bands.High
  const where = department || 'ตอนนี้'
  const headline = high > 0 ? `${where}มี ${high.toLocaleString()} คนที่ควรคุยด้วยเร็วๆ นี้` : `${where}ยังไม่มีใครเสี่ยงสูง`
  const fix = s.top_factors.find((f) => f.actionable)
  const lead = `จากพนักงาน ${s.n_employees.toLocaleString()} คน คะแนนเฉลี่ย ${Math.round(s.mean_risk_score * 100)} จาก 100${
    fix ? ` เรื่องที่บริษัทปรับได้และส่งผลมากที่สุดคือ${featureLabel(fix.feature)}` : ''
  }`

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      {/* หัวหน้า: ผู้ช่วยพูดหัวข้อเอง ประโยคมาจากข้อมูลจริง (กี่คนควรคุย + ปัจจัยที่เจอบ่อยสุด) ตัวเลขรวมอยู่แถวล่างของกล่อง */}
      <section className="hero-sky -mx-4 px-4 pb-6 pt-6 sm:mx-0 sm:rounded-3xl sm:border sm:border-line sm:px-8 sm:pt-8">
        <SpeakingMascot who={who}>
          <p className="text-sm text-muted-fg">{greeting}</p>
          <h1 className="mt-2 text-balance text-[1.75rem] font-semibold leading-[1.35] tracking-tight text-fg sm:text-[2.5rem]">
            {headline}
          </h1>
          {lead && <p className="mt-3 max-w-[60ch] text-base text-fg/80">{lead}</p>}
        </SpeakingMascot>
        <div className="mt-6 grid gap-6 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-16">
          <BandBar bands={s.risk_bands} total={s.n_employees} />
          <div className="sm:text-right">
            <div className="flex items-center gap-2 text-sm text-muted-fg sm:justify-end">
              {s.risk_bands.High > 0 ? `ถ้า ${s.risk_bands.High.toLocaleString()} คนที่เสี่ยงสูงลาออก` : 'ต้นทุนหาคนแทนคนเสี่ยงสูง'}
              <button
                type="button"
                onClick={() => setFullBaht((v) => !v)}
                aria-pressed={fullBaht}
                className="-my-2 min-h-10 cursor-pointer rounded-md px-1.5 py-2.5 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {fullBaht ? 'ย่อ' : 'ดูจำนวนเต็ม'}
              </button>
            </div>
            {/* เดิมโชว์มูลค่าความเสี่ยงรวมทั้งบริษัท แต่ครึ่งหนึ่งมาจากคนเสี่ยงต่ำที่เงินเดือนสูง (critique รอบ 5) ไม่ตรงกับหัวข้อ "ควรคุยกับใคร" */}
            <div className="mt-0.5 text-2xl font-semibold tabular-nums text-fg" title={fullBaht ? undefined : baht(s.high_risk_replacement_cost)}>
              <CountUp value={s.high_risk_replacement_cost} format={money} />
            </div>
            <p className="mt-1 text-xs text-muted-fg">ต้นทุนหาคนแทนโดยประมาณ ไม่ใช่ยอดจริง</p>
          </div>
        </div>
      </section>

      {/* มือถือ หรือแผนกเยอะ (ปุ่มเรียงหลายแถว) = ช่องเลือกแบบเลื่อนลง */}
      <select aria-label="เลือกแผนก" value={department} onChange={(e) => setDepartment(e.target.value)} className={`${inputClass} sm:max-w-xs ${manyDepartments ? '' : 'sm:hidden'}`}>
        {deptOptions.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      {!manyDepartments && (
        <div className="hidden sm:block">
          <Segmented label="เลือกแผนก" options={deptOptions} value={department} onChange={setDepartment} />
        </div>
      )}
      <DataAsOf asOf={s.data_as_of} days={s.data_age_days} />

      {/* UX-17: หน้าแรกที่มีตัวเลขเยอะสุดต้องบอกข้อจำกัดเหมือนหน้า SHAP / What-if */}
      {(s.warning || s.data_note) && (
        <Alert tone="warning">
          {[s.warning && `${UNCALIBRATED} (ผู้ดูแลระบบปรับเทียบได้ที่แท็บ “ปรับเทียบโมเดล”)`, s.data_note].filter(Boolean).join(' · ')}
        </Alert>
      )}

      {/* หน้าแรก = คนที่ควรคุยก่อนพร้อมเหตุผล (PRODUCT.md: รู้ในไม่กี่วินาทีว่าควรคุยกับใคร) ตัวเลขรวมอยู่แถบข้าง
          UX-14: grid item มี min-width: auto เนื้อหาข้างในเคยดันการ์ดกว้างเกินจอมือถือ จึงใส่ min-w-0 */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card
          className="min-w-0"
          title={find.trim() ? 'ผลการค้นหา' : 'ควรคุยกับใครก่อน'}
          subtitle="เรียงตามความเสี่ยง พร้อมเหตุผลหลักของแต่ละคน กดที่ชื่อเพื่อดูรายละเอียด"
          action={<CsvButton department={department} onDone={onCsv} />}
        >
          <label className="relative mb-2 block">
            <span className="sr-only">ค้นหาพนักงาน</span>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-fg" />
            <input
              type="search"
              className={`${inputClass} pl-9`}
              placeholder="ค้นหาชื่อ รหัส แผนก หรือตำแหน่ง"
              value={find}
              onChange={(e) => (setFind(e.target.value), setListN(10))}
            />
          </label>
          <TopRiskList
            department={department}
            q={query}
            n={listN}
            reasons
            onPick={onPick}
            onMore={() => setListN((v) => v + LIST_STEP)}
            onLess={() => setListN(10)}
          />
        </Card>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-4">
          <Card title="ปัจจัยเด่นของทั้งกลุ่ม" subtitle="ผลกระทบเฉลี่ยของแต่ละปัจจัยต่อคะแนนความเสี่ยง">
            <ul className="space-y-4">
              {mergeOT(s.top_factors).map((f) => (
                <li key={f.feature}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-fg">{featureLabel(f.feature)}</span>
                    <span className="tabular-nums text-muted-fg">{Math.round(f.share * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div className="bar-grow h-full rounded-full bg-accent" style={{ width: `${(f.share / maxShare) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-fg">
                    <span className={f.actionable ? 'font-medium text-accent' : ''}>{f.actionable ? 'บริษัทปรับได้' : 'ปรับไม่ได้'}</span>
                    {f.recommendation && ` · ${f.recommendation}`}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card icon="money" title="แยกตามแผนก" subtitle="เรียงตามจำนวนคนเสี่ยงสูง กดที่แผนกเพื่อกรอง">
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
                <th className="px-5 py-2 sm:px-6">แผนก</th>
                <th className="px-2 py-2 text-right">พนักงาน</th>
                <th className="px-2 py-2 text-right">เสี่ยงสูง</th>
                <th className="hidden px-2 py-2 text-right sm:table-cell">คะแนนเฉลี่ย</th>
                <th className="px-5 py-2 text-right sm:px-6">หาคนแทนคนเสี่ยงสูง (ล้านบาท)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byHighRisk.map((d) => (
                <tr
                  key={d.department}
                  onClick={() => setDepartment(d.department)}
                  className={`cursor-pointer transition-colors duration-150 hover:bg-canvas ${d.department === department ? 'bg-accent-soft/50' : ''}`}
                >
                  <td className="px-5 py-2.5 font-medium text-fg sm:px-6">
                    <button
                      type="button"
                      onClick={(e) => (e.stopPropagation(), setDepartment(d.department))}
                      aria-pressed={d.department === department}
                      className="-my-2.5 cursor-pointer rounded py-2.5 text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {d.department}
                    </button>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{d.n_employees.toLocaleString()}</td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${d.risk_bands.High ? 'font-semibold text-risk-high' : 'text-muted-fg'}`}>{d.risk_bands.High}</td>
                  <td className="hidden px-2 py-2.5 text-right tabular-nums sm:table-cell">{Math.round(d.mean_risk_score * 100)}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums sm:px-6" title={baht(d.high_risk_replacement_cost)}>
                    {d.risk_bands.High
                      ? (d.high_risk_replacement_cost / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-fg">{s.note}</p>
      </Card>
    </div>
  )
}
