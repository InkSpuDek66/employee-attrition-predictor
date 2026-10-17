import { useEffect, useRef, useState } from 'react'
import { featureLabel, JOB_LEVELS, SURVEY_NOTE } from './featureLabels'
import { api, baht, BAND, employeeLabel, friendly, incomeBounds, inputClass, parseIncomeBaht, toApiChanges, toastKind } from './theme'
import { NotFoundState, SorryState } from './mascot/Mascot'
import { EmptyPicker } from './Overview'
import { Alert, Card, CountUp, Icon, RiskGauge, Segmented, Skeleton, UncalibratedNote } from './ui'

// ฟีเจอร์ที่ HR ปรับได้จริงผ่านมาตรการ (ไม่ใส่ข้อมูลส่วนตัว เช่น อายุ เพศ สถานภาพ)
const SAT = [[1, 'ต่ำ'], [2, 'กลาง'], [3, 'สูง'], [4, 'สูงมาก']]
const GROUPS = [
  {
    title: 'ค่าตอบแทน',
    icon: 'money',
    controls: [
      { field: 'MonthlyIncome', type: 'money' },
      { field: 'PercentSalaryHike', type: 'range', min: 0, max: 30, step: 1 },
      {
        field: 'StockOptionLevel',
        type: 'select',
        options: [[0, 'ไม่มี'], [1, '1'], [2, '2'], [3, '3']],
        hint: 'เช่น การสมทบกองทุนสำรองเลี้ยงชีพเพิ่ม หรือหุ้นพนักงาน (EJIP/ESOP) โมเดลเรียนรู้จากข้อมูลหุ้นพนักงาน',
      },
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
        options: [['Non-Travel', 'ไม่ต้องไป'], ['Travel_Rarely', 'นานๆ ครั้ง'], ['Travel_Frequently', 'บ่อย']],
        hint: 'ไปหาลูกค้า/สาขาอื่น ไม่ใช่การเดินทางไปออฟฟิศทุกวัน',
      },
      { field: 'DistanceFromHome', type: 'range', min: 1, max: 30, step: 1, unit: 'กม.' },
      { field: 'WorkLifeBalance', type: 'select', options: [[1, 'แย่'], [2, 'พอใช้'], [3, 'ดี'], [4, 'ดีมาก']] },
      {
        field: 'OfficeDaysPerWeek',
        type: 'select',
        options: [[0, 'WFH ทุกวัน'], [1, '1 วัน'], [2, '2 วัน'], [3, '3 วัน'], [4, '4 วัน'], [5, '5 วัน']],
        hint: 'ยิ่งเข้าออฟฟิศน้อย ระยะทางจากบ้านยิ่งมีผลน้อยลง (ระบบประมาณจากวันที่ต้องเดินทาง โมเดลไม่ได้เรียนเรื่อง WFH โดยตรง)',
        wide: true,
      },
    ],
  },
  {
    title: 'ความก้าวหน้า',
    icon: 'trend',
    controls: [
      { field: 'JobLevel', type: 'select', options: [1, 2, 3, 4, 5].map((v) => [v, JOB_LEVELS[v]]), wide: true },
      // UX-04: ไม่ได้เลื่อนตำแหน่งนานกว่าที่อยู่บริษัทไม่ได้ (backend ตอบ 422) แถบจึงหยุดที่ YearsAtCompany ของคนนั้น
      { field: 'YearsSinceLastPromotion', type: 'range', min: 0, max: 15, step: 1, maxFrom: 'YearsAtCompany' },
      { field: 'TrainingTimesLastYear', type: 'range', min: 0, max: 6, step: 1 },
    ],
  },
  {
    title: 'ความพึงพอใจ',
    icon: 'heart',
    note: SURVEY_NOTE,
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

// เงินเดือน (บาท): พิมพ์ตัวเลขแล้วกด Enter หรือคลิกออก หรือลากแถบก็ได้
function MoneyControl({ field, base, value, onChange }) {
  const shown = Math.round(value)
  const changed = shown !== Math.round(base)
  const step = 500
  // ช่องพิมพ์ใช้ขอบเขตเดียวกับแถบเลื่อน พิมพ์เกินจะถูกดันกลับมาที่ขอบ
  const [min, max] = incomeBounds(base)
  const commit = (input) => {
    const v = parseIncomeBaht(input.value, base, shown)
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
          <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-on-primary">
            เดิม {baht(base)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
        <div className="relative sm:w-64">
          <input
            id="income-input"
            name="monthly_income_thb"
            autoComplete="off"
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
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-fg">
            <span>{baht(min)}</span>
            <span>{baht(max)}</span>
          </div>
        </div>
      </div>
      {/* ระบบเทียบอันดับเงินเดือนกับคนอื่นในบริษัท (ไม่ใช่ตัวเลขเงินตรงๆ) จึงบอกไว้ ขึ้นเงินเดือนแล้วจะเห็นผลเท่าที่อันดับขยับ */}
      <p className="mt-2 text-xs text-muted-fg">พิมพ์ตัวเลขแล้วกด Enter หรือลากแถบก็ได้ · ระบบดูว่าเงินเดือนนี้มากหรือน้อยเมื่อเทียบกับคนอื่นในบริษัท</p>
    </div>
  )
}

// wide = กว้างเต็มแถว (ตัวเลือกยาวๆ เช่น ระดับตำแหน่ง จะได้อยู่แถวเดียว ไม่ทำให้กล่องข้างๆ สูงตาม)
// hint = คำอธิบายสั้นใต้ชื่อช่อง (ช่องที่ชื่ออาจเข้าใจผิด)
// maxFrom คิด max ที่จุดเรียกแล้ว แยกออกจาก range ไม่ให้หลุดไปเป็น attribute ของ <input>
function Control({ field, type, options, base, value, onChange, unit, wide, hint, maxFrom: _maxFrom, ...range }) {
  const withUnit = (v) => (unit ? `${v.toLocaleString()} ${unit}` : v.toLocaleString())
  const changed = value !== base
  const optionText = (v) => options?.find(([o]) => String(o) === String(v))?.[1] ?? v
  return (
    <div
      className={`rounded-lg border p-4 transition-colors duration-200 ${wide ? 'sm:col-span-2' : ''} ${
        changed ? 'border-accent bg-accent-soft/50' : 'border-line bg-card hover:border-secondary/50'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-fg">
          {featureLabel(field)}
          {hint && <span className="block text-xs font-normal text-muted-fg">{hint}</span>}
        </span>
        {changed && (
          <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-on-primary">
            เดิม {type === 'range' ? withUnit(base) : optionText(base)}
          </span>
        )}
      </div>
      {type === 'range' ? (
        <>
          <div className="mb-2 text-xl font-semibold tabular-nums text-fg">{withUnit(value)}</div>
          <input type="range" {...range} value={value} onChange={(e) => onChange(e.target.value)} aria-label={featureLabel(field)} />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-fg">
            <span>{withUnit(range.min)}</span>
            <span>{withUnit(range.max)}</span>
          </div>
        </>
      ) : (
        <Segmented label={featureLabel(field)} options={options} value={value} onChange={onChange} />
      )}
    </div>
  )
}

function Stat({ label, value, tone, sub }) {
  const tones = { red: 'text-risk-high', blue: 'text-accent', green: 'text-risk-low', muted: 'text-muted-fg', amber: 'text-risk-mid' }
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="text-xs font-medium text-muted-fg">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-fg">{sub}</div>}
    </div>
  )
}

// UX-15: ผลที่คาดว่าจะได้ = ความเสี่ยงที่ลดได้ - ต้นทุนมาตรการ (backend คิดให้เมื่อส่ง risk_after)
// ยังไม่ปรับเทียบ: คะแนนตันใกล้ 100 มาตรการขยับได้ไม่กี่คะแนน ผลจึงติดลบแทบทุกครั้ง ไม่ได้แปลว่าไม่คุ้มจริง
// จึงไม่ตัดสินเขียว/แดง บอกแค่ความเสี่ยงที่ลดได้เทียบต้นทุน (critique 2026-10-16 รอบ 5)
// มาตรการที่ยังไม่มีต้นทุนในระบบ (uncosted) = ตัวเลขดูดีเกินจริง ขึ้นสีเหลือง
// points = ผลต่างของคะแนนที่แสดง (ปัดแล้ว) ให้ตรงกับเกจก่อน/หลัง (critique รอบ 7: 99 -> 97 แต่ป้ายบอกลด 3)
function MoneyVerdict({ impact, money, points, before }) {
  if (impact.expected_benefit == null) return null
  // คะแนนไม่ขยับ: ป้าย "ยังไม่เปลี่ยน" อยู่ข้างบนแล้ว ตรงนี้บอกแค่ว่าจ่ายไปแล้วไม่ได้อะไร (เดิมสีเทา มองข้ามง่าย critique รอบ 12)
  if (points === 0) {
    if (!(impact.retain_cost > 0 || impact.uncosted?.length)) return null
    return (
      <p className="rounded-lg bg-risk-mid-soft px-3 py-2 text-xs text-risk-mid" aria-live="polite">
        มีต้นทุน {costText(impact, money)} แต่คะแนนไม่ลดลง{before >= 95 && ' (คะแนนสูงมาก มาตรการเดียวมักลดได้น้อย)'} ควรพิจารณามาตรการอื่นหรือสอบถามพนักงานก่อน
      </p>
    )
  }
  const reduced = impact.expected_loss - impact.expected_loss_after
  // มาตรการที่ระบบยังไม่มีต้นทุน (สวัสดิการระยะยาว งดเดินทาง WFH) ห้ามโชว์ "0 บาท" อ่านเหมือนได้ฟรี (critique รอบ 6)
  const partial = impact.uncosted?.length > 0
  const cost = costText(impact, money)
  const verdict = impact.warning
    ? { tone: 'text-muted-fg', text: 'ปรับเทียบแล้วระบบจะบอกได้ว่าคุ้มไหม ตอนนี้ใช้เทียบว่ามาตรการไหนลดคะแนนได้มากกว่า' }
    : partial
      ? null // คำเตือนต้นทุนไม่ครบอยู่บรรทัดล่างแล้ว ไม่ตัดสินคุ้ม/ไม่คุ้มจากต้นทุนที่ขาด
      : impact.expected_benefit >= 0
        ? { tone: 'text-risk-low', text: `คุ้ม: ความเสี่ยงที่ลดได้มากกว่าต้นทุน ${money(impact.expected_benefit)}` }
        : { tone: 'text-risk-high', text: `ยังไม่คุ้ม: ต้นทุนสูงกว่าความเสี่ยงที่ลดได้ ${money(-impact.expected_benefit)}` }
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        {/* ต้นทุนไม่ครบ = ไม่โชว์บาทที่ลดได้ (เทียบกับต้นทุนที่ขาดแล้วดูเหมือนได้ฟรี) บอกเป็นคะแนนแทน */}
        {/* ยังไม่ปรับเทียบ: คะแนนไม่ใช่โอกาสลาออกจริง คูณเป็นบาทแล้วอ่านเหมือนเงินที่ประหยัดได้จริง จึงโชว์แค่คะแนน + ต้นทุน (critique รอบ 9) */}
        {!partial && !impact.warning && (
          <>
            <dt className="text-muted-fg">{reduced < 0 ? 'มูลค่าความเสี่ยงที่เพิ่มขึ้น' : 'มูลค่าความเสี่ยงที่ลดได้'}</dt>
            <dd className="text-right font-semibold tabular-nums text-fg">{money(Math.abs(reduced))}</dd>
          </>
        )}
        <dt className="text-muted-fg">ต้นทุน (1 ปี)</dt>
        <dd className={`text-right font-semibold tabular-nums ${partial ? 'text-risk-mid' : 'text-fg'}`}>{cost}</dd>
      </dl>
      {verdict && <p className={`mt-2 border-t border-line pt-2 text-xs ${verdict.tone}`}>{verdict.text}</p>}
      {partial && (
        <p className="mt-2 border-t border-line pt-2 text-xs text-risk-mid">
          ต้องประเมินค่าใช้จ่ายของ {impact.uncosted.map(featureLabel).join(', ')} เอง ระบบยังไม่มีตัวเลข จึงไม่คิดเป็นบาท
        </p>
      )}
    </div>
  )
}

// ต้นทุนของแต่ละแถวใน "แต่ละมาตรการช่วยได้เท่าไหร่": จับ measure จาก backend (business_rules.plan_cost) กับฟีเจอร์ของแถว
// measure เดียวใช้ร่วมหลายแถวได้ (เลื่อนตำแหน่ง + อบรม = training_and_promotion_track ก้อนเดียว) แถวหลังบอกว่ารวมไปแล้ว
const MEASURE_FIELDS = {
  salary_raise: ['MonthlyIncome', 'PercentSalaryHike'],
  reduce_overtime: ['OverTime'],
  training_and_promotion_track: ['JobLevel', 'YearsSinceLastPromotion', 'TrainingTimesLastYear'],
}
function rowCosts(rows, impact, money) {
  const claimed = new Set()
  return rows.map((r) => {
    const ms = (impact?.measures ?? []).filter((m) => MEASURE_FIELDS[m.key]?.some((f) => r.keys.includes(f)))
    const fresh = ms.filter((m) => !claimed.has(m.key))
    ms.forEach((m) => claimed.add(m.key))
    const unknown = r.keys.some((k) => impact?.uncosted?.includes(k))
    if (fresh.length) return money(fresh.reduce((t, m) => t + m.cost, 0)) + (unknown ? ' + ยังไม่มีตัวเลข' : '')
    if (ms.length) return 'รวมอยู่ในต้นทุนรายการด้านบนแล้ว'
    return unknown ? 'ยังไม่มีตัวเลข' : 'ไม่มีต้นทุน'
  })
}

// ต้นทุนของสิ่งที่ปรับ ใช้ข้อความเดียวกันทุกที่ (สรุปข้างคะแนน การ์ดต้นทุน ที่มาของตัวเลข)
function costText(impact, money) {
  if (!impact.uncosted?.length) return impact.retain_cost > 0 ? money(impact.retain_cost) : 'ไม่มีต้นทุน' // เช่น ลดเงินเดือน
  return impact.retain_cost > 0 ? `${money(impact.retain_cost)} + ยังไม่มีตัวเลขบางส่วน` : 'ยังไม่มีตัวเลข'
}

// ปัดก่อนแล้วค่อยเลือกสี/ข้อความ (เดิมดูจากค่าก่อนปัด: ขึ้น "ความเสี่ยงเพิ่มขึ้น +0" สีแดง ทั้งที่คะแนนเท่าเดิม)
// idle = ยังไม่ได้ปรับอะไร (เดิมขึ้น "ยังไม่เปลี่ยน 0" อ่านเหมือนจำลองแล้วไม่มีผล critique 2026-10-16)
function DeltaBadge({ delta: raw, idle = false, className = '' }) {
  const delta = Math.round(raw * 100)
  if (idle) {
    return (
      <div className={`rounded-lg bg-muted px-4 py-3 text-sm text-muted-fg ring-1 ring-line ${className}`}>
        ยังไม่ได้ปรับ ลองกดมาตรการหรือปรับค่าในส่วน "ปรับเงื่อนไข" คะแนนหลังปรับจะเปลี่ยนตรงนี้
      </div>
    )
  }
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
      <span className="text-2xl font-semibold tabular-nums">{Math.abs(delta)}</span>
    </div>
  )
}

// ปัจจัยที่ทำให้คะแนนเปลี่ยนมากสุด (backend เทียบ SHAP ก่อน/หลัง) ไว้ตอบ "ทำไมขึ้นเงินเดือนแล้วความเสี่ยงไม่ลด"
// ฟีเจอร์ที่โมเดลคิดจากหลายช่อง: ถือว่า "ปรับแล้ว" ถ้าช่องใดช่องหนึ่งในนี้ถูกปรับ
const DERIVED = {
  OverTimeXDistance: ['OverTime', 'DistanceFromHome', 'OfficeDaysPerWeek'],
  AvgSatisfaction: ['EnvironmentSatisfaction', 'JobSatisfaction', 'RelationshipSatisfaction', 'JobInvolvement'],
  TenureRatio: ['YearsAtCompany', 'TotalWorkingYears'],
  DistanceFromHome: ['DistanceFromHome', 'OfficeDaysPerWeek'],
}
function Drivers({ drivers, changed }) {
  if (!drivers?.length) return null
  const touched = (f) => (DERIVED[f] ?? [f]).some((k) => k in changed)
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-fg">สิ่งที่ทำให้คะแนนเปลี่ยน</div>
      <ul className="space-y-1">
        {drivers.map((d) => (
          <li key={d.feature} className="flex items-center gap-2 text-sm text-fg">
            <Icon name={d.change > 0 ? 'up' : 'down'} className={`size-4 shrink-0 ${d.change > 0 ? 'text-risk-high' : 'text-risk-low'}`} />
            <span className="min-w-0 flex-1">
              {featureLabel(d.feature)}
              {!touched(d.feature) && <span className="block text-xs text-muted-fg">ไม่ได้ปรับ แต่โมเดลคิดร่วมกับสิ่งที่ปรับ</span>}
            </span>
            <span className={`text-xs ${d.change > 0 ? 'text-risk-high' : 'text-risk-low'}`}>{d.change > 0 ? 'ทำให้เสี่ยงขึ้น' : 'ทำให้เสี่ยงลดลง'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ข้อความเด้งเมื่อระดับความเสี่ยงหลังปรับเปลี่ยน เล่นครั้งเดียวต่อ key
// ลดลง = ประกายฉลอง, เพิ่มขึ้น = ป้ายเตือนสั่นนิดๆ (ป้ายพื้นอ่อน + ตัวหนังสือสีระดับ อ่านได้ทั้งโหมดมืด/สว่าง)
const SPARKS = [[-70, -50], [70, -55], [-90, 10], [90, 5], [-50, 60], [55, 65], [0, -80], [0, 80]]
const BAND_TOAST = {
  low: { text: 'เยี่ยมเลย! ลดเหลือระดับต่ำ', icon: 'check', pill: 'bg-risk-low-soft text-risk-low ring-risk-low/30', sparks: ['fill-risk-low', 'fill-risk-mid', 'fill-accent'] },
  midDown: { text: 'ดีขึ้นแล้ว! ลดเหลือระดับปานกลาง', icon: 'down', pill: 'bg-risk-mid-soft text-risk-mid ring-risk-mid/30', sparks: ['fill-risk-mid', 'fill-accent'] },
  midUp: { text: 'ระวัง! เพิ่มเป็นระดับปานกลาง', icon: 'warning', pill: 'bg-risk-mid-soft text-risk-mid ring-risk-mid/30', warn: true },
  high: { text: 'ระวัง! ความเสี่ยงเพิ่มเป็นระดับสูง', icon: 'warning', pill: 'bg-risk-high-soft text-risk-high ring-risk-high/30', warn: true },
}

function BandToast({ kind }) {
  const t = BAND_TOAST[kind]
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      {!t.warn &&
        SPARKS.slice(0, kind === 'low' ? 8 : 6).map(([dx, dy], i) => (
          <svg
            key={i}
            viewBox="-7 -7 14 14"
            aria-hidden="true"
            className={`celebrate-spark absolute size-5 ${t.sparks[i % t.sparks.length]}`}
            style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${(i % 4) * 60}ms` }}
          >
            <path d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7Z" />
          </svg>
        ))}
      <div role="status" className="celebrate-text">
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold shadow-sm ring-1 ${t.pill} ${t.warn ? 'toast-shake' : ''}`}>
          <Icon name={t.icon} className="size-4" />
          {t.text}
        </div>
      </div>
    </div>
  )
}

// มาตรการสำเร็จรูป: กดทีเดียวปรับหลายช่อง (เงินเดือนเป็นบาท)
// retention = มาตรการใน config/financial_impact.json ที่ใช้คิดต้นทุน กดแล้วการ์ดต้นทุนเปลี่ยนตาม (UX-15 ข้อ 2 / UX-03)
const PRESETS = [
  { label: 'ปิด OT', retention: 'reduce_overtime', apply: () => ({ OverTime: 'No' }) },
  // เปลี่ยนแค่เงินเดือน (เดิมแอบเพิ่ม "เงินเดือนขึ้นล่าสุด (%)" ด้วย ผู้ใช้ไม่เห็นว่าเปลี่ยน critique 2026-10-16)
  { label: 'ขึ้นเงินเดือน 10%', retention: 'salary_raise_10pct', apply: (b) => ({ MonthlyIncome: b.MonthlyIncome * 1.1 }) },
  { label: 'ขึ้นเงินเดือน 20%', retention: 'salary_raise_20pct', apply: (b) => ({ MonthlyIncome: b.MonthlyIncome * 1.2 }) },
  // เลื่อนตำแหน่งในไทยมักขึ้นเงินเดือนด้วย (เดิมไม่ขึ้น: ระดับสูงขึ้นแต่เงินเท่าเดิม โมเดลกลับให้เสี่ยงขึ้น critique รอบ 5)
  { label: 'เลื่อนตำแหน่ง + ขึ้นเงินเดือน 15%', retention: 'training_and_promotion_track', apply: (b) => ({ JobLevel: Math.min(5, b.JobLevel + 1), YearsSinceLastPromotion: 0, MonthlyIncome: b.MonthlyIncome * 1.15 }) },
  { label: 'งดงานนอกสถานที่', apply: () => ({ BusinessTravel: 'Non-Travel' }) },
  { label: 'ให้ WFH 3 วัน (เข้าออฟฟิศ 2 วัน)', apply: (b) => ({ OfficeDaysPerWeek: Math.min(b.OfficeDaysPerWeek ?? 5, 2) }) },
  { label: 'อบรมเพิ่ม', retention: 'training_and_promotion_track', apply: (b) => ({ TrainingTimesLastYear: Math.min(6, b.TrainingTimesLastYear + 2) }) },
  { label: 'เพิ่มสวัสดิการระยะยาว', apply: (b) => ({ StockOptionLevel: Math.max(1, b.StockOptionLevel) }) },
]
const CONTROL = Object.fromEntries(GROUPS.flatMap((g) => g.controls.map((c) => [c.field, c])))
// ปัจจัยใน SHAP ที่ไม่ใช่ช่องปรับตรงๆ → ช่องที่ปรับแล้วมีผล (OT ร่วมกับบ้านไกล = OT + ระยะทาง)
// ระยะทางจากบ้าน HR ย้ายบ้านพนักงานไม่ได้ ชี้ไปที่วันเข้าออฟฟิศ (WFH) แทน (critique รอบ 8)
const FEATURE_FIELDS = { OverTimeXDistance: ['OverTime', 'OfficeDaysPerWeek'], DistanceFromHome: ['OfficeDaysPerWeek'] }
const FOCUS_N = 3
// ผลแบบสำรวจ (ความพึงพอใจ ฯลฯ) HR สั่งให้เปลี่ยนไม่ได้ ไม่เสนอเป็นเรื่องแรกที่ควรลอง (ยังปรับในกลุ่มด้านล่างได้ critique รอบ 9)
const SURVEY = new Set(['AvgSatisfaction', 'JobSatisfaction', 'EnvironmentSatisfaction', 'RelationshipSatisfaction', 'JobInvolvement', 'WorkLifeBalance'])
const PRESETS_SHOWN = 4

// ช่องที่ควรลองก่อนของคนนี้: ปัจจัยที่บริษัทปรับได้และดันความเสี่ยงขึ้นมากสุด (จาก /shap) ไม่เกิน 3 ช่อง
function focusFields(contributions) {
  const out = []
  for (const c of contributions) {
    if (c.shap_value <= 0 || c.kind !== 'actionable' || SURVEY.has(c.feature)) continue
    for (const f of FEATURE_FIELDS[c.feature] ?? [c.feature]) if (CONTROL[f] && !out.includes(f)) out.push(f)
    if (out.length >= FOCUS_N) break
  }
  return out.slice(0, FOCUS_N)
}

// ค่าที่คนอ่านเข้าใจ เช่น "ทำงานล่วงเวลา (OT): ไม่ทำ", "รายได้ต่อเดือน: 40,000 บาท"
function describe(changes) {
  return Object.entries(changes)
    .map(([f, v]) => {
      const opt = CONTROL[f]?.options?.find(([o]) => String(o) === String(v))?.[1]
      return `${featureLabel(f)}: ${f === 'MonthlyIncome' ? baht(v) : (opt ?? v.toLocaleString())}`
    })
    .join(' · ')
}

export default function WhatIfSimulator({ query, who, tenant, onRisk, onDone, onPick }) {
  const money = baht
  const [loaded, setLoaded] = useState(null) // { n, id, tenant, base } หรือ { n, error } ของพนักงานที่โหลดล่าสุด
  const [changes, setChanges] = useState({})
  const [result, setResult] = useState(null)
  const [impact, setImpact] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState([]) // ผลจำลองที่บันทึกไว้เทียบ (ต่อพนักงานหนึ่งคน สูงสุด 4)
  const [toast, setToast] = useState(null) // { n, kind } ข้อความเด้งตอนระดับความเสี่ยงหลังปรับเปลี่ยน (n เพิ่มทุกครั้ง ให้เล่นใหม่)
  const lastBand = useRef(null)
  // ผลจำลองที่ปรับไว้แยกตามพนักงาน กดคนถัดไปแล้วกลับมายังอยู่ (เดิมหายเงียบๆ critique รอบ 10) หายเมื่อโหลดข้อมูลใหม่/ออกจากระบบ
  const memory = useRef({})
  useEffect(() => {
    if (loaded?.base) memory.current[loaded.id] = { changes, saved }
  }, [loaded, changes, saved])
  // แต่ละมาตรการที่กดอยู่ช่วยได้กี่คะแนน (ลองเอาออกทีละอย่าง) มาตรการที่มีต้นทุนแต่ไม่ลดคะแนนจะเห็นทันที
  const [parts, setParts] = useState({ key: '', rows: [] })
  const [focus, setFocus] = useState({ id: null, fields: [] }) // ช่องที่ควรลองก่อน (ปัจจัยหลักของคนนี้จาก SHAP)
  const [allPresets, setAllPresets] = useState(false)

  // ปัจจัยหลักของคนนี้: ใช้ /shap เดียวกับหน้า "ทำไมถึงเสี่ยง" โหลดไม่ได้ = ไม่มีช่องแนะนำ (ทุกกลุ่มยังเปิดดูได้)
  useEffect(() => {
    if (!query) return
    const ctrl = new AbortController()
    api(`/shap/${query.id}?top_n=15`, { signal: ctrl.signal }).then(
      (d) => setFocus({ id: query.id, fields: focusFields(d.contributions) }),
      (err) => err.name !== 'AbortError' && setFocus({ id: query.id, fields: [] }),
    )
    return () => ctrl.abort()
  }, [query])

  // โหลดพนักงานใหม่เมื่อเลือกจากช่องด้านบน
  useEffect(() => {
    if (!query) return
    const ctrl = new AbortController()
    post({ employee_id: query.id, changes: {}, ...(query.tenant && { tenant_id: query.tenant }) }, ctrl.signal).then(
      (res) => {
        setLoaded({ n: query.n, id: query.id, tenant: query.tenant, base: res.employee })
        onDone()
        const kept = memory.current[query.id]
        setChanges(kept?.changes ?? {})
        setSaved(kept?.saved ?? [])
        setResult(res)
        lastBand.current = res.after.risk_band
        onRisk({ id: query.id, band: res.after.risk_band, score: scoreOf(res.after), label: 'คะแนน' })
        setError('')
      },
      (err) => {
        if (err.name === 'AbortError') return
        const notFound = err.status === 404
        setLoaded({ n: query.n, error: friendly(err), notFound })
        onDone()
        onRisk({ error: true, notFound })
      },
    )
    return () => ctrl.abort()
  }, [query, onRisk, onDone])

  // ปรับค่าแล้วคำนวณใหม่อัตโนมัติ (หน่วง 300ms ระหว่างลากแถบเลื่อน)
  useEffect(() => {
    if (!loaded?.base) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        // backend รับเงินเดือนเป็นบาทจำนวนเต็ม ในหน้าเก็บทศนิยมไว้ (ขึ้น 10% ของ 45,123 บาท) ปัดตอนส่ง
        const sent = toApiChanges(changes)
        const res = await post({ employee_id: loaded.id, changes: sent, ...(loaded.tenant && { tenant_id: loaded.tenant }) }, ctrl.signal)
        setResult(res)
        // เทียบกับผลครั้งก่อน (ครั้งแรกเทียบกับระดับก่อนปรับ) ไม่ฉลองถ้าระดับไม่เปลี่ยน
        const kind = toastKind(lastBand.current ?? res.before.risk_band, res.after.risk_band)
        if (kind) setToast((t) => ({ n: (t?.n ?? 0) + 1, kind }))
        lastBand.current = res.after.risk_band
        onRisk({ id: loaded.id, band: res.after.risk_band, score: scoreOf(res.after), label: Object.keys(sent).length ? 'หลังปรับ' : 'คะแนน' })
        setError('')
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(friendly(err))
        onRisk({ error: true })
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [loaded, changes, onRisk])

  // ต้นทุน Retain vs Replace ของพนักงานคนนี้ (คิดจากข้อมูลเดิม ไม่ใช่ค่าที่ปรับ)
  // ปรับค่าแล้วส่งคะแนนหลังปรับ + ค่าที่ปรับทั้งหมดไปด้วย backend คิด "ผลที่คาดว่าจะได้" ให้ (UX-15) ยังไม่ปรับ = ไม่ส่ง
  // ต้นทุนมาตรการคิดจากทุกอย่างที่ปรับ (ความเสี่ยงที่ลดก็มาจากทุกอย่าง) ไม่ใช่มาตรการเดียวในช่องเลือก
  const riskAfter = result && Object.keys(result.changes_applied).length ? scoreOf(result.after) : null
  const applied = riskAfter != null ? JSON.stringify(result.changes_applied) : null
  useEffect(() => {
    if (!loaded?.base) return
    const ctrl = new AbortController()
    const params = new URLSearchParams()
    if (riskAfter != null) params.set('risk_after', riskAfter)
    if (applied) params.set('changes', applied)
    api(`/financial-impact/${loaded.id}?${params}`, { signal: ctrl.signal }).then(setImpact, (err) => err.name !== 'AbortError' && setError(friendly(err)))
    return () => ctrl.abort()
  }, [loaded, riskAfter, applied])

  // ค่าเท่าค่าเดิมไหม (เงินเดือนเทียบเป็นบาทปัดเต็ม เพราะในหน้าเก็บทศนิยม)
  const isBase = (field, v) =>
    field === 'MonthlyIncome' ? Math.round(v) === Math.round(loaded.base[field]) : v === loaded.base[field]

  // สถานะปุ่มมาตรการ: noop = คนนี้เป็นแบบนั้นอยู่แล้ว (เช่น ปิด OT กับคนที่ไม่ทำ OT) กดไม่ได้
  // applied = ค่าที่ปรับอยู่ตรงกับมาตรการนี้ กดอีกทีเพื่อยกเลิก (คืนค่าเดิมเฉพาะช่องของมาตรการนี้)
  // เงินเดือน: ส่ง API เป็นบาทจำนวนเต็ม (toApiChanges) ค่าที่กลับมาอาจต่างจากที่คำนวณไม่ถึง 1 บาท ถือว่าเท่ากัน
  const sameValue = (field, a, b) => (field === 'MonthlyIncome' ? Math.abs(a - b) < 1 : a === b)
  function presetState(p) {
    const patch = p.apply(loaded.base)
    const keys = Object.keys(patch)
    if (keys.every((k) => isBase(k, patch[k]))) return 'noop'
    // ช่องที่เท่าค่าเดิมอยู่แล้วนับว่าใช้แล้ว (applyPreset ไม่เก็บช่องนั้นไว้ใน changes) เดิมปุ่มเลื่อนตำแหน่งของคนที่เพิ่งเลื่อน
    // ตำแหน่งไม่ขึ้นว่ากดอยู่ กดยกเลิกไม่ได้ (critique รอบ 9)
    return keys.every((k) => (k in changes ? sameValue(k, changes[k], patch[k]) : isBase(k, patch[k]))) ? 'applied' : 'off'
  }
  function applyPreset(p) {
    const patch = p.apply(loaded.base)
    if (presetState(p) === 'applied') {
      return setChanges((c) => Object.fromEntries(Object.entries(c).filter(([k]) => !(k in patch))))
    }
    setChanges((c) => {
      const next = { ...c, ...patch }
      for (const k of Object.keys(patch)) if (isBase(k, next[k])) delete next[k]
      return next
    })
  }

  const changesKey = JSON.stringify(changes)
  useEffect(() => {
    if (!loaded?.base) return
    const applied = PRESETS.filter((p) => presetState(p) === 'applied').map((p) => ({ label: p.label, keys: Object.keys(p.apply(loaded.base)) }))
    const covered = new Set(applied.flatMap((g) => g.keys))
    const groups = [...applied, ...Object.keys(changes).filter((k) => !covered.has(k)).map((k) => ({ label: featureLabel(k), keys: [k] }))]
    if (groups.length < 2) return void setParts({ key: changesKey, rows: [] })
    const ctrl = new AbortController()
    const body = (c) => ({ employee_id: loaded.id, changes: toApiChanges(c), ...(loaded.tenant && { tenant_id: loaded.tenant }) })
    const timer = setTimeout(async () => {
      try {
        const all = await post(body(changes), ctrl.signal)
        const rows = await Promise.all(
          groups.map(async (g) => {
            const without = Object.fromEntries(Object.entries(changes).filter(([k]) => !g.keys.includes(k)))
            const r = await post(body(without), ctrl.signal)
            return { ...g, points: Math.round(scoreOf(all.after) * 100) - Math.round(scoreOf(r.after) * 100) }
          }),
        )
        setParts({ key: changesKey, rows })
      } catch (err) {
        if (err.name !== 'AbortError') setParts({ key: changesKey, rows: [] })
      }
    }, 400)
    return () => (clearTimeout(timer), ctrl.abort())
    // presetState อ่าน changes/loaded ที่อยู่ใน deps แล้ว (changesKey แทน changes ไม่ให้ยิงซ้ำตอน object ใหม่ค่าเดิม)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, changesKey])

  function saveScenario() {
    setSaved((s) => [...s, { key: Date.now(), changes, after: scoreOf(result.after), band: result.after.risk_band, delta }])
  }

  function setValue(field, raw) {
    const base = loaded.base[field]
    // เงินเดือนเป็นบาท ถือว่าเท่าค่าเดิมถ้าปัดเป็นบาทเต็มแล้วตรงกัน
    const money = field === 'MonthlyIncome'
    const value = money || typeof base === 'number' ? Number(raw) : raw
    const same = money ? Math.round(value) === Math.round(base) : base === value
    setChanges((c) => {
      const next = { ...c, [field]: value }
      if (same) delete next[field]
      return next
    })
  }

  if (!query) {
    return (
      <EmptyPicker who={who} tenant={tenant} title="มาลองจำลองกันเถอะ" onPick={onPick}>
        ใส่รหัสพนักงานด้านบนแล้วกด “โหลด” จากนั้นลองปรับเงินเดือน OT หรือความพึงพอใจ เดี๋ยวเราคำนวณความเสี่ยงใหม่ให้ทันที
      </EmptyPicker>
    )
  }
  if (loaded?.n === query.n && loaded.error) {
    return loaded.notFound ? <NotFoundState who={who} message={loaded.error} /> : <SorryState message={loaded.error} />
  }
  if (loaded?.n !== query.n || !result) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-[36rem]" />
        <Skeleton className="h-80" />
      </div>
    )
  }

  const current = (field) => changes[field] ?? loaded.base[field]
  // ผลต่างจากคะแนนที่แสดงบนเกจ (ปัดแล้ว) ไม่ใช่ค่าก่อนปัด ไม่งั้น 99 -> 97 จะขึ้นว่าลด 3
  const delta = (Math.round(scoreOf(result.after) * 100) - Math.round(scoreOf(result.before) * 100)) / 100
  const afterScore = scoreOf(result.after)
  const nChanged = Object.keys(changes).length
  const alreadySaved = saved.some((s) => JSON.stringify(s.changes) === JSON.stringify(changes))
  const partRows = parts.key === changesKey ? parts.rows : []
  const partCosts = rowCosts(partRows, impact, money)
  // เลื่อนตำแหน่งไม่ช่วย: ดูจากผลของมาตรการนี้เอง (ถ้าใช้ร่วมกับอย่างอื่น) ไม่ใช่ผลรวม (เดิมรวมแล้วลด ป้ายเลยไม่ขึ้น critique รอบ 10)
  const promoRow = partRows.find((r) => r.label.startsWith('เลื่อนตำแหน่ง'))
  const promotionNoHelp = 'JobLevel' in result.changes_applied && (promoRow ? promoRow.points >= 0 : Math.round(delta * 100) >= 0)
  const focused = focus.id === loaded.id ? focus.fields : []
  // มาตรการที่ตรงกับปัจจัยหลักขึ้นก่อน แสดง 4 อัน ที่เหลือกดดูเพิ่ม (เดิม 8 ปุ่มพร้อมกัน)
  const hits = (p) => (Object.keys(p.apply(loaded.base)).some((k) => focused.includes(k)) ? 1 : 0)
  const presets = [...PRESETS].sort((a, b) => hits(b) - hits(a))
  const shownPresets = allPresets ? presets : presets.slice(0, PRESETS_SHOWN)
  const renderControl = (c) =>
    c.type === 'money' ? (
      <MoneyControl key={c.field} {...c} base={loaded.base[c.field]} value={current(c.field)} onChange={(v) => setValue(c.field, v)} />
    ) : (
      <Control
        key={c.field}
        {...c}
        {...(c.maxFrom && { max: Math.min(c.max, loaded.base[c.maxFrom]), hint: `ไม่เกินจำนวนปีที่อยู่บริษัทนี้ (${loaded.base[c.maxFrom]} ปี)` })}
        base={loaded.base[c.field]}
        value={current(c.field)}
        onChange={(v) => setValue(c.field, v)}
      />
    )

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="contents lg:block lg:space-y-4">
          <Card
            icon="sliders"
            title="ปรับเงื่อนไข"
            subtitle={nChanged ? `ปรับแล้ว ${nChanged} รายการ (กรอบสีน้ำเงิน)` : 'ลองเลื่อนแถบหรือกดตัวเลือก ระบบคำนวณใหม่ทันที'}
            action={
              <button
                type="button"
                onClick={() => setChanges({})}
                disabled={!nChanged}
                title={nChanged ? undefined : 'ยังไม่ได้ปรับอะไร'}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-accent transition-colors duration-200 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-dashed disabled:text-muted-fg disabled:opacity-80 disabled:hover:bg-transparent"
              >
                <Icon name="reset" className="size-4" />
                กลับเป็นค่าเดิม
              </button>
            }
          >
            <div className="mb-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">มาตรการสำเร็จรูป</div>
              <div className="flex flex-wrap gap-2">
                {shownPresets.map((p) => {
                  const state = presetState(p)
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      disabled={state === 'noop'}
                      aria-pressed={state === 'applied'}
                      title={state === 'noop' ? 'พนักงานคนนี้เป็นแบบนี้อยู่แล้ว' : state === 'applied' ? 'กดอีกครั้งเพื่อยกเลิก' : undefined}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        state === 'applied'
                          ? 'cursor-pointer border-accent bg-accent-soft text-accent'
                          : state === 'noop'
                            ? 'cursor-not-allowed border-dashed border-line text-muted-fg'
                            : 'lift cursor-pointer border-line bg-card text-fg hover:border-accent hover:bg-accent-soft hover:text-accent'
                      }`}
                    >
                      {state === 'applied' ? <Icon name="check" className="size-4" /> : state === 'off' ? <span aria-hidden="true">+</span> : null}
                      {p.label}
                      {state === 'noop' && <span className="text-xs font-normal">· ทำอยู่แล้ว</span>}
                    </button>
                  )
                })}
                {PRESETS.length > PRESETS_SHOWN && (
                  <button
                    type="button"
                    onClick={() => setAllPresets((v) => !v)}
                    aria-expanded={allPresets}
                    className="inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-sm font-medium text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {allPresets ? 'ย่อ' : `มาตรการอื่น (${PRESETS.length - PRESETS_SHOWN})`}
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-fg">กดหลายอันได้ ผลรวมกัน · กดซ้ำเพื่อยกเลิก · ปรับละเอียดต่อได้ที่ช่องด้านล่าง</p>
            </div>
            {focused.length > 0 && (
              <fieldset className="mb-6">
                <legend className="mb-1 text-sm font-semibold text-fg">ลองปรับเรื่องเหล่านี้ก่อน</legend>
                <p className="mb-3 text-xs text-muted-fg">ปัจจัยที่บริษัทปรับได้และดันความเสี่ยงของคนนี้ขึ้นมากที่สุด</p>
                <div className="grid gap-3 sm:grid-cols-2">{focused.map((f) => renderControl({ ...CONTROL[f], wide: CONTROL[f].type === 'money' || CONTROL[f].wide }))}</div>
              </fieldset>
            )}
            {/* กลุ่มอื่นพับไว้ (เดิมเปิดทุกช่องพร้อมกัน ~15 ช่อง) กลุ่มที่มีค่าปรับแล้วเปิดค้าง */}
            <div className="divide-y divide-line rounded-xl border border-line">
              {GROUPS.map((g) => {
                const rest = g.controls.filter((c) => !focused.includes(c.field))
                if (!rest.length) return null
                const touched = rest.filter((c) => c.field in changes).length
                return (
                  <details key={g.title} open={touched > 0 || undefined} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-fg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                      <Icon name={g.icon} className="size-4 text-accent" />
                      {g.title}
                      <span className="text-xs font-normal text-muted-fg">
                        {touched ? `ปรับแล้ว ${touched}` : rest.length < g.controls.length ? `อีก ${rest.length} รายการ` : `${rest.length} รายการ`}
                      </span>
                      <Icon name="chevron" className="ml-auto size-4 text-muted-fg transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      {g.note && <p className="mb-3 text-xs text-muted-fg">{g.note}</p>}
                      <div className="grid gap-3 sm:grid-cols-2">{rest.map(renderControl)}</div>
                    </div>
                  </details>
                )
              })}
            </div>
          </Card>

          {impact && (
            <Card className="order-3 lg:order-none" icon="money" title="ต้นทุน: ดูแลต่อ หรือ หาคนแทน" subtitle="ประมาณการ คิดจากข้อมูลเดิมของพนักงาน">
              {/* ผลคุ้ม/ไม่คุ้มอยู่ข้างคะแนนด้านขวา (MoneyVerdict) ตรงนี้เป็นตัวเลขประกอบ */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat
                  label="ต้นทุนถ้าต้องหาคนแทน"
                  value={money(impact.replacement_cost)}
                  tone="muted"
                  sub={impact.warning ? 'ใช้เทียบความสำคัญระหว่างพนักงาน เทียบกับต้นทุนมาตรการตรงๆ ไม่ได้' : 'ใช้คูณกับคะแนนเป็นมูลค่าความเสี่ยง เทียบกับต้นทุนมาตรการตรงๆ ไม่ได้'}
                />
                <Stat
                  label="ต้นทุนมาตรการที่ปรับ (1 ปี)"
                  value={!impact.costed_from_changes ? '—' : impact.uncosted?.length && impact.retain_cost > 0 ? money(impact.retain_cost) : costText(impact, money)}
                  tone={!impact.costed_from_changes ? 'muted' : impact.uncosted?.length ? 'amber' : 'blue'}
                  sub={
                    !impact.costed_from_changes
                      ? 'ลองกดมาตรการหรือปรับค่าก่อน'
                      : impact.uncosted?.length && impact.retain_cost > 0
                        ? `+ ยังไม่มีตัวเลขของ ${impact.uncosted.map(featureLabel).join(', ')}`
                        : impact.measures?.length > 1
                        ? `รวม ${impact.measures.length} มาตรการ`
                        : undefined
                  }
                />
              </div>
              {/* บอกที่มาของตัวเลข กันคนเข้าใจผิดว่าเป็นต้นทุนจริงของบริษัท (สูตรใน src/business_rules.py) */}
              <details className="group mt-3 rounded-lg bg-muted text-xs text-muted-fg">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 font-medium text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                  ดูที่มาของตัวเลข
                  <Icon name="chevron" className="ml-auto size-3.5 text-muted-fg transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="space-y-1 px-4 pb-3">
                <p>
                  <b className="text-fg">ต้นทุนหาคนแทน</b> = เงินเดือน {money(impact.monthly_income)} × 12 เดือน ×{' '}
                  {(impact.hiring_cost / (impact.monthly_income * 12)).toFixed(2)} (ตัวคูณของ{' '}{JOB_LEVELS[impact.job_level] ?? `ระดับ ${impact.job_level}`})
                  {impact.include_severance && ` + ค่าชดเชย ${impact.severance_days} วัน (${money(impact.severance_pay)})`}
                </p>
                {impact.costed_from_changes && (
                  <p>
                    <b className="text-fg">ต้นทุนมาตรการ</b> ={' '}
                    {impact.measures.length
                      ? impact.measures.map((m) => `${m.label} ${money(m.cost)}`).join(' + ')
                      : impact.uncosted?.length
                        ? 'ยังไม่มีตัวเลข'
                        : 'ไม่มีมาตรการที่มีค่าใช้จ่าย'}
                    {impact.measures.length > 0 && impact.uncosted?.length > 0 && ' + ยังไม่มีตัวเลข'}
                    {impact.uncosted?.length > 0 && ` (ของ ${impact.uncosted.map(featureLabel).join(', ')})`}
                  </p>
                )}
                {!impact.warning && <p>
                  <b className="text-fg">มูลค่าความเสี่ยง</b> = คะแนน × ต้นทุนหาคนแทน
                  {impact.expected_benefit != null &&
                    !impact.uncosted?.length &&
                    !impact.warning &&
                    Math.round(delta * 100) !== 0 &&
                    ` ก่อน ${money(impact.expected_loss)} หลังปรับ ${money(impact.expected_loss_after)}`}
                </p>}
                <p>
                  ตัวคูณเป็นค่าประมาณจากเบนช์มาร์กสากล ใช้เปรียบเทียบ ไม่ใช่ต้นทุนจริงของบริษัท
                  {!impact.include_severance && ' · ไม่นับค่าชดเชยตามมาตรา 118 เพราะจ่ายเมื่อนายจ้างเลิกจ้าง ไม่ใช่เมื่อลาออกเอง'}
                </p>
                </div>
              </details>
            </Card>
          )}
        </div>

        <aside className="relative order-2 lg:sticky lg:top-20 lg:order-none">
          {toast && <BandToast key={toast.n} kind={toast.kind} />}
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-fg">ผลจำลอง</div>
                <div className="font-semibold text-fg">{employeeLabel(loaded.id, result.name)}</div>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-fg">อัปเดตอัตโนมัติ</span>
            </div>
            <div className="space-y-5">
              {/* เกจเดียว (เดิมก่อน/หลังเป็นเกจคู่ ช่องขวาซ้อน 9 กล่อง critique รอบ 9) ก่อนปรับเหลือบรรทัดเดียว */}
              {nChanged > 0 && (
                <p className="text-sm text-muted-fg">
                  ก่อนปรับ <b className={`tabular-nums ${BAND[result.before.risk_band].text}`}>{Math.round(scoreOf(result.before) * 100)}</b> · เสี่ยง
                  {result.before.risk_band_th}
                </p>
              )}
              <RiskGauge size="md" title={nChanged ? 'หลังปรับ' : 'คะแนนตอนนี้'} score={afterScore} band={result.after.risk_band} bandTh={result.after.risk_band_th} />
              <div aria-live="polite" className="space-y-3">
                <DeltaBadge delta={delta} idle={!nChanged} />
                {result.drivers?.length > 0 && (
                  <details className="group rounded-lg border border-line">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-fg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                      ทำไมคะแนนเปลี่ยน ({result.drivers.length})
                      <Icon name="chevron" className="ml-auto size-3.5 text-muted-fg transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-3 pb-3">
                      <Drivers drivers={result.drivers} changed={result.changes_applied} />
                    </div>
                  </details>
                )}
                {partRows.length > 0 && (
                  <div className="rounded-lg border border-line p-3">
                    <div className="text-xs font-medium text-muted-fg">ผลของแต่ละมาตรการ (เมื่อใช้ร่วมกัน)</div>
                    <p className="mb-2 text-xs text-muted-fg">คำนวณโดยนำมาตรการนั้นออกจากแผน แล้วเทียบคะแนนที่เปลี่ยนไป</p>
                    <ul className="space-y-1.5 text-sm">
                      {partRows.map((r, i) => (
                        <li key={r.label} className="flex items-start justify-between gap-2">
                          <span className="min-w-0 text-fg">{r.label}</span>
                          <span className="shrink-0 text-right">
                            <span className={`block tabular-nums ${r.points < 0 ? 'text-risk-low' : 'text-risk-mid'}`}>
                              {r.points < 0 ? `ลด ${-r.points} คะแนน` : r.points > 0 ? `เพิ่ม ${r.points} คะแนน` : 'ไม่ลดคะแนน'}
                            </span>
                            {impact && <span className="block text-xs tabular-nums text-muted-fg">{partCosts[i]}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {partRows.reduce((t, r) => t + r.points, 0) !== Math.round(delta * 100) && (
                      <p className="mt-2 text-xs text-muted-fg">ผลรวมของแต่ละมาตรการอาจไม่เท่ากับคะแนนที่เปลี่ยนทั้งหมด เนื่องจากโมเดลคำนวณผลของหลายปัจจัยร่วมกัน</p>
                    )}
                  </div>
                )}
                {promotionNoHelp && (
                  <p className="rounded-lg bg-risk-mid-soft px-3 py-2 text-xs text-risk-mid">
                    การเลื่อนตำแหน่งไม่ทำให้คะแนนของพนักงานคนนี้ลดลง
                    {Math.round(scoreOf(result.before) * 100) >= 95 && ' (คะแนนสูงมาก มาตรการเดียวมักลดได้น้อย)'} ควรสอบถามพนักงานก่อนว่าต้องการเติบโตในรูปแบบใด
                  </p>
                )}
                <MoneyVerdict impact={impact ?? {}} money={money} points={Math.round(delta * 100)} before={Math.round(scoreOf(result.before) * 100)} />
              </div>
              <button
                type="button"
                onClick={saveScenario}
                disabled={!nChanged || alreadySaved || saved.length >= 4}
                title={nChanged ? undefined : 'ปรับเงื่อนไขก่อน แล้วค่อยบันทึกไว้เทียบ'}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:border-dashed disabled:text-muted-fg disabled:opacity-80 disabled:hover:bg-transparent"
              >
                <Icon name="list" className="size-4" />
                {alreadySaved ? 'บันทึกแบบนี้ไว้แล้ว' : saved.length >= 4 ? 'บันทึกได้สูงสุด 4 แบบ' : 'บันทึกผลนี้ไว้เทียบ'}
              </button>
              {saved.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-fg">ผลที่บันทึกไว้ (กดเพื่อใช้อีกครั้ง)</div>
                  <ul className="space-y-2">
                    {[...saved]
                      .sort((a, b) => a.after - b.after)
                      .map((s, i) => (
                        <li key={s.key} className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setChanges(s.changes)}
                            className="min-w-0 flex-1 cursor-pointer rounded-lg border border-line px-3 py-2 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <span className="flex items-center gap-2">
                              <span className={`text-lg font-semibold tabular-nums ${BAND[s.band].text}`}>{Math.round(s.after * 100)}</span>
                              <span className={`text-xs tabular-nums ${s.delta < 0 ? 'text-risk-low' : s.delta > 0 ? 'text-risk-high' : 'text-muted-fg'}`}>
                                {s.delta > 0 ? '+' : ''}
                                {Math.round(s.delta * 100)}
                              </span>
                              {i === 0 && saved.length > 1 && (
                                <span className="ml-auto rounded bg-risk-low-soft px-1.5 py-0.5 text-xs font-medium text-risk-low">คะแนนต่ำสุด</span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-fg">{describe(s.changes)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSaved((all) => all.filter((x) => x.key !== s.key))}
                            aria-label="ลบผลที่บันทึกนี้"
                            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-fg transition-colors hover:bg-muted hover:text-fg"
                          >
                            <Icon name="error" className="size-4" />
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {/* หมายเหตุทั้งหมดรวมไว้ท้ายช่อง (DE-18: ผล WFH มาจากสูตรประมาณ ระยะทาง × วันเข้าออฟฟิศ / 5) */}
              <div className="space-y-1.5 border-t border-line pt-3">
                {result.warning && <UncalibratedNote detail={result.warning} />}
                {'OfficeDaysPerWeek' in result.changes_applied && (
                  <p className="text-xs text-muted-fg">ผลของ WFH ประมาณจากระยะเดินทางที่ลดลง โมเดลไม่ได้เรียนเรื่อง WFH โดยตรง</p>
                )}
                <p className="text-xs text-muted-fg">{result.note}</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* มือถือ: แถบคะแนนติดขอบล่าง เลื่อนไปปรับค่าแล้วยังเห็นผล */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div>
            <div className="text-xs text-muted-fg">{nChanged ? 'หลังปรับ' : 'คะแนนตอนนี้'}</div>
            <div className={`text-2xl font-semibold leading-none tabular-nums ${BAND[result.after.risk_band].text}`}>
              <CountUp value={afterScore * 100} />
            </div>
          </div>
          <DeltaBadge delta={delta} idle={!nChanged} className="flex-1 py-2" />
        </div>
      </div>
    </div>
  )
}
