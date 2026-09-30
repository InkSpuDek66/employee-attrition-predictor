import { useEffect, useState } from 'react'
import { featureLabel } from './featureLabels'

// ฟีเจอร์ที่ HR ปรับได้จริงผ่านมาตรการ (ไม่ใส่ข้อมูลส่วนตัว เช่น อายุ เพศ สถานภาพ)
const SAT = [[1, 'ต่ำ'], [2, 'ปานกลาง'], [3, 'สูง'], [4, 'สูงมาก']]
const CONTROLS = [
  { field: 'MonthlyIncome', type: 'range', min: 1000, max: 20000, step: 100 },
  { field: 'PercentSalaryHike', type: 'range', min: 0, max: 30, step: 1 },
  { field: 'OverTime', type: 'select', options: [['No', 'ไม่ทำ'], ['Yes', 'ทำ']] },
  {
    field: 'BusinessTravel',
    type: 'select',
    options: [['Non-Travel', 'ไม่เดินทาง'], ['Travel_Rarely', 'นานๆ ครั้ง'], ['Travel_Frequently', 'บ่อย']],
  },
  { field: 'DistanceFromHome', type: 'range', min: 1, max: 30, step: 1 },
  { field: 'JobLevel', type: 'select', options: [1, 2, 3, 4, 5].map((v) => [v, `ระดับ ${v}`]) },
  { field: 'YearsSinceLastPromotion', type: 'range', min: 0, max: 15, step: 1 },
  { field: 'TrainingTimesLastYear', type: 'range', min: 0, max: 6, step: 1 },
  { field: 'StockOptionLevel', type: 'select', options: [[0, 'ไม่มีสิทธิ์'], [1, 'ระดับ 1'], [2, 'ระดับ 2'], [3, 'ระดับ 3']] },
  { field: 'WorkLifeBalance', type: 'select', options: [[1, 'แย่'], [2, 'พอใช้'], [3, 'ดี'], [4, 'ดีมาก']] },
  { field: 'JobSatisfaction', type: 'select', options: SAT },
  { field: 'EnvironmentSatisfaction', type: 'select', options: SAT },
  { field: 'RelationshipSatisfaction', type: 'select', options: SAT },
  { field: 'JobInvolvement', type: 'select', options: SAT },
]
const BAND_COLOR = { High: 'var(--bad)', Medium: 'var(--warn)', Low: 'var(--ok)' }
const money = (v) => Math.round(v).toLocaleString()

async function api(path, options) {
  const res = await fetch(`/api${path}`, options)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `เรียก API ไม่สำเร็จ (${res.status})`)
  return body
}

function friendly(err) {
  return err.message === 'Failed to fetch' ? 'ติดต่อ backend ไม่ได้ — เปิด uvicorn ที่ port 8000 หรือยัง' : err.message
}

function ScoreBox({ title, score }) {
  const value = score.calibrated_risk_score ?? score.risk_score
  return (
    <div>
      <div className="muted">{title}</div>
      <div className="level" style={{ color: BAND_COLOR[score.risk_band] }}>{score.risk_band_th}</div>
      <div className="muted">{Math.round(value * 100)} / 100</div>
    </div>
  )
}

export default function WhatIfSimulator() {
  const [employeeId, setEmployeeId] = useState('1')
  const [tenantId, setTenantId] = useState('')
  const [loaded, setLoaded] = useState(null) // { id, tenant, base } ของพนักงานที่โหลดแล้ว
  const [changes, setChanges] = useState({})
  const [result, setResult] = useState(null)
  const [impact, setImpact] = useState(null)
  const [retention, setRetention] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const body = { employee_id: Number(employeeId), changes: {}, ...(tenantId && { tenant_id: tenantId }) }
      const res = await api('/whatif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setLoaded({ id: Number(employeeId), tenant: tenantId, base: res.employee })
      setChanges({})
      setResult(res)
      setRetention('')
    } catch (err) {
      setLoaded(null)
      setResult(null)
      setError(friendly(err))
    } finally {
      setLoading(false)
    }
  }

  // ปรับค่าแล้วคำนวณใหม่อัตโนมัติ (หน่วง 300ms ระหว่างลากแถบเลื่อน)
  useEffect(() => {
    if (!loaded) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const body = { employee_id: loaded.id, changes, ...(loaded.tenant && { tenant_id: loaded.tenant }) }
        const res = await api('/whatif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        })
        setResult(res)
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
    if (!loaded) return
    const params = new URLSearchParams()
    if (retention) params.set('retention', retention)
    if (loaded.tenant) params.set('tenant_id', loaded.tenant)
    api(`/financial-impact/${loaded.id}?${params}`).then(setImpact, (err) => setError(friendly(err)))
  }, [loaded, retention])

  function setValue(field, raw) {
    const value = typeof loaded.base[field] === 'number' ? Number(raw) : raw
    setChanges((c) => {
      const next = { ...c, [field]: value }
      if (loaded.base[field] === value) delete next[field]
      return next
    })
  }

  const current = (field) => changes[field] ?? loaded.base[field]
  const delta = result?.delta ?? 0
  const afterScore = result && (result.after.calibrated_risk_score ?? result.after.risk_score)

  return (
    <section className="card">
      <h2>What-if Simulator — ถ้าปรับเงื่อนไขแล้วความเสี่ยงจะเปลี่ยนไหม</h2>

      <form onSubmit={load} className="controls">
        <label>
          รหัสพนักงาน
          <input type="number" min="1" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        </label>
        <label>
          รหัสบริษัท (ถ้าปรับเทียบแล้ว)
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="ไม่ระบุก็ได้" />
        </label>
        <button disabled={loading}>{loading ? 'กำลังโหลด…' : 'โหลดพนักงาน'}</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {loaded && result && (
        <>
          <div className="summary">
            <ScoreBox title="ก่อนปรับ" score={result.before} />
            <ScoreBox title="หลังปรับ" score={result.after} />
            <div>
              <div className="muted">เปลี่ยนไป</div>
              <div className="score" style={{ color: delta < 0 ? 'var(--ok)' : delta > 0 ? 'var(--bad)' : 'inherit' }}>
                {delta > 0 ? '+' : ''}{Math.round(delta * 100)}
              </div>
            </div>
          </div>
          {result.warning && <p className="warning">⚠ {result.warning}</p>}

          <h3>ปรับเงื่อนไข</h3>
          <div className="whatif-grid">
            {CONTROLS.map(({ field, type, options, ...range }) => (
              <label key={field} className={field in changes ? 'changed' : undefined}>
                <span>
                  {featureLabel(field)}
                  {type === 'range' && <strong> {current(field).toLocaleString()}</strong>}
                </span>
                {type === 'range' ? (
                  <input type="range" {...range} value={current(field)} onChange={(e) => setValue(field, e.target.value)} />
                ) : (
                  <select value={current(field)} onChange={(e) => setValue(field, e.target.value)}>
                    {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                  </select>
                )}
              </label>
            ))}
          </div>
          <button type="button" className="secondary" onClick={() => setChanges({})} disabled={!Object.keys(changes).length}>
            กลับเป็นค่าเดิม
          </button>

          {impact && (
            <>
              <h3>ต้นทุน Retain vs Replace (ประมาณการ)</h3>
              <div className="controls">
                <label>
                  มาตรการรักษาคน
                  <select value={impact.retention} onChange={(e) => setRetention(e.target.value)}>
                    {Object.entries(impact.retention_options).map(([k, text]) => <option key={k} value={k}>{text}</option>)}
                  </select>
                </label>
              </div>
              <table>
                <tbody>
                  <tr><td>ต้นทุนถ้าต้องหาคนแทน (สรรหา + ฝึกอบรม)</td><td>{money(impact.replacement_cost)}</td></tr>
                  <tr><td>ต้นทุนมาตรการ: {impact.retention_label}</td><td>{money(impact.retain_cost)}</td></tr>
                  <tr><td>ส่วนต่างถ้ารักษาไว้ได้</td><td>{money(impact.net_benefit_if_retained)}</td></tr>
                  <tr>
                    <td>มูลค่าความเสี่ยง (คะแนน × ต้นทุนหาคนแทน) ก่อน → หลังปรับ</td>
                    <td>{money(impact.expected_loss)} → {money(afterScore * impact.replacement_cost)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="muted small">
                {impact.currency_note}
                {!impact.include_severance && ' · ไม่นับค่าชดเชยตามมาตรา 118 เพราะจ่ายเมื่อนายจ้างเลิกจ้าง ไม่ใช่เมื่อลาออกเอง'}
              </p>
            </>
          )}
          <p className="muted small">{result.note}</p>
        </>
      )}
    </section>
  )
}
