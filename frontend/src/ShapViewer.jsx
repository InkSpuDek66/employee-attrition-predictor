import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { featureLabel, featurePhrase, featureValue } from './featureLabels'
import Logo from '../logo/Logo'
import { api, baht, bandOf, employeeLabel, friendly, loadSession, useApi } from './theme'
import { NotFoundState, SorryState } from './mascot/Mascot'
import { EmptyPicker } from './Overview'
import { Card, Icon, RiskGauge, Segmented, Skeleton, UncalibratedNote } from './ui'

const TOP_N = [5, 10, 15, 20].map((n) => [n, `${n}`])

function Driver({ tone, title, row, count, topN }) {
  const up = tone === 'up'
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className={`flex items-center gap-2 text-sm font-medium ${up ? 'text-risk-high' : 'text-accent'}`}>
        <span className={`grid size-7 place-items-center rounded-md ${up ? 'bg-risk-high-soft' : 'bg-accent-soft'}`}>
          <Icon name={up ? 'up' : 'down'} className="size-4" />
        </span>
        {title}
      </div>
      <div className="mt-3 text-lg font-semibold text-fg">{row?.label ?? `ไม่มีใน ${topN} ปัจจัยหลัก`}</div>
      <div className="text-sm text-muted-fg">{row ? row.phrase : 'เพิ่มจำนวนปัจจัยที่แสดงในกราฟด้านล่างเพื่อดูเพิ่ม'}</div>
      {row && <div className="mt-3 text-xs text-muted-fg">ทั้งหมด {count} ปัจจัยใน {topN} อันดับแรก</div>}
    </div>
  )
}

// UX-06/07: ข้อมูลส่วนตัว (อายุ เพศ สถานภาพ) และตัวเลขที่ HR ตีความไม่ได้ (อัตราค่าจ้างรายวัน ฯลฯ) ไม่ยกเป็น "สาเหตุ"
// ยังแสดงในกราฟ/ตารางพร้อมป้ายกำกับ backend บอกชนิดมาใน kind (src/company_summary.py factor_kind)
const NOT_A_REASON = { personal: 'ข้อมูลส่วนตัว ห้ามใช้ตัดสินใจ', unexplained: 'ตีความไม่ได้' }
const isReason = (r) => !NOT_A_REASON[r.kind]

// DE-18: คนที่ WFH โมเดลใช้ระยะทางที่ปรับตามวันเข้าออฟฟิศ แสดงระยะทางจริงคู่กับค่าที่ใช้คิด
function commuteText(c, usedKm) {
  return `${c.distance_km.toLocaleString()} กม. (คิดตาม WFH ${c.office_days} วัน/สัปดาห์ เป็น ${usedKm.toLocaleString()} กม.)`
}

// สรุปเป็นประโยค อ่านง่ายกว่ากราฟ: 3 ปัจจัยที่ดันขึ้นมากสุด + 2 ปัจจัยที่ช่วยให้อยู่ต่อ
function Summary({ ups, downs, band }) {
  const list = (rows) => rows.map((r) => r.phrase).join(', ')
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-accent">
          <Icon name="info" className="size-5" />
        </div>
        <div className="space-y-1.5 text-sm leading-relaxed">
          <p className="font-semibold text-fg">สรุปสั้นๆ</p>
          {ups.length > 0 && (
            <p className="text-fg">
              {band === 'Low' ? 'แม้ความเสี่ยงต่ำ แต่สิ่งที่ควรจับตาคือ ' : 'ปัจจัยที่ดันคะแนนความเสี่ยงของคนนี้ขึ้นมากที่สุดคือ '}
              <b>{list(ups.slice(0, 3))}</b>
            </p>
          )}
          {downs.length > 0 && (
            <p className="text-muted-fg">
              ส่วนสิ่งที่ช่วยให้อยู่ต่อคือ <b className="text-fg">{list(downs.slice(0, 2))}</b>
            </p>
          )}
          <p className="text-xs text-muted-fg">ไม่นับอายุ เพศ สถานภาพสมรส และตัวเลขที่ตีความไม่ได้เป็นเหตุผล (ยังดูได้ในตาราง)</p>
        </div>
      </div>
    </div>
  )
}

// กราฟแท่งแนวนอนแบบซ้าย/ขวาจากเส้นกลาง (ขวา = ดันให้เสี่ยง, ซ้าย = ดันให้อยู่ต่อ) วาดด้วย CSS ไม่ต้องโหลด library กราฟ
// ชี้ที่แถว = กล่องรายละเอียดเหนือแท่ง (ค่าจริง ทิศทาง อันดับ) แทนกล่องของเบราว์เซอร์ ข้อมูลเดียวกับตารางด้านข้าง
function ShapBars({ rows, maxAbs }) {
  const [hover, setHover] = useState(null)
  return (
    <ul className="space-y-1.5" onMouseLeave={() => setHover(null)}>
      {rows.map((r, i) => {
        const up = r.shap_value > 0
        const width = `${(Math.abs(r.shap_value) / maxAbs) * 50}%`
        return (
          <li
            key={r.feature}
            onMouseEnter={() => setHover(r.feature)}
            className="grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-md px-1 py-1 transition-colors duration-150 hover:bg-muted sm:grid-cols-[12.5rem_1fr]"
          >
            <span className="truncate text-right text-xs text-fg sm:text-sm">{r.label}</span>
            <span className="relative block h-4">
              <span className="absolute inset-y-[-4px] left-1/2 w-px bg-line" aria-hidden="true" />
              <span
                className={`bar-grow absolute inset-y-0 rounded ${up ? 'bg-up' : 'bar-grow-r bg-down'}`}
                style={{ width, [up ? 'left' : 'right']: '50%' }}
                aria-hidden="true"
              />
              <span className="sr-only">
                {up ? 'ดันให้เสี่ยงลาออกมากขึ้น' : 'ดันให้อยู่ต่อ'} อันดับ {i + 1} จาก {rows.length}
              </span>
              {hover === r.feature && (
                <span
                  className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-56 -translate-x-1/2 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-md"
                  style={{ left: `calc(50% ${up ? '+' : '-'} ${(Math.abs(r.shap_value) / maxAbs) * 25}%)` }}
                  aria-hidden="true"
                >
                  <span className="block font-medium text-fg">{r.label}</span>
                  <span className="block tabular-nums text-fg">{r.shown}</span>
                  <span className={`flex items-center gap-1 ${up ? 'text-risk-high' : 'text-accent'}`}>
                    <Icon name={up ? 'up' : 'down'} className="size-3.5" />
                    {up ? 'ดันให้เสี่ยงขึ้น' : 'ช่วยให้อยู่ต่อ'}
                    <span className="text-muted-fg">· อันดับ {i + 1} จาก {rows.length}</span>
                  </span>
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// พิมพ์/บันทึก PDF ด้วยหน้าต่างพิมพ์ของเบราว์เซอร์ ไม่ต้องลง library
// โหมดมืดสลับเป็นสว่างชั่วคราวตอนพิมพ์ (กระดาษพื้นขาว) window.print() รอจนปิดหน้าต่างพิมพ์ แล้วค่อยคืนค่า
// setPrintedAt: ใส่วันที่ลงหัวรายงานก่อนเปิดหน้าต่างพิมพ์ (flushSync = render ให้เสร็จก่อน print)
function printReport(setPrintedAt) {
  flushSync(() => setPrintedAt(new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })))
  const html = document.documentElement
  const dark = html.classList.contains('dark')
  html.classList.remove('dark')
  window.print()
  html.classList.toggle('dark', dark)
}

// หัวรายงาน แสดงเฉพาะตอนพิมพ์ (บนจอมีหัวหน้าเว็บอยู่แล้ว)
function PrintHeader({ id, name, printedAt }) {
  const user = loadSession()?.user
  return (
    <div className="hidden items-center gap-3 border-b border-line pb-4 print:flex">
      <Logo className="size-12" />
      <div className="flex-1">
        <div className="text-lg font-semibold text-fg">รายงานความเสี่ยงการลาออก · {employeeLabel(id, name)}</div>
        <div className="text-sm text-muted-fg">
          {user?.tenant_name ?? user?.tenant_id} · พิมพ์เมื่อ {printedAt}
          {user?.name && ` · โดย ${user.name}`}
        </div>
      </div>
    </div>
  )
}

export default function ShapViewer({ query, who, onRisk, onDone, onPick, onTab }) {
  const [topN, setTopN] = useState(10)
  const [printedAt, setPrintedAt] = useState('')
  // ค่าเฉลี่ยทั้งบริษัท (คะแนนชุดเดียวกับคนนี้: ปรับเทียบแล้วถ้าบริษัทปรับเทียบ) โหลดไม่ได้ = ไม่แสดงขีด
  const company = useApi(['/company-summary?top_n=1']).data?.[0]
  // ผลล่าสุดผูกกับ key ของคำขอ ถ้า key ไม่ตรงกับที่ขออยู่ = กำลังโหลด (ข้อมูลเก่ายังโชว์แบบจางๆ)
  const [res, setRes] = useState({ key: null })
  const key = query && `${query.n}|${topN}`

  useEffect(() => {
    if (!query) return
    const ctrl = new AbortController()
    const params = new URLSearchParams({ top_n: topN })
    api(`/shap/${query.id}?${params}`, { signal: ctrl.signal }).then(
      (data) => {
        setRes({ key, data })
        onDone()
        const score = data.calibrated_risk_score ?? data.risk_score
        onRisk({ id: query.id, name: data.name, band: bandOf(score), score, label: 'คะแนน' })
      },
      (err) => {
        if (err.name === 'AbortError') return
        const notFound = err.status === 404
        setRes({ key, error: friendly(err), notFound })
        onDone()
        onRisk({ error: true, notFound })
      },
    )
    return () => ctrl.abort()
  }, [query, topN, key, onRisk, onDone])

  const loading = query && res.key !== key
  const { data, error, notFound } = res

  if (!query) {
    return (
      <EmptyPicker who={who} title="เลือกพนักงานเพื่อเริ่มได้เลย" onPick={onPick}>
        ใส่รหัสพนักงานด้านบนแล้วกด “โหลด” เดี๋ยวเราบอกคะแนนความเสี่ยงและปัจจัยที่ทำให้คนนี้เสี่ยงลาออกให้
      </EmptyPicker>
    )
  }
  if (error && !loading) return notFound ? <NotFoundState who={who} message={error} /> : <SorryState message={error} />
  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96 lg:col-span-3" />
      </div>
    )
  }

  const score = data.calibrated_risk_score ?? data.risk_score
  // เรียงจากผลกระทบมากไปน้อย (API เรียงให้แล้ว) กราฟแนวนอนแสดงตัวบนสุดก่อน
  const shownValue = (c) => {
    if (c.feature === 'MonthlyIncome') return baht(c.value) // บาทที่บริษัทกรอก (backend ส่งแทนค่าที่โมเดลเห็น)
    if (data.commute && c.feature === 'DistanceFromHome') return commuteText(data.commute, c.value)
    if (data.commute && c.feature === 'OverTimeXDistance' && c.value > 0) return commuteText(data.commute, c.value)
    return featureValue(c.feature, c.value)
  }
  const rows = data.contributions.map((c) => ({ ...c, label: featureLabel(c.feature), shown: shownValue(c) }))
    .map((r) => ({ ...r, phrase: featurePhrase(r.feature, r.value, r.shown) }))
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.shap_value)), 1e-9)
  const ups = rows.filter((r) => r.shap_value > 0 && isReason(r))
  const downs = rows.filter((r) => r.shap_value <= 0 && isReason(r))

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <PrintHeader id={query.id} name={data.name} printedAt={printedAt} />
      {/* แบบเดียวกับหน้า What-if: การ์ดคะแนน (รหัสพนักงาน) ล็อกอยู่ขวาตอนเลื่อนดูกราฟ/ตาราง จะได้ไม่ลืมว่ากำลังดูใคร
          มือถือ/ตอนพิมพ์: การ์ดคะแนนอยู่บนสุด */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem] print:block print:space-y-4">
        <aside className="lg:sticky lg:top-20 lg:order-last">
          <Card>
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-fg">ผลวิเคราะห์</div>
              <div className="font-semibold text-fg">{employeeLabel(query.id, data.name)}</div>
              {data.job_role && (
                <div className="text-xs text-muted-fg">
                  {data.job_role} · {data.department}
                </div>
              )}
            </div>
            <RiskGauge title="คะแนนความเสี่ยง (ใช้จัดลำดับ)" score={score} avg={company?.mean_risk_score} />
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-fg">
              <Icon name="info" className="size-4 shrink-0" />
              คะแนนใช้เทียบว่าใครเสี่ยงกว่าใคร ไม่ใช่โอกาสลาออกจริง
            </p>
            {/* อธิบายแล้วต่อด้วยการลงมือ: เปิดหน้าลองปรับของคนเดียวกัน (critique รอบ 9) */}
            <button
              type="button"
              onClick={() => onTab('whatif')}
              className="mt-4 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-action text-sm font-medium text-on-action transition-colors duration-200 hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 print:hidden"
            >
              <Icon name="sliders" className="size-4" />
              ลองปรับเงื่อนไขให้คนนี้
            </button>
            <button
              type="button"
              onClick={() => printReport(setPrintedAt)}
              className="mt-2 flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent print:hidden"
            >
              <Icon name="download" className="size-4" />
              พิมพ์ / บันทึก PDF
            </button>
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Driver tone="up" title="ปัจจัยที่ดันให้เสี่ยงมากที่สุด" row={ups[0]} count={ups.length} topN={topN} />
            <Driver tone="down" title="ปัจจัยที่ช่วยให้อยู่ต่อมากที่สุด" row={downs[0]} count={downs.length} topN={topN} />
          </div>

          <Summary ups={ups} downs={downs} band={bandOf(score)} />
          {data.warning && <UncalibratedNote detail={data.warning} />}

          <Card
            icon="chart"
            title="ปัจจัยที่ส่งผลมากที่สุด"
            subtitle="แท่งยิ่งยาว ยิ่งมีผลกับคะแนนมาก"
            action={
              <div className="w-44 print:hidden">
                <Segmented size="sm" label="จำนวนปัจจัย" options={TOP_N} value={topN} onChange={(v) => setTopN(Number(v))} />
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-fg">
              <span className="flex items-center gap-1.5">
                <Icon name="up" className="size-3.5 text-risk-high" />
                <span className="size-2.5 rounded-sm bg-up" />
                ดันให้เสี่ยงลาออกมากขึ้น
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="down" className="size-3.5 text-down" />
                <span className="size-2.5 rounded-sm bg-down" />
                ดันให้อยู่ต่อ
              </span>
            </div>
            <ShapBars key={query.n} rows={rows} maxAbs={maxAbs} />
          </Card>

          {/* ตารางเป็นปัจจัยชุดเดียวกับกราฟด้านบน (เดิมเปิดค้าง เห็นซ้ำสองรอบ) พับไว้ เปิดดูค่าจริงได้ */}
          <details className="group rounded-xl border border-line bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-fg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-6 [&::-webkit-details-marker]:hidden">
              <Icon name="list" className="size-4 text-accent" />
              ดูค่าจริงของแต่ละปัจจัย (ตาราง)
              <Icon name="down" className="ml-auto size-4 text-muted-fg transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="px-5 pb-5 sm:px-6">
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
                    <th className="px-5 py-2 sm:px-6">ปัจจัย</th>
                    <th className="px-2 py-2">ค่า</th>
                    <th className="px-5 py-2 text-right sm:px-6">ผล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const up = r.shap_value > 0
                    return (
                      <tr key={r.feature} className="transition-colors duration-150 hover:bg-canvas">
                        <td className="px-5 py-2.5 sm:px-6">
                          <div className="font-medium text-fg">{r.label}</div>
                          {NOT_A_REASON[r.kind] && (
                            <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-fg">{NOT_A_REASON[r.kind]}</span>
                          )}
                          {up && r.recommendation && <div className="mt-0.5 text-xs text-muted-fg">{r.recommendation}</div>}
                          <div className="mt-1 h-1 w-full max-w-40 rounded-full bg-muted">
                            <div
                              className={`bar-grow h-full rounded-full ${up ? 'bg-up' : 'bg-down'}`}
                              style={{ width: `${(Math.abs(r.shap_value) / maxAbs) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-muted-fg">{r.shown}</td>
                        <td className="px-5 py-2.5 text-right sm:px-6">
                          <span
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${
                              up ? 'bg-risk-high-soft text-risk-high' : 'bg-accent-soft text-accent'
                            }`}
                          >
                            <Icon name={up ? 'up' : 'down'} className="size-3.5" />
                            {up ? 'เพิ่มความเสี่ยง' : 'ลดความเสี่ยง'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-fg">SHAP บอกความสัมพันธ์กับโมเดล ไม่ใช่เหตุและผลที่พิสูจน์แล้ว</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
