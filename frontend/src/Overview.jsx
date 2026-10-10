// ภาพรวมบริษัท (README 6.6) + รายชื่อพนักงานเสี่ยงสูงสุดให้กดเลือก ไม่ต้องรู้รหัสก่อน
// ใช้ /company-summary, /company-summary/departments, /company-summary/top-employees (คะแนนยังไม่ปรับเทียบ ใช้จัดลำดับ)
import { useEffect, useState } from 'react'
import { featureLabel } from './featureLabels'
import { AssistantHint, SorryState } from './Mascot'
import { api, baht, BAND, friendly } from './theme'
import { Card, Icon, Segmented, Skeleton } from './ui'

// โหลดหลาย endpoint พร้อมกัน ผลผูกกับ key ของคำขอ (key ไม่ตรง = กำลังโหลด) เลี่ยง setState ตรงๆ ใน effect
function useApi(paths) {
  const key = paths.join('|')
  const [res, setRes] = useState({ key: null })
  useEffect(() => {
    const ctrl = new AbortController()
    Promise.all(key.split('|').map((p) => api(p, { signal: ctrl.signal }))).then(
      (data) => setRes({ key, data }),
      (err) => err.name !== 'AbortError' && setRes({ key, error: friendly(err) }),
    )
    return () => ctrl.abort()
  }, [key])
  return { loading: res.key !== key, data: res.data, error: res.error }
}

const shownScore = (e) => e.calibrated_risk_score ?? e.risk_score
// บริษัทมาจากผู้ใช้ที่ login (backend อ่านจาก token) บริษัทที่ปรับเทียบแล้วได้คะแนนปรับเทียบอัตโนมัติ
const topQuery = (n, department) => new URLSearchParams({ n, ...(department && { department }) })

// ดาวน์โหลดรายชื่อเสี่ยงสูงเป็น CSV (เปิดใน Excel ภาษาไทยได้ เพราะใส่ BOM) ไว้ใช้ในประชุม/ส่งหัวหน้าแผนก
async function downloadCsv(department) {
  const { employees } = await api(`/company-summary/top-employees?${topQuery(100, department)}`)
  const header = ['อันดับ', 'รหัสพนักงาน', 'คะแนนความเสี่ยง', 'ระดับ', 'แผนก', 'ตำแหน่ง', 'ระดับตำแหน่ง']
  const rows = employees.map((e, i) => [i + 1, e.employee_id, Math.round(shownScore(e) * 100), e.risk_band_th, e.department, e.job_role, e.job_level])
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `top-risk-${department || 'all'}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

export function CsvButton({ department }) {
  const [state, setState] = useState('') // '' | 'busy' | ข้อความ error
  async function go() {
    setState('busy')
    try {
      await downloadCsv(department)
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
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-wait disabled:opacity-60"
    >
      <Icon name="down" className="size-4" />
      {state === 'busy' ? 'กำลังเตรียม…' : state ? 'ลองใหม่' : 'CSV'}
    </button>
  )
}

// รายชื่อพนักงานเสี่ยงสูงสุด กดแถวแล้วไปดูรายละเอียดคนนั้น (คะแนนปรับเทียบถ้ามี ตรงกับหน้า SHAP/What-if)
export function TopRiskList({ n = 10, department = '', onPick, compact = false }) {
  const q = topQuery(n, department)
  const { loading, data, error } = useApi([`/company-summary/top-employees?${q}`])
  if (error) return <p className="text-sm text-risk-high">{error}</p>
  if (loading) return <Skeleton className={compact ? 'h-40' : 'h-80'} />
  return (
    <ul className="divide-y divide-line">
      {data[0].employees.map((e, i) => {
        const b = BAND[e.risk_band]
        return (
          <li key={e.employee_id}>
            <button
              type="button"
              onClick={() => onPick(e.employee_id)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span className="w-5 text-right text-xs tabular-nums text-muted-fg">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">พนักงาน #{e.employee_id}</span>
                {!compact && (
                  <span className="block truncate text-xs text-muted-fg">
                    {e.job_role} · {e.department} · ระดับ {e.job_level}
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
  )
}

// หน้าว่าง: ผู้ช่วยบอกวิธีใช้ + รายชื่อเสี่ยงสูงสุดให้กดเลือกได้เลย ไม่ต้องรู้รหัส
export function EmptyPicker({ who, title, children, onPick }) {
  return (
    <div className="space-y-4">
      <AssistantHint who={who} title={title}>
        {children}
      </AssistantHint>
      <Card icon="user" title="หรือเลือกจากพนักงานเสี่ยงสูงสุด" subtitle="กดที่แถวเพื่อเริ่มได้เลย">
        <TopRiskList n={5} onPick={onPick} />
      </Card>
    </div>
  )
}

function Kpi({ label, value, sub, tone = 'text-fg', small = false }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="text-xs font-medium text-muted-fg">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${small ? 'text-2xl' : 'text-3xl'} ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-fg">{sub}</div>}
    </div>
  )
}

// แถบสัดส่วน ต่ำ/กลาง/สูง พร้อมจำนวนคน (ไม่ใช้สีอย่างเดียว มีตัวเลขกำกับ)
function BandBar({ bands, total }) {
  const order = [
    ['Low', 'bg-risk-low'],
    ['Medium', 'bg-risk-mid'],
    ['High', 'bg-risk-high'],
  ]
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {order.map(([k, c]) => (
          <div key={k} className={c} style={{ width: `${(bands[k] / total) * 100}%` }} title={`${BAND[k].th} ${bands[k]} คน`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-fg">
        {order.map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${c}`} />
            เสี่ยง{BAND[k].th} <b className="tabular-nums text-fg">{bands[k].toLocaleString()}</b> คน ({Math.round((bands[k] / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Overview({ rate, onPick }) {
  const [department, setDepartment] = useState('')
  const q = new URLSearchParams({ top_n: 5, ...(department && { department }) })
  const { loading, data, error } = useApi([`/company-summary?${q}`, '/company-summary/departments'])

  if (error) return <SorryState message={error} />
  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96 lg:col-span-2" />
      </div>
    )
  }

  const [s, { departments }] = data
  const highPct = Math.round((s.risk_bands.High / s.n_employees) * 100)
  const deptOptions = [['', 'ทั้งบริษัท'], ...departments.map((d) => [d.department, d.department])]
  const maxShare = Math.max(...s.top_factors.map((f) => f.share), 1e-9)

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <Segmented label="เลือกแผนก" options={deptOptions} value={department} onChange={setDepartment} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="พนักงานทั้งหมด" value={s.n_employees.toLocaleString()} sub={department || 'ทุกแผนก'} />
        <Kpi label="คะแนนความเสี่ยงเฉลี่ย" value={Math.round(s.mean_risk_score * 100)} sub="จาก 100" />
        <Kpi label="เสี่ยงสูง" value={`${s.risk_bands.High.toLocaleString()} คน`} sub={`${highPct}% ของพนักงาน`} tone="text-risk-high" />
        <Kpi small label="มูลค่าความเสี่ยงรวม" value={baht(s.expected_loss_total * rate)} sub="คะแนน × ต้นทุนหาคนแทน (ใช้เทียบ ไม่ใช่ยอดจริง)" />
      </div>

      <Card icon="chart" title="สัดส่วนระดับความเสี่ยง">
        <BandBar bands={s.risk_bands} total={s.n_employees} />
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card
          icon="user"
          title="พนักงานเสี่ยงสูงสุด 10 คน"
          subtitle="กดที่แถวเพื่อดูว่าทำไมถึงเสี่ยง"
          action={<CsvButton department={department} />}
        >
          <TopRiskList department={department} onPick={onPick} />
        </Card>

        <Card icon="list" title="ปัจจัยที่ทำให้เสี่ยงมากที่สุด" subtitle="ค่าเฉลี่ยผลกระทบ (SHAP) ของทั้งกลุ่ม">
          <ul className="space-y-4">
            {s.top_factors.map((f) => (
              <li key={f.feature}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-fg">{featureLabel(f.feature)}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        f.actionable ? 'bg-accent-soft text-accent' : 'bg-muted text-muted-fg'
                      }`}
                    >
                      {f.actionable ? 'บริษัทปรับได้' : 'ปรับไม่ได้'}
                    </span>
                    <span className="tabular-nums text-muted-fg">{Math.round(f.share * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(f.share / maxShare) * 100}%` }} />
                </div>
                {f.recommendation && <p className="mt-1.5 text-xs text-muted-fg">{f.recommendation}</p>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card icon="money" title="แยกตามแผนก" subtitle="เรียงตามมูลค่าความเสี่ยงรวม กดที่แผนกเพื่อกรอง">
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
                <th className="px-5 py-2 sm:px-6">แผนก</th>
                <th className="px-2 py-2 text-right">พนักงาน</th>
                <th className="px-2 py-2 text-right">เสี่ยงสูง</th>
                <th className="px-2 py-2 text-right">คะแนนเฉลี่ย</th>
                <th className="px-5 py-2 text-right sm:px-6">มูลค่าความเสี่ยงรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {departments.map((d) => (
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
                      className="cursor-pointer rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      {d.department}
                    </button>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{d.n_employees.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-risk-high">{d.risk_bands.High}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{Math.round(d.mean_risk_score * 100)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums sm:px-6">{baht(d.expected_loss_total * rate)}</td>
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
