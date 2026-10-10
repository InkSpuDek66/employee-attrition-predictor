// ปรับเทียบโมเดลกับข้อมูลลาออกจริงของบริษัท (README 6.5 Model Localization) เฉพาะผู้ดูแลระบบ
// ใช้ /recalibrate/template, /recalibrate/upload, /recalibrate/history, DELETE /recalibrate
// onChanged() = คะแนนทั้งระบบเปลี่ยน ให้หน้าอื่นโหลดใหม่
import { useState } from 'react'
import { api, friendly, postFile, useApi } from './theme'
import { Alert, Card, Icon, Segmented, Skeleton } from './ui'
import { CheckDetails, Count, DownloadButton, DropZone } from './Upload'

const METHODS = [
  ['platt', 'แบบเส้นตรง'],
  ['isotonic', 'แบบยืดหยุ่น'],
]
const METHOD_HINT = {
  platt: 'ปรับทั้งสเกลพร้อมกันแบบนุ่มนวล เหมาะกับข้อมูลน้อย (50–300 คน)',
  isotonic: 'ปรับตามข้อมูลจริงทีละช่วงคะแนน แม่นกว่าเมื่อมีข้อมูลหลายร้อยคนขึ้นไป แต่ข้อมูลน้อยจะแกว่ง',
}
const METHOD_TH = { platt: 'แบบเส้นตรง', isotonic: 'แบบยืดหยุ่น' }
const when = (iso) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const pct = (v) => `${Math.round(v * 100)}%`

function Status({ latest, onReset, resetting }) {
  if (!latest)
    return (
      <Alert tone="warning">
        ยังไม่ได้ปรับเทียบ คะแนนทุกหน้าตอนนี้มาจากโมเดลกลางที่เรียนจากข้อมูล IBM ใช้จัดลำดับว่าใครเสี่ยงกว่าใครได้ แต่ตัวเลขอาจไม่ตรงกับอัตราลาออกจริงของบริษัท
      </Alert>
    )
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-risk-low/20 bg-risk-low-soft px-4 py-3 text-sm text-risk-low">
      <Icon name="check" className="size-5 shrink-0" />
      <span className="flex-1">
        ปรับเทียบแล้วเมื่อ {when(latest.calibrated_at)} ด้วยข้อมูล {latest.n_samples.toLocaleString()} คน (ลาออกจริง {pct(latest.positive_rate)}) วิธี
        {METHOD_TH[latest.method] ?? latest.method} ทุกหน้าใช้คะแนนที่ปรับแล้ว
      </span>
      <button
        type="button"
        onClick={onReset}
        disabled={resetting}
        className="h-9 cursor-pointer rounded-lg border border-line bg-card px-3 font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-wait disabled:opacity-60"
      >
        {resetting ? 'กำลังยกเลิก…' : 'ยกเลิกการปรับเทียบ'}
      </button>
    </div>
  )
}

function Result({ r }) {
  const better = r.brier_before > 0 ? 1 - r.brier_after / r.brier_before : 0
  return (
    <Card icon="check" title="3. ปรับเทียบเสร็จแล้ว" subtitle="ทุกหน้า (ภาพรวม / SHAP / What-if) ใช้คะแนนที่ปรับแล้วตั้งแต่ตอนนี้">
      <div className="grid gap-3 sm:grid-cols-3">
        <Count label="พนักงานที่ใช้ปรับ" value={r.n_samples} />
        <div className="rounded-lg border border-line bg-canvas p-4">
          <div className="text-xs font-medium text-muted-fg">อัตราลาออกจริงของบริษัท</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-fg">{pct(r.positive_rate)}</div>
        </div>
        <div className="rounded-lg border border-line bg-canvas p-4">
          <div className="text-xs font-medium text-muted-fg">ความคลาดเคลื่อนของคะแนน (Brier)</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-fg">
            {r.brier_before.toFixed(3)} <span className="text-muted-fg">→</span> <span className="text-risk-low">{r.brier_after.toFixed(3)}</span>
          </div>
          <div className="text-xs text-muted-fg">{better > 0 ? `ลดลง ${pct(better)} (ยิ่งน้อยยิ่งตรงความจริง)` : 'ยิ่งน้อยยิ่งตรงความจริง'}</div>
        </div>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-fg">คะแนนเดิมเท่านี้ หลังปรับเป็นเท่าไหร่</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {r.examples.map((e) => (
          <div key={e.before} className="rounded-lg border border-line px-3 py-2 text-center tabular-nums">
            <span className="text-muted-fg">{Math.round(e.before * 100)}</span>
            <Icon name="right" className="mx-2 inline size-4 text-muted-fg" />
            <span className="font-semibold text-fg">{Math.round(e.after * 100)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-fg">
        ตัวเลข "หลังปรับ" วัดบนข้อมูลชุดเดียวกับที่ใช้ปรับ จึงดูดีกว่าความจริงเล็กน้อย ลำดับว่าใครเสี่ยงกว่าใครและปัจจัย (SHAP) ไม่เปลี่ยน
        เปลี่ยนแค่สเกลของตัวเลขให้เข้ากับบริษัท
      </p>
    </Card>
  )
}

export default function Calibrate({ onChanged }) {
  const [version, setVersion] = useState(0)
  const history = useApi([`/recalibrate/history?v=${version}`]) // v เปลี่ยน = โหลดประวัติใหม่
  const [file, setFile] = useState(null)
  const [method, setMethod] = useState('platt')
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [res, setRes] = useState(null)
  const [error, setError] = useState('')

  function changed() {
    setVersion((v) => v + 1)
    onChanged()
  }

  async function run() {
    setBusy(true)
    setError('')
    setRes(null)
    try {
      const r = await postFile('/recalibrate/upload', file, { method })
      setRes(r)
      if (r.result) changed()
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    if (!confirm('ยกเลิกการปรับเทียบทั้งหมด แล้วกลับไปใช้คะแนนของโมเดลกลาง?')) return
    setResetting(true)
    setError('')
    try {
      await api('/recalibrate', { method: 'DELETE' })
      setRes(null)
      changed()
    } catch (err) {
      setError(friendly(err))
    } finally {
      setResetting(false)
    }
  }

  const items = history.data?.[0].history ?? []

  return (
    <div className="space-y-4">
      {history.loading && !history.data ? (
        <Skeleton className="h-14" />
      ) : (
        <Status latest={items[0]} onReset={reset} resetting={resetting} />
      )}

      <Card icon="info" title="การปรับเทียบคืออะไร">
        <p className="text-sm text-muted-fg">
          โมเดลเรียนจากพนักงานบริษัท IBM ในอเมริกา ตัวเลขความเสี่ยงจึงอาจสูงหรือต่ำกว่าความจริงของบริษัทเรา การปรับเทียบใช้ข้อมูลพนักงานในอดีตว่าใครลาออกไปแล้วบ้าง
          มาปรับสเกลของคะแนนให้ตรงกับอัตราลาออกจริงของบริษัท โดยไม่ต้องสอนโมเดลใหม่ ใช้ข้อมูลอย่างน้อย 50 คน และต้องมีทั้งคนที่ลาออกและคนที่ยังอยู่
        </p>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card icon="list" title="1. เตรียมไฟล์" subtitle="หัวคอลัมน์เดียวกับหน้านำเข้า + คอลัมน์ “ลาออกแล้วหรือยัง”">
          <div className="flex flex-wrap gap-2">
            <DownloadButton path="/recalibrate/template" filename="recalibrate_template.xlsx" onError={setError}>
              ไฟล์ตัวอย่าง (เปล่า)
            </DownloadButton>
            <DownloadButton path="/recalibrate/template?demo=true" filename="recalibrate_demo_ibm.xlsx" onError={setError}>
              ข้อมูลทดลอง 300 คน
            </DownloadButton>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-fg">
            <li>
              คอลัมน์ “ลาออกแล้วหรือยัง” กรอก <b>ลาออก</b> หรือ <b>ยังอยู่</b>
            </li>
            <li>ใช้พนักงานในช่วงเวลาเดียวกัน เช่น ทุกคนที่อยู่เมื่อต้นปีที่แล้ว แล้วดูว่าใครลาออกภายในปีนั้น</li>
            <li>“ข้อมูลทดลอง” เป็นพนักงาน IBM พร้อมผลจริง ไว้ลองระบบตอน demo ห้ามใช้ข้อมูลพนักงานจริงจนกว่าจะมีระบบผู้ใช้จริง</li>
          </ul>
        </Card>

        <Card icon="sliders" title="2. เลือกวิธีแล้วอัปโหลด" subtitle=".xlsx หรือ .csv ไม่เกิน 5 MB / 10,000 แถว">
          <div className="space-y-4">
            <div>
              <Segmented options={METHODS} value={method} onChange={setMethod} label="วิธีปรับเทียบ" />
              <p className="mt-2 text-xs text-muted-fg">{METHOD_HINT[method]}</p>
            </div>
            <DropZone busy={false} file={file} onFile={(f) => f && (setFile(f), setRes(null))} name="calibration_file" />
            <button
              type="button"
              onClick={run}
              disabled={!file || busy}
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 font-medium text-on-primary transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy && <span className="size-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />}
              {busy ? 'กำลังตรวจไฟล์และปรับเทียบ…' : 'ปรับเทียบด้วยไฟล์นี้'}
            </button>
          </div>
        </Card>
      </div>

      {error && <Alert>{error}</Alert>}

      {res?.result && <Result r={res.result} />}
      {res && !res.result && (
        <Card icon="warning" title="3. ไฟล์ยังไม่ผ่าน ยังไม่ได้ปรับเทียบ" subtitle={`${res.check.filename} · ${res.message}`}>
          <CheckDetails result={res.check} />
        </Card>
      )}

      {items.length > 0 && (
        <Card icon="clock" title="ประวัติการปรับเทียบ" subtitle="ระบบใช้ครั้งล่าสุด (แถวบนสุด)">
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
                  <th className="px-5 py-2 sm:px-6">เมื่อ</th>
                  <th className="px-3 py-2">วิธี</th>
                  <th className="px-3 py-2 text-right">พนักงาน</th>
                  <th className="px-3 py-2 text-right">ลาออกจริง</th>
                  <th className="px-5 py-2 text-right sm:px-6">Brier ก่อน → หลัง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {items.map((h, i) => (
                  <tr key={h.calibrated_at} className={i === 0 ? 'font-medium text-fg' : 'text-muted-fg'}>
                    <td className="px-5 py-2 sm:px-6">{when(h.calibrated_at)}</td>
                    <td className="px-3 py-2">{METHOD_TH[h.method] ?? h.method}</td>
                    <td className="px-3 py-2 text-right">{h.n_samples.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{pct(h.positive_rate)}</td>
                    <td className="px-5 py-2 text-right sm:px-6">
                      {h.metrics?.brier_before != null ? `${h.metrics.brier_before.toFixed(3)} → ${h.metrics.brier_after.toFixed(3)}` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
