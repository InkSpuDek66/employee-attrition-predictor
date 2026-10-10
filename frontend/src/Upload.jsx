// นำเข้าข้อมูลพนักงานจาก Excel/CSV: GET /employees/template, POST /employees/validate (ตรวจ), POST /employees/import (บันทึก)
// บันทึกได้เฉพาะผู้ดูแลระบบ (canSave) และ backend ต้องต่อ database (ไม่งั้นได้ข้อความ 503 จาก backend)
// ชิ้นส่วนที่ export (DownloadButton, DropZone, CheckDetails) ใช้ร่วมกับหน้าปรับเทียบโมเดล (Calibrate.jsx)
import { useState } from 'react'
import { download, friendly, postFile } from './theme'
import { Alert, Card, Icon } from './ui'

export function DownloadButton({ path, filename, children, onError }) {
  return (
    <button
      type="button"
      onClick={() => download(path, filename).catch((err) => onError(friendly(err)))}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-2 text-left font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <Icon name="download" className="size-5 shrink-0" />
      {children}
    </button>
  )
}

export function DropZone({ busy, file, onFile, name }) {
  const [dragging, setDragging] = useState(false)
  return (
    <label
      onDragOver={(e) => (e.preventDefault(), setDragging(true))}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => (e.preventDefault(), setDragging(false), onFile(e.dataTransfer.files[0]))}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 focus-within:ring-2 focus-within:ring-accent/40 ${
        dragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-secondary hover:bg-muted'
      }`}
    >
      <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-accent">
        <Icon name="upload" className="size-6" />
      </span>
      <span className="font-medium text-fg">{busy ? 'กำลังตรวจ…' : file ? file.name : 'ลากไฟล์มาวาง หรือกดเพื่อเลือกไฟล์'}</span>
      <span className="text-xs text-muted-fg">เลือกไฟล์ใหม่ได้ตลอด ระบบตรวจใหม่ทันที</span>
      <input type="file" name={name} accept=".xlsx,.csv" className="sr-only" onChange={(e) => (onFile(e.target.files[0]), (e.target.value = ''))} />
    </label>
  )
}

export function Count({ label, value, tone = 'text-fg' }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="text-xs font-medium text-muted-fg">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value.toLocaleString()}</div>
    </div>
  )
}

// ผลตรวจไฟล์: จำนวนแถว, คอลัมน์ที่ขาด, ตารางแถวที่ผิด, ตัวอย่างแถวที่ผ่าน
export function CheckDetails({ result }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        <Count label="แถวทั้งหมด" value={result.n_rows} />
        <Count label="ผ่าน" value={result.n_valid} tone="text-risk-low" />
        <Count label="ต้องแก้" value={result.n_invalid} tone={result.n_invalid ? 'text-risk-high' : 'text-fg'} />
      </div>

      {result.missing_columns.length > 0 && (
        <div className="mt-4">
          <Alert>ไม่พบคอลัมน์ที่ต้องมี: {result.missing_columns.join(', ')} (เทียบกับไฟล์ตัวอย่าง)</Alert>
        </div>
      )}
      {result.unknown_columns.length > 0 && (
        <p className="mt-3 text-sm text-muted-fg">ไม่ได้ใช้คอลัมน์เหล่านี้ (ไม่เป็นไร): {result.unknown_columns.join(', ')}</p>
      )}

      {result.errors.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-fg">แถวที่ต้องแก้ (เลขแถวตามที่เห็นใน Excel)</h3>
          <div className="-mx-5 max-h-96 overflow-auto sm:-mx-6">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
                  <th className="px-5 py-2 sm:px-6">แถว</th>
                  <th className="px-2 py-2">คอลัมน์</th>
                  <th className="px-5 py-2 sm:px-6">ปัญหา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.errors.map((e, i) => (
                  <tr key={i} className="hover:bg-canvas">
                    <td className="px-5 py-2 tabular-nums text-muted-fg sm:px-6">{e.row}</td>
                    <td className="px-2 py-2 font-medium text-fg">{e.column}</td>
                    <td className="px-5 py-2 text-risk-high sm:px-6">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.errors_truncated > 0 && (
            <p className="mt-2 text-xs text-muted-fg">และอีก {result.errors_truncated.toLocaleString()} จุด แก้ชุดนี้แล้วอัปโหลดใหม่</p>
          )}
        </div>
      )}

      {result.preview.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-fg">ตัวอย่างแถวที่ผ่าน (5 แถวแรก)</h3>
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
                  {Object.keys(result.preview[0]).map((h) => (
                    <th key={h} className="px-3 py-2 first:pl-5 sm:first:pl-6">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.preview.map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j} className="px-3 py-2 tabular-nums first:pl-5 sm:first:pl-6">
                        {typeof v === 'number' ? v.toLocaleString() : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// onSaved() = ข้อมูลพนักงานเปลี่ยน ให้หน้าอื่นโหลดใหม่, onPick(id) = ไปดูพนักงานคนนั้นในหน้า SHAP
export default function Upload({ canSave, onSaved, onPick }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError('')
    try {
      setResult(await postFile('/employees/import', file))
      onSaved()
    } catch (err) {
      setError(friendly(err))
    } finally {
      setSaving(false)
    }
  }

  async function check(f) {
    if (!f) return
    setFile(f)
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await postFile('/employees/validate', f))
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  const ok = result && result.n_invalid === 0 && result.missing_columns.length === 0 && result.n_valid > 0

  return (
    <div className="space-y-4">
      <Alert tone="warning">
        ตอนนี้ใช้ <b>บัญชีทดลอง</b> ใช้กับข้อมูลทดสอบเท่านั้น ห้ามอัปโหลดข้อมูลพนักงานจริง (PDPA)
      </Alert>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card icon="list" title="1. ดาวน์โหลดไฟล์ตัวอย่าง" subtitle="Excel ที่มีหัวคอลัมน์ครบ + แถวตัวอย่าง + ชีตคำอธิบายค่าที่รับ">
          <DownloadButton path="/employees/template" filename="employee_template.xlsx" onError={setError}>
            ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
          </DownloadButton>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-fg">
            <li>กรอกหนึ่งแถวต่อพนักงานหนึ่งคน รหัสพนักงานห้ามซ้ำ</li>
            <li>เงินเดือนกรอกเป็นบาท ระยะทางเป็นกิโลเมตร</li>
            <li>ค่าที่เป็นตัวเลือกพิมพ์ภาษาไทยได้ เช่น OT: ทำ / ไม่ทำ (ดูชีต “คำอธิบาย”)</li>
            <li>ไฟล์ที่ export จากระบบเดิมใช้หัวคอลัมน์ภาษาอังกฤษแบบ IBM ได้</li>
          </ul>
        </Card>

        <Card icon="upload" title="2. อัปโหลดไฟล์เพื่อตรวจ" subtitle=".xlsx หรือ .csv ไม่เกิน 5 MB / 10,000 แถว">
          <DropZone busy={busy} file={file} onFile={check} name="employees_file" />
        </Card>
      </div>

      {error && <Alert>{error}</Alert>}

      {result && (
        <Card
          icon={ok ? 'check' : 'warning'}
          title={ok ? '3. ไฟล์ถูกต้องทั้งหมด' : '3. ผลการตรวจ: มีจุดที่ต้องแก้'}
          subtitle={`${result.filename} · ${result.note}`}
        >
          <CheckDetails result={result} />

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {result.saved ? (
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-risk-low">
                  <Icon name="check" className="size-5" />
                  {result.note}
                </span>
                {result.saved_ids.length > 0 && (
                  <div>
                    <div className="mb-2 text-sm text-muted-fg">ดูพนักงานที่เพิ่งบันทึก (กดเพื่อดูว่าเสี่ยงแค่ไหน และเพราะอะไร)</div>
                    <div className="flex flex-wrap gap-2">
                      {result.saved_ids.slice(0, 10).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onPick(id)}
                          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-fg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          พนักงาน #{id}
                          <Icon name="right" className="size-4 text-muted-fg" />
                        </button>
                      ))}
                      {result.saved_ids.length > 10 && (
                        <span className="self-center text-sm text-muted-fg">และคนอื่นๆ (ดูได้จากแท็บภาพรวม)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={save}
                  disabled={!ok || !canSave || saving}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 font-medium text-on-primary transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving && <span className="size-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />}
                  {saving ? 'กำลังบันทึก…' : `บันทึกเข้าระบบ ${result.n_valid.toLocaleString()} คน`}
                </button>
                <span className="text-sm text-muted-fg">
                  {!canSave
                    ? 'บันทึกได้เฉพาะผู้ดูแลระบบ (admin_demo)'
                    : ok
                      ? 'รหัสพนักงานที่มีอยู่แล้วจะถูกอัปเดตเป็นข้อมูลในไฟล์'
                      : 'แก้ไฟล์ให้ผ่านทุกแถวก่อน แล้วอัปโหลดใหม่'}
                </span>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
