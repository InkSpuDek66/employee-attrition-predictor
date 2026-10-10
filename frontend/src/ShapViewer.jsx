import { useEffect, useState } from 'react'
import { featureLabel, featurePhrase, featureValue } from './featureLabels'
import { api, baht, bandOf, friendly } from './theme'
import { NotFoundState, SorryState } from './mascot/Mascot'
import { EmptyPicker } from './Overview'
import { Alert, Card, Icon, RiskGauge, Segmented, Skeleton } from './ui'

const TOP_N = [5, 10, 15, 20].map((n) => [n, `${n}`])

function Driver({ tone, title, row, count }) {
  const up = tone === 'up'
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className={`flex items-center gap-2 text-sm font-medium ${up ? 'text-risk-high' : 'text-accent'}`}>
        <span className={`grid size-7 place-items-center rounded-md ${up ? 'bg-risk-high-soft' : 'bg-accent-soft'}`}>
          <Icon name={up ? 'up' : 'down'} className="size-4" />
        </span>
        {title}
      </div>
      <div className="mt-3 text-lg font-semibold text-fg">{row?.label ?? 'ไม่มี'}</div>
      <div className="text-sm text-muted-fg">{row ? row.phrase : '—'}</div>
      <div className="mt-3 text-xs text-muted-fg">ทั้งหมด {count} ปัจจัยในรายการ</div>
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
              {band === 'Low' ? 'แม้ความเสี่ยงต่ำ แต่สิ่งที่ควรจับตาคือ ' : 'สาเหตุหลักที่ทำให้คนนี้เสี่ยงลาออกคือ '}
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
function ShapBars({ rows, maxAbs }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const up = r.shap_value > 0
        const width = `${(Math.abs(r.shap_value) / maxAbs) * 50}%`
        return (
          <li
            key={r.feature}
            title={`${r.label}: ${r.shown} · ผลกระทบ (SHAP) ${r.shap_value.toFixed(3)}`}
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
                {up ? 'ดันให้เสี่ยงลาออกมากขึ้น' : 'ดันให้อยู่ต่อ'} ผลกระทบ {Math.abs(r.shap_value).toFixed(2)}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function ShapViewer({ query, rate, who, onRisk, onDone, onPick }) {
  const [topN, setTopN] = useState(10)
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
        onRisk({ id: query.id, band: bandOf(score), score, label: 'คะแนน' })
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
    if (c.feature === 'MonthlyIncome') return baht(c.value * rate)
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
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <RiskGauge title={`ความเสี่ยงที่จะลาออก · พนักงาน #${query.id}`} score={score} />
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-fg">
            <Icon name="info" className="size-4 shrink-0" />
            คะแนนใช้เทียบว่าใครเสี่ยงกว่าใคร ไม่ใช่โอกาสลาออกจริง
          </p>
        </Card>
        <Driver tone="up" title="ปัจจัยที่ดันให้เสี่ยงมากที่สุด" row={ups[0]} count={ups.length} />
        <Driver tone="down" title="ปัจจัยที่ช่วยให้อยู่ต่อมากที่สุด" row={downs[0]} count={downs.length} />
      </div>

      <Summary ups={ups} downs={downs} band={bandOf(score)} />
      {data.warning && <Alert tone="warning">{data.warning}</Alert>}

      <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card
          icon="chart"
          title="ปัจจัยที่ส่งผลมากที่สุด"
          subtitle="แท่งยิ่งยาว ยิ่งมีผลกับคะแนนมาก"
          action={
            <div className="w-44">
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

        <Card icon="list" title="รายละเอียดแต่ละปัจจัย" subtitle="ค่าจริงของพนักงานและทิศทางที่ส่งผล">
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
                          <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-fg">{NOT_A_REASON[r.kind]}</span>
                        )}
                        {up && r.recommendation && <div className="mt-0.5 text-xs text-muted-fg">{r.recommendation}</div>}
                        <div className="mt-1 h-1 w-full max-w-40 rounded-full bg-muted">
                          <div
                            className={`bar-grow h-full rounded-full ${up ? 'bg-up' : 'bg-down'}`}
                            style={{ width: `${(Math.abs(r.shap_value) / maxAbs) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-muted-fg">{r.shown}</td>
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
        </Card>
      </div>
    </div>
  )
}
