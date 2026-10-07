import { useEffect, useState } from 'react'
import { featureLabel } from './featureLabels'
import { api, baht, BAND, friendly, INCOME_MIN_BAHT, INCOME_RANGE_USD, inputClass } from './theme'
import { Alert, Card, EmptyState, Field, Icon, RiskGauge, Segmented, Skeleton } from './ui'

// ฟีเจอร์ที่ HR ปรับได้จริงผ่านมาตรการ (ไม่ใส่ข้อมูลส่วนตัว เช่น อายุ เพศ สถานภาพ)
const SAT = [[1, 'ต่ำ'], [2, 'กลาง'], [3, 'สูง'], [4, 'สูงมาก']]
const GROUPS = [
  {
    title: 'ค่าตอบแทน',
    icon: 'money',
    controls: [
      { field: 'MonthlyIncome', type: 'money' },
      { field: 'PercentSalaryHike', type: 'range', min: 0, max: 30, step: 1 },
      { field: 'StockOptionLevel', type: 'select', options: [[0, 'ไม่มี'], [1, '1'], [2, '2'], [3, '3']] },
    ],
  },
  {
    title: 'ภาระงาน',
    icon: 'clock',
    controls: [
      { field: 'OverTime', type: 'select', options: [['No', 'ไม่ทำ'], ['Yes', 'ทำ']] },
      {
        field: 'BusinessTravel',
        type: 'select',
        options: [['Non-Travel', 'ไม่เดินทาง'], ['Travel_Rarely', 'นานๆ ครั้ง'], ['Travel_Frequently', 'บ่อย']],
      },
      { field: 'DistanceFromHome', type: 'range', min: 1, max: 30, step: 1 },
      { field: 'WorkLifeBalance', type: 'select', options: [[1, 'แย่'], [2, 'พอใช้'], [3, 'ดี'], [4, 'ดีมาก']] },
    ],
  },
  {
    title: 'ความก้าวหน้า',
    icon: 'trend',
    controls: [
      { field: 'JobLevel', type: 'select', options: [1, 2, 3, 4, 5].map((v) => [v, String(v)]) },
      { field: 'YearsSinceLastPromotion', type: 'range', min: 0, max: 15, step: 1 },
      { field: 'TrainingTimesLastYear', type: 'range', min: 0, max: 6, step: 1 },
    ],
  },
  {
    title: 'ความพึงพอใจ',
    icon: 'heart',
    controls: [
      { field: 'JobSatisfaction', type: 'select', options: SAT },
      { field: 'EnvironmentSatisfaction', type: 'select', options: SAT },
      { field: 'RelationshipSatisfaction', type: 'select', options: SAT },
      { field: 'JobInvolvement', type: 'select', options: SAT },
    ],
  },
]
const scoreOf = (s) => s.calibrated_risk_score ?? s.risk_score
const post = (body, signal) =>
  api('/whatif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })

// เงินเดือน: แสดง/รับเป็นบาท (value, base เป็นดอลลาร์ตาม dataset) พิมพ์ตัวเลขแล้วกด Enter หรือคลิกออก หรือลากแถบก็ได้
function MoneyControl({ field, base, value, rate, onChange }) {
  const shown = Math.round(value * rate)
  const changed = shown !== Math.round(base * rate)
  const [lo, hi] = INCOME_RANGE_USD
  const outside = value < lo || value > hi
  const step = 500
  // ช่องพิมพ์ใช้ขอบเขตเดียวกับแถบเลื่อน พิมพ์เกินจะถูกดันกลับมาที่ขอบ
  const min = INCOME_MIN_BAHT
  const max = Math.round((20000 * rate) / step) * step
  const commit = (input) => {
    const n = Number(input.value.replace(/[^\d.]/g, ''))
    const v = Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.round(n))) : shown
    input.value = v.toLocaleString() // ถ้าค่าไม่เปลี่ยน (เช่นพิมพ์ต่ำกว่าขั้นต่ำซ้ำ) ช่องจะไม่ remount ต้องเขียนกลับเอง
    if (v !== shown) onChange(v)
  }
  return (
    <div
      className={`rounded-lg border p-4 transition-colors duration-200 sm:col-span-2 ${
        changed ? 'border-accent bg-accent-soft/50' : 'border-line bg-card hover:border-secondary'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <label htmlFor="income-input" className="text-sm font-medium text-fg">
          {featureLabel(field)} (บาท)
        </label>
        {changed && (
          <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-on-primary">
            เดิม {baht(base * rate)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
        <div className="relative sm:w-64">
          <input
            id="income-input"
            key={shown}
            type="text"
            inputMode="numeric"
            defaultValue={shown.toLocaleString()}
            onBlur={(e) => commit(e.target)}
            onKeyDown={(e) => e.key === 'Enter' && commit(e.target)}
            className={`${inputClass} h-14 pr-14 text-2xl font-semibold tabular-nums`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-fg">บาท</span>
        </div>
        <div className="flex-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={shown}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`${featureLabel(field)} (ลาก)`}
          />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-fg">
            <span>{baht(min)}</span>
            <span>{baht(max)}</span>
          </div>
        </div>
      </div>
      <p className={`mt-2 text-xs ${outside ? 'text-risk-mid' : 'text-muted-fg'}`}>
        {outside
          ? `นอกช่วงที่โมเดลเคยเห็น (${baht(lo * rate)}–${baht(hi * rate)}) ผลอาจไม่สะท้อนความจริง`
          : `≈ ${Math.round(value).toLocaleString()} ดอลลาร์ ที่ ${rate} บาท/ดอลลาร์ (ค่าที่ส่งเข้าโมเดล)`}
      </p>
    </div>
  )
}

function Control({ field, type, options, base, value, onChange, ...range }) {
  const changed = value !== base
  const optionText = (v) => options?.find(([o]) => String(o) === String(v))?.[1] ?? v
  return (
    <div
      className={`rounded-lg border p-4 transition-colors duration-200 ${
        changed ? 'border-accent bg-accent-soft/50' : 'border-line bg-card hover:border-secondary/50'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-fg">{featureLabel(field)}</span>
        {changed && (
          <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-on-primary">
            เดิม {type === 'range' ? base.toLocaleString() : optionText(base)}
          </span>
        )}
      </div>
      {type === 'range' ? (
        <>
          <div className="mb-2 text-xl font-semibold tabular-nums text-fg">{value.toLocaleString()}</div>
          <input type="range" {...range} value={value} onChange={(e) => onChange(e.target.value)} aria-label={featureLabel(field)} />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-fg">
            <span>{range.min.toLocaleString()}</span>
            <span>{range.max.toLocaleString()}</span>
          </div>
        </>
      ) : (
        <Segmented label={featureLabel(field)} options={options} value={value} onChange={onChange} />
      )}
    </div>
  )
}

function Stat({ label, value, tone }) {
  const tones = { red: 'text-risk-high', blue: 'text-accent', green: 'text-risk-low' }
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="text-xs font-medium text-muted-fg">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
    </div>
  )
}

function DeltaBadge({ delta, className = '' }) {
  const style =
    delta < 0
      ? 'bg-risk-low-soft text-risk-low ring-risk-low/15'
      : delta > 0
        ? 'bg-risk-high-soft text-risk-high ring-risk-high/15'
        : 'bg-muted text-muted-fg ring-line'
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ring-1 ${style} ${className}`}>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {delta !== 0 && <Icon name={delta < 0 ? 'down' : 'up'} className="size-4" />}
        {delta < 0 ? 'ความเสี่ยงลดลง' : delta > 0 ? 'ความเสี่ยงเพิ่มขึ้น' : 'ยังไม่เปลี่ยน'}
      </span>
      <span className="text-2xl font-semibold tabular-nums">
        {delta > 0 ? '+' : ''}
        {Math.round(delta * 100)}
      </span>
    </div>
  )
}

export default function WhatIfSimulator({ query, rate }) {
  const money = (usd) => baht(usd * rate)
  const [loaded, setLoaded] = useState(null) // { n, id, tenant, base } หรือ { n, error } ของพนักงานที่โหลดล่าสุด
  const [changes, setChanges] = useState({})
  const [result, setResult] = useState(null)
  const [impact, setImpact] = useState(null)
  const [retention, setRetention] = useState('')
  const [error, setError] = useState('')

  // โหลดพนักงานใหม่เมื่อเลือกจากช่องด้านบน
  useEffect(() => {
    if (!query) return
    const ctrl = new AbortController()
    post({ employee_id: query.id, changes: {}, ...(query.tenant && { tenant_id: query.tenant }) }, ctrl.signal).then(
      (res) => {
        setLoaded({ n: query.n, id: query.id, tenant: query.tenant, base: res.employee })
        setChanges({})
        setResult(res)
        setRetention('')
        setError('')
      },
      (err) => err.name !== 'AbortError' && setLoaded({ n: query.n, error: friendly(err) }),
    )
    return () => ctrl.abort()
  }, [query])

  // ปรับค่าแล้วคำนวณใหม่อัตโนมัติ (หน่วง 300ms ระหว่างลากแถบเลื่อน)
  useEffect(() => {
    if (!loaded?.base) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        // backend รับเงินเดือนเป็นจำนวนเต็ม (ดอลลาร์) ในหน้าเก็บทศนิยมไว้ ช่องจะได้โชว์บาทตรงตามที่กรอก
        const sent = 'MonthlyIncome' in changes ? { ...changes, MonthlyIncome: Math.round(changes.MonthlyIncome) } : changes
        setResult(await post({ employee_id: loaded.id, changes: sent, ...(loaded.tenant && { tenant_id: loaded.tenant }) }, ctrl.signal))
        setError('')
      } catch (err) {
        if (err.name !== 'AbortError') setError(friendly(err))
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [loaded, changes])

  // ต้นทุน Retain vs Replace ของพนักงานคนนี้ (คิดจากข้อมูลเดิม ไม่ใช่ค่าที่ปรับ)
  useEffect(() => {
    if (!loaded?.base) return
    const params = new URLSearchParams()
    if (retention) params.set('retention', retention)
    if (loaded.tenant) params.set('tenant_id', loaded.tenant)
    api(`/financial-impact/${loaded.id}?${params}`).then(setImpact, (err) => setError(friendly(err)))
  }, [loaded, retention])

  function setValue(field, raw) {
    const base = loaded.base[field]
    // เงินเดือนรับเป็นบาท แปลงกลับเป็นดอลลาร์ก่อนส่งเข้าโมเดล ถือว่าเท่าค่าเดิมถ้าปัดเป็นบาทแล้วตรงกัน
    const money = field === 'MonthlyIncome'
    const value = money ? Number(raw) / rate : typeof base === 'number' ? Number(raw) : raw
    const same = money ? Math.round(Number(raw)) === Math.round(base * rate) : base === value
    setChanges((c) => {
      const next = { ...c, [field]: value }
      if (same) delete next[field]
      return next
    })
  }

  if (!query) {
    return (
      <EmptyState icon="sliders" title="เลือกพนักงานเพื่อเริ่มจำลอง">
        ใส่รหัสพนักงานด้านบนแล้วกด “โหลด” จากนั้นลองปรับเงินเดือน OT หรือความพึงพอใจ ระบบจะคำนวณความเสี่ยงใหม่ทันที
      </EmptyState>
    )
  }
  if (loaded?.n === query.n && loaded.error) return <Alert>{loaded.error}</Alert>
  if (loaded?.n !== query.n || !result) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-[36rem]" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  const current = (field) => changes[field] ?? loaded.base[field]
  const delta = result.delta ?? 0
  const afterScore = scoreOf(result.after)
  const nChanged = Object.keys(changes).length

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card
            icon="sliders"
            title="ปรับเงื่อนไข"
            subtitle={nChanged ? `ปรับแล้ว ${nChanged} รายการ (กรอบสีน้ำเงิน)` : 'ลองเลื่อนแถบหรือกดตัวเลือก ระบบคำนวณใหม่ทันที'}
            action={
              <button
                type="button"
                onClick={() => setChanges({})}
                disabled={!nChanged}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon name="reset" className="size-4" />
                กลับเป็นค่าเดิม
              </button>
            }
          >
            <div className="space-y-6">
              {GROUPS.map((g) => (
                <fieldset key={g.title}>
                  <legend className="mb-3 flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">
                    <Icon name={g.icon} className="size-4 text-primary" />
                    {g.title}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {g.controls.map((c) => (
                      c.type === 'money' ? (
                        <MoneyControl key={c.field} {...c} rate={rate} base={loaded.base[c.field]} value={current(c.field)} onChange={(v) => setValue(c.field, v)} />
                      ) : (
                        <Control key={c.field} {...c} base={loaded.base[c.field]} value={current(c.field)} onChange={(v) => setValue(c.field, v)} />
                      )
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </Card>

          {impact && (
            <Card icon="money" title="ต้นทุน Retain vs Replace" subtitle="ประมาณการ คิดจากข้อมูลเดิมของพนักงาน">
              <Field label="มาตรการรักษาคน" className="mb-4 max-w-md">
                <select className={`${inputClass} cursor-pointer`} value={impact.retention} onChange={(e) => setRetention(e.target.value)}>
                  {Object.entries(impact.retention_options).map(([k, text]) => <option key={k} value={k}>{text}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="ต้นทุนถ้าต้องหาคนแทน" value={money(impact.replacement_cost)} tone="red" />
                <Stat label={`ต้นทุนมาตรการ: ${impact.retention_label}`} value={money(impact.retain_cost)} tone="blue" />
                <Stat label="ส่วนต่างถ้ารักษาไว้ได้" value={money(impact.net_benefit_if_retained)} tone="green" />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink px-4 py-3 text-white dark:border dark:border-line">
                <span className="text-sm text-zinc-400">มูลค่าความเสี่ยง (คะแนน × ต้นทุนหาคนแทน)</span>
                <span className="flex items-center gap-2 text-lg font-semibold tabular-nums">
                  {money(impact.expected_loss)}
                  <Icon name="right" className="size-4 text-zinc-500" />
                  {money(afterScore * impact.replacement_cost)}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-fg">
                {`แปลงจากดอลลาร์ใน dataset ที่ ${rate} บาท/ดอลลาร์ (ปรับอัตราได้ที่ช่องด้านบน)`}
                {!impact.include_severance && ' · ไม่นับค่าชดเชยตามมาตรา 118 เพราะจ่ายเมื่อนายจ้างเลิกจ้าง ไม่ใช่เมื่อลาออกเอง'}
              </p>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-6">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-fg">ผลจำลอง</div>
                <div className="font-semibold text-fg">พนักงาน #{loaded.id}</div>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-fg">อัปเดตอัตโนมัติ</span>
            </div>
            <div className="space-y-5">
              <RiskGauge size="md" title="ก่อนปรับ" score={scoreOf(result.before)} band={result.before.risk_band} bandTh={result.before.risk_band_th} />
              <RiskGauge size="md" title="หลังปรับ" score={afterScore} band={result.after.risk_band} bandTh={result.after.risk_band_th} />
              <DeltaBadge delta={delta} />
              {result.warning && <Alert tone="warning">{result.warning}</Alert>}
              <p className="text-xs text-muted-fg">{result.note}</p>
            </div>
          </Card>
        </aside>
      </div>

      {/* มือถือ: แถบคะแนนติดขอบล่าง เลื่อนไปปรับค่าแล้วยังเห็นผล */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div>
            <div className="text-[11px] text-muted-fg">หลังปรับ</div>
            <div className={`text-2xl font-semibold leading-none tabular-nums ${BAND[result.after.risk_band].text}`}>
              {Math.round(afterScore * 100)}
            </div>
          </div>
          <DeltaBadge delta={delta} className="flex-1 py-2" />
        </div>
      </div>
    </div>
  )
}
