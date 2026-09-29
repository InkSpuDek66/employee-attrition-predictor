import { useState } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { featureLabel, featureValue } from './featureLabels'

// ponytail: เกณฑ์ระดับเดียวกับ src/test_app.py เป็นค่าประมาณ ปรับเมื่อทีมตกลง threshold
const LOW = 0.3
const HIGH = 0.6
const UP = '#d64545' // ดันไปทางลาออก
const DOWN = '#3b7dd8' // ดันไปทางอยู่ต่อ

function riskLevel(score) {
  if (score < LOW) return { text: 'ต่ำ', color: 'var(--ok)' }
  if (score < HIGH) return { text: 'ปานกลาง', color: 'var(--warn)' }
  return { text: 'สูง', color: 'var(--bad)' }
}

export default function ShapViewer() {
  const [employeeId, setEmployeeId] = useState('1')
  const [tenantId, setTenantId] = useState('')
  const [topN, setTopN] = useState(10)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ top_n: topN })
    if (tenantId) params.set('tenant_id', tenantId)
    try {
      const res = await fetch(`/api/shap/${encodeURIComponent(employeeId)}?${params}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `เรียก API ไม่สำเร็จ (${res.status})`)
      setData(body)
    } catch (err) {
      setData(null)
      setError(err.message === 'Failed to fetch' ? 'ติดต่อ backend ไม่ได้ — เปิด uvicorn ที่ port 8000 หรือยัง' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const score = data && (data.calibrated_risk_score ?? data.risk_score)
  const level = data && riskLevel(score)
  // เรียงจากผลกระทบมากไปน้อย (API เรียงให้แล้ว) กราฟแนวนอนแสดงตัวบนสุดก่อน
  const rows =
    data?.contributions.map((c) => ({ ...c, label: featureLabel(c.feature), shown: featureValue(c.feature, c.value) })) ?? []

  return (
    <section className="card">
      <h2>SHAP Viewer — ทำไมพนักงานคนนี้ถึงเสี่ยง</h2>

      <form onSubmit={load} className="controls">
        <label>
          รหัสพนักงาน
          <input type="number" min="1" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        </label>
        <label>
          รหัสบริษัท (ถ้าปรับเทียบแล้ว)
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="ไม่ระบุก็ได้" />
        </label>
        <label>
          แสดงกี่ปัจจัย
          <input type="number" min="1" max="30" value={topN} onChange={(e) => setTopN(e.target.value)} />
        </label>
        <button disabled={loading}>{loading ? 'กำลังโหลด…' : 'ดูผล'}</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {data && (
        <>
          <div className="summary">
            <div>
              <div className="muted">ระดับความเสี่ยงที่จะลาออก</div>
              <div className="level" style={{ color: level.color }}>{level.text}</div>
            </div>
            <div>
              <div className="muted">คะแนนความเสี่ยง</div>
              <div className="score">{Math.round(score * 100)} / 100</div>
            </div>
          </div>
          <p className="muted small">
            คะแนนใช้เทียบว่าใครเสี่ยงกว่าใคร ไม่ใช่โอกาสลาออกจริง (เกณฑ์ประมาณ: ต่ำ &lt; {LOW * 100}, สูง &gt; {HIGH * 100})
          </p>
          {data.warning && <p className="warning">⚠ {data.warning}</p>}

          <h3>ปัจจัยที่ส่งผลมากที่สุด</h3>
          <p className="legend">
            <span style={{ color: UP }}>■</span> ดันให้เสี่ยงลาออกมากขึ้น &nbsp;
            <span style={{ color: DOWN }}>■</span> ดันให้อยู่ต่อ
          </p>
          <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 34)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="label" width={window.innerWidth < 600 ? 130 : 210} tick={{ fontSize: 13 }} />
              <ReferenceLine x={0} stroke="var(--muted)" />
              <Tooltip
                formatter={(v) => [v.toFixed(3), 'ผลกระทบ (SHAP)']}
                labelFormatter={(l, p) => `${l}: ${p?.[0]?.payload.shown ?? ''}`}
              />
              <Bar dataKey="shap_value" isAnimationActive={false}>
                {rows.map((r) => <Cell key={r.feature} fill={r.shap_value > 0 ? UP : DOWN} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <table>
            <thead>
              <tr><th>ปัจจัย</th><th>ค่าของพนักงาน</th><th>ผล</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature}>
                  <td>{r.label}</td>
                  <td>{r.shown}</td>
                  <td style={{ color: r.shap_value > 0 ? UP : DOWN }}>
                    {r.shap_value > 0 ? 'เพิ่มความเสี่ยง' : 'ลดความเสี่ยง'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">SHAP บอกความสัมพันธ์กับโมเดล ไม่ใช่เหตุและผลที่พิสูจน์แล้ว</p>
        </>
      )}
    </section>
  )
}
