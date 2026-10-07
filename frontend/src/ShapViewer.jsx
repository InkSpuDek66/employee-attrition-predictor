import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { featureLabel, featureValue } from './featureLabels'
import { api, baht, CHART, friendly } from './theme'
import { Alert, Card, EmptyState, Icon, RiskGauge, Segmented, Skeleton } from './ui'

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
      <div className="text-sm text-muted-fg">{row ? `ค่าของพนักงาน: ${row.shown}` : '—'}</div>
      <div className="mt-3 text-xs text-muted-fg">ทั้งหมด {count} ปัจจัยในรายการ</div>
    </div>
  )
}

export default function ShapViewer({ query, rate, dark }) {
  const C = CHART[dark ? 'dark' : 'light']
  const [topN, setTopN] = useState(10)
  // ผลล่าสุดผูกกับ key ของคำขอ ถ้า key ไม่ตรงกับที่ขออยู่ = กำลังโหลด (ข้อมูลเก่ายังโชว์แบบจางๆ)
  const [res, setRes] = useState({ key: null })
  const key = query && `${query.n}|${topN}`

  useEffect(() => {
    if (!query) return
    const ctrl = new AbortController()
    const params = new URLSearchParams({ top_n: topN })
    if (query.tenant) params.set('tenant_id', query.tenant)
    api(`/shap/${query.id}?${params}`, { signal: ctrl.signal }).then(
      (data) => setRes({ key, data }),
      (err) => err.name !== 'AbortError' && setRes({ key, error: friendly(err) }),
    )
    return () => ctrl.abort()
  }, [query, topN, key])

  const loading = query && res.key !== key
  const { data, error } = res

  if (!query) {
    return (
      <EmptyState icon="search" title="เลือกพนักงานเพื่อเริ่ม">
        ใส่รหัสพนักงานด้านบนแล้วกด “โหลด” ระบบจะแสดงคะแนนความเสี่ยงและปัจจัยที่ทำให้คนนี้เสี่ยงลาออก
      </EmptyState>
    )
  }
  if (error && !loading) return <Alert>{error}</Alert>
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
  const rows = data.contributions.map((c) => ({ ...c, label: featureLabel(c.feature), shown: c.feature === 'MonthlyIncome' ? baht(c.value * rate) : featureValue(c.feature, c.value) }))
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.shap_value)), 1e-9)
  const ups = rows.filter((r) => r.shap_value > 0)
  const downs = rows.filter((r) => r.shap_value <= 0)

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
              <span className="size-2.5 rounded-sm" style={{ background: C.up }} />
              ดันให้เสี่ยงลาออกมากขึ้น
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="down" className="size-3.5 text-accent" />
              <span className="size-2.5 rounded-sm" style={{ background: C.down }} />
              ดันให้อยู่ต่อ
            </span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={window.innerWidth < 600 ? 120 : 200}
                tick={{ fontSize: 12, fill: C.label }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine x={0} stroke={C.grid} />
              <Tooltip
                cursor={{ fill: C.hover }}
                contentStyle={{ borderRadius: 8, border: `1px solid ${C.grid}`, background: C.bg, color: C.label, fontSize: 13 }}
                itemStyle={{ color: C.label }}
                formatter={(v) => [v.toFixed(3), 'ผลกระทบ (SHAP)']}
                labelFormatter={(l, p) => `${l}: ${p?.[0]?.payload.shown ?? ''}`}
              />
              <Bar dataKey="shap_value" isAnimationActive={false} radius={4} barSize={16}>
                {rows.map((r) => <Cell key={r.feature} fill={r.shap_value > 0 ? C.up : C.down} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
                        <div className="mt-1 h-1 w-full max-w-40 rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${up ? 'bg-up' : 'bg-down'}`}
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
