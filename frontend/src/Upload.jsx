// นำเข้าข้อมูลพนักงานจาก Excel/CSV: GET /employees/template, POST /employees/validate (ตรวจ), POST /employees/import (บันทึก)
// บันทึกได้เฉพาะผู้ดูแลระบบ (canSave) และ backend ต้องต่อ database (ไม่งั้นได้ข้อความ 503 จาก backend)
// ชิ้นส่วนที่ export (DownloadButton, DropZone, CheckDetails) ใช้ร่วมกับหน้าปรับเทียบโมเดล (Calibrate.jsx)
import { useRef, useState } from 'react'
import { AssistantHint, MascotLoader, PointHint } from './mascot/Mascot'
import { download, employeeLabel, friendly, postFile } from './theme'
import { Alert, Card, Icon } from './ui'

export function DownloadButton({ path, filename, children, onError }) {
  return (
    <button
      type="button"
      onClick={() => download(path, filename).catch((err) => onError(friendly(err)))}
      className="lift inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-4 py-2 text-left font-medium text-fg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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

const cell = (v) => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString() : v)

// ตารางในผลตรวจ: แสดงแค่ PEEK แถวแรก แถวสุดท้ายที่เห็นจางลง (บอกว่ายังมีต่อ) + ปุ่มดูทั้งหมด
// ไม่มีแถบเลื่อนแนวตั้งในตาราง ลูกกลิ้งเมาส์จึงเลื่อนทั้งหน้าได้ตลอด ไม่ไปติดในตาราง
const PEEK = 3
function usePeek(n, unit = 'แถว') {
  const [open, setOpen] = useState(false)
  const more = n > PEEK
  return {
    count: open || !more ? n : PEEK,
    fade: (i) => (more && !open && i === PEEK - 1 ? 'opacity-35' : ''),
    button: more && (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <Icon name={open ? 'up' : 'down'} className="size-4" />
        {open ? 'ย่อ' : `ดูทั้งหมด (${n.toLocaleString()} ${unit})`}
      </button>
    ),
  }
}

// แถวที่ไม่ผ่าน: ตารางแบบเดียวกับตัวอย่างแถวที่ผ่าน (ค่าตามที่กรอก) ช่องที่ผิดเป็นสีแดง ชี้เพื่อดูปัญหา
// ใต้แต่ละแถวมีสรุปปัญหาของแถวนั้น (คนที่ใช้คีย์บอร์ด/โปรแกรมอ่านหน้าจอได้ข้อความครบโดยไม่ต้องชี้)
function InvalidRows({ rows, total }) {
  // คอลัมน์ที่มีปัญหาขึ้นก่อน (ต่อจากรหัส/ชื่อ) เห็นช่องแดงได้เลยไม่ต้องเลื่อนตารางไปขวา
  const all = [...new Set(rows.flatMap((r) => Object.keys(r.values)))]
  const [id, ...rest] = all
  const who = rest.filter((h) => h === 'ชื่อ-นามสกุล')
  const bad = rest.filter((h) => rows.some((r) => h in r.errors) && !who.includes(h))
  const headers = ['แถว', id, ...who, ...bad, ...rest.filter((h) => !who.includes(h) && !bad.includes(h))]
  const peek = usePeek(rows.length)
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-fg">
        แถวที่ต้องแก้ (เลขแถวตามที่เห็นใน Excel)
        {total > rows.length && <span className="font-normal text-muted-fg"> · แสดง {rows.length} แถวแรกจาก {total.toLocaleString()} แถว</span>}
      </h3>
      <div className="-mx-5 overflow-x-auto sm:-mx-6">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 first:pl-5 sm:first:pl-6">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          {rows.slice(0, peek.count).map((r, i) => (
            <tbody key={r.row} className={`border-b border-line ${peek.fade(i)}`}>
              <tr>
                {headers.map((h) => {
                  if (h === 'แถว') return <td key={h} className="px-3 py-2 pl-5 tabular-nums text-muted-fg sm:pl-6">{r.row}</td>
                  const problem = r.errors[h]
                  return (
                    <td
                      key={h}
                      title={problem}
                      className={`px-3 py-2 tabular-nums ${problem ? 'bg-risk-high-soft font-medium text-risk-high ring-1 ring-inset ring-risk-high/30' : ''}`}
                    >
                      {problem && <Icon name="warning" className="mr-1 inline size-3.5 align-[-2px]" />}
                      {cell(r.values[h])}
                    </td>
                  )
                })}
              </tr>
              <tr>
                <td colSpan={headers.length} className="whitespace-normal px-5 pb-2.5 text-xs text-risk-high sm:px-6">
                  {Object.entries(r.errors)
                    .map(([col, msg]) => `${col}: ${msg}`)
                    .join(' · ')}
                </td>
              </tr>
            </tbody>
          ))}
        </table>
      </div>
      {peek.button}
    </div>
  )
}

// ผลตรวจไฟล์: จำนวนแถว, คอลัมน์ที่ขาด, ตารางแถวที่ผิด, ตัวอย่างแถวที่ผ่าน
export function CheckDetails({ result }) {
  const errorsPeek = usePeek(result.errors.length)
  const previewPeek = usePeek(result.preview.length)
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        <Count label="แถวทั้งหมด" value={result.n_rows} />
        <Count label="ผ่าน" value={result.n_valid} tone="text-risk-low" />
        <Count label="ต้องแก้" value={result.n_invalid} tone={result.n_invalid ? 'text-risk-high' : 'text-fg'} />
      </div>
      {/* ผู้ช่วยชี้ขึ้นไปที่ช่อง "ต้องแก้" (ชิดขวา) แล้วบอกให้ดูช่องแดงในตาราง */}
      {result.n_invalid > 0 && (
        <PointHint key={result.filename + result.n_invalid} align="right" role="status" className="justify-start sm:pr-[12%]">
          มี {result.n_invalid.toLocaleString()} แถวต้องแก้ ช่องสีแดงในตารางด้านล่างคือจุดที่ผิด แก้ในไฟล์แล้วอัปโหลดใหม่ได้เลย
        </PointHint>
      )}

      {result.missing_columns.length > 0 && (
        <div className="mt-4">
          <Alert>ไม่พบคอลัมน์ที่ต้องมี: {result.missing_columns.join(', ')} (เทียบกับไฟล์ตัวอย่าง)</Alert>
        </div>
      )}
      {result.unknown_columns.length > 0 && (
        <p className="mt-3 text-sm text-muted-fg">ไม่ได้ใช้คอลัมน์เหล่านี้ (ไม่เป็นไร): {result.unknown_columns.join(', ')}</p>
      )}
      {/* DE-17: ไฟล์ผ่านได้ แต่ระบบเติมค่าแบบสำรวจให้ ความเสี่ยงของคนกลุ่มนั้นอาจต่ำกว่าจริง ต้องรู้ก่อนบันทึก */}
      {result.warnings?.map((w) => (
        <div key={w} className="mt-4">
          <Alert tone="warning">{w}</Alert>
        </div>
      ))}

      {result.invalid_preview?.length > 0 ? (
        <InvalidRows rows={result.invalid_preview} total={result.n_invalid} />
      ) : (
        result.errors.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-fg">แถวที่ต้องแก้ (เลขแถวตามที่เห็นใน Excel)</h3>
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line bg-canvas text-left text-xs font-medium text-muted-fg">
                    <th className="px-5 py-2 sm:px-6">แถว</th>
                    <th className="px-2 py-2">คอลัมน์</th>
                    <th className="px-5 py-2 sm:px-6">ปัญหา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.errors.slice(0, errorsPeek.count).map((e, i) => (
                    <tr key={i} className={`hover:bg-canvas ${errorsPeek.fade(i)}`}>
                      <td className="px-5 py-2 tabular-nums text-muted-fg sm:px-6">{e.row}</td>
                      <td className="px-2 py-2 font-medium text-fg">{e.column}</td>
                      <td className="px-5 py-2 text-risk-high sm:px-6">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errorsPeek.button}
            {result.errors_truncated > 0 && (
              <p className="mt-2 text-xs text-muted-fg">และอีก {result.errors_truncated.toLocaleString()} จุด แก้ชุดนี้แล้วอัปโหลดใหม่</p>
            )}
          </div>
        )
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
                {result.preview.slice(0, previewPeek.count).map((r, i) => (
                  <tr key={i} className={previewPeek.fade(i)}>
                    {Object.values(r).map((v, j) => (
                      <td key={j} className="px-3 py-2 tabular-nums first:pl-5 sm:first:pl-6">
                        {cell(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewPeek.button}
        </div>
      )}
    </>
  )
}

// onSaved() = ข้อมูลพนักงานเปลี่ยน ให้หน้าอื่นโหลดใหม่, onPick(id) = ไปดูพนักงานคนนั้นในหน้า SHAP
// รหัสเดิมแต่ข้อมูลเปลี่ยนแบบที่คนเดิมไม่น่าเป็น (ชื่อเปลี่ยน อายุ/อายุงานลดลง เคยออกแล้ว) แสดงก่อนกดบันทึก
function ChangesToCheck({ result }) {
  const list = result.changes_to_check ?? []
  const peek = usePeek(list.length, 'รหัส')
  if (!list.length) return null
  const total = list.length + (result.changes_truncated ?? 0)
  return (
    <div className="mt-4">
      <Alert tone="warning">
        <b>{total.toLocaleString()} รหัสที่ควรตรวจก่อนบันทึก</b> อาจเป็นคนใหม่ที่ได้รหัสซ้ำ พิมพ์รหัสผิด หรือคนเดียวกันที่กรอกซ้ำด้วยรหัสใหม่
        <ul className="mt-2 space-y-1">
          {list.slice(0, peek.count).map((c, i) => (
            <li key={c.employee_id} className={peek.fade(i)}>
              <span className="font-medium">{employeeLabel(c.employee_id, c.name)}</span>: {c.reasons.join(' · ')}
            </li>
          ))}
        </ul>
        {peek.button}
        {total > list.length && <p className="mt-1 text-xs">และอีก {(total - list.length).toLocaleString()} รหัสที่ไม่ได้แสดง</p>}
      </Alert>
    </div>
  )
}

// ibmDemo = บริษัททดลอง IBM (มีพนักงานรหัส 1–1,470 อยู่แล้ว นำเข้าไฟล์ทดลองจะทับคนเดิม)
export default function Upload({ who, ibmDemo, canSave, onSaved, onPick }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // พนักงานที่ไม่อยู่ในไฟล์: false = เก็บไว้เหมือนเดิม, true = ถือว่าลาออกแล้ว (ไม่ลบ) ตรวจไฟล์ใหม่ทุกครั้งที่เปลี่ยน ให้ตัวเลขตรง
  // null = ยังไม่เลือก: ไม่มีค่าเริ่มต้น ผู้ใช้ต้องเลือกเองก่อนบันทึก (กันกดบันทึกโดยไม่ได้อ่าน)
  const [fullRoster, setFullRoster] = useState(null)
  const [rosterMissing, setRosterMissing] = useState(false)
  const rosterBox = useRef(null)
  const rosterField = (roster) => (roster == null ? {} : { full_roster: roster })
  const confirmBox = useRef(null) // หน้าต่างถามยืนยันเมื่อมีรหัสที่ควรตรวจ (ข้อมูลเปลี่ยนแปลก / อาจกรอกคนเดิมซ้ำ) (<dialog>)
  const nChanges = (result?.changes_to_check?.length ?? 0) + (result?.changes_truncated ?? 0)

  function askSave() {
    if (fullRoster == null) {
      // ยังไม่เลือก: พากลับไปที่คำถาม แจ้งเตือน แล้วโฟกัสตัวเลือกแรก
      setRosterMissing(true)
      rosterBox.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
      rosterBox.current?.querySelector('input')?.focus({ preventScroll: true })
      return
    }
    if (nChanges) confirmBox.current.showModal()
    else save(false)
  }

  async function save(confirmChanges) {
    confirmBox.current?.close()
    setSaving(true)
    setError('')
    try {
      setResult(await postFile('/employees/import', file, { ...rosterField(fullRoster), confirm_changes: confirmChanges }))
      onSaved()
    } catch (err) {
      setError(friendly(err))
    } finally {
      setSaving(false)
    }
  }

  async function check(f, roster = fullRoster) {
    if (!f) return
    setFile(f)
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await postFile('/employees/validate', f, rosterField(roster)))
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
        ตอนนี้ใช้ <b>บัญชีทดลอง</b> ใช้กับข้อมูลทดสอบเท่านั้น ห้ามอัปโหลดข้อมูลพนักงานจริง (PPAP)
      </Alert>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card icon="list" title="1. ดาวน์โหลดไฟล์ตัวอย่าง" subtitle="Excel ที่มีหัวคอลัมน์ครบ + แถวตัวอย่าง + ชีตคำอธิบายค่าที่รับ">
          <div className="flex flex-wrap gap-2">
            <DownloadButton path="/employees/template" filename="employee_template.xlsx" onError={setError}>
              ไฟล์ตัวอย่าง (.xlsx)
            </DownloadButton>
            <DownloadButton path="/employees/template?demo=true" filename="employee_demo.xlsx" onError={setError}>
              ข้อมูลทดลอง 200 คน
            </DownloadButton>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-fg">
            <li>กรอกหนึ่งแถวต่อพนักงานหนึ่งคน รหัสพนักงานห้ามซ้ำ</li>
            <li>เงินเดือนกรอกเป็นบาท ระยะทางเป็นกิโลเมตร</li>
            <li>ค่าที่เป็นตัวเลือกพิมพ์ภาษาไทยได้ เช่น OT: ทำ / ไม่ทำ (ดูชีต “คำอธิบาย”)</li>
            <li>ไฟล์ที่ export จากระบบเดิมใช้หัวคอลัมน์ภาษาอังกฤษแบบ IBM ได้</li>
            <li>ใส่ชื่อ-นามสกุลได้ (ไม่บังคับ) ใช้แสดงผลเท่านั้น ระบบไม่นำไปคำนวณความเสี่ยง</li>
            <li>
              “แผนก” / “ตำแหน่งงาน” ใช้ชื่อจริงของบริษัทได้ (เช่น ฝ่ายการเงิน) แล้วเลือก “กลุ่มแผนก / กลุ่มตำแหน่ง (ให้โมเดล)” ที่ใกล้ที่สุด
              ถ้าชื่อจริงตรงกับกลุ่มอยู่แล้วเว้นช่องกลุ่มได้ ภาพรวมจะแยกแผนกตามชื่อจริง
            </li>
            <li>
              <b className="text-fg">ชื่อแผนกต้องสะกดเหมือนกันทุกแถว</b> ระบบเทียบชื่อตรงตัวอักษร เช่น “ฝ่ายไอที” กับ “แผนก IT” หรือ “ฝ่ายขาย” กับ “ฝ่าย ขาย”
              จะกลายเป็นคนละแผนกในภาพรวม ดูตัวอย่างชื่อแผนก/ตำแหน่งในชีต “ตัวเลือก”
            </li>
            <li>
              “ข้อมูลทดลอง” เป็นพนักงานจำลอง มีชื่อ แผนก ตำแหน่งภาษาไทย ไว้ลองนำเข้าแล้วดูผลในภาพรวม
              {ibmDemo && <b className="text-risk-high"> บริษัทนี้มีพนักงาน IBM รหัส 1–1,470 อยู่แล้ว นำเข้าไฟล์ทดลองจะทับคนเดิม ลองในบริษัทที่สร้างเองดีกว่า</b>}
            </li>
            <li>ช่องความพึงพอใจ/สมดุลงานกับชีวิต (จากแบบสำรวจพนักงาน) และความทุ่มเท (จากการประเมินของหัวหน้า) ไม่มีข้อมูลก็เว้นว่างได้</li>
            <li>“เข้าออฟฟิศ (วัน/สัปดาห์)” ใส่ 0–5 ตามนโยบาย WFH หรือระบบลงเวลา เว้นว่าง = เข้าทุกวัน</li>
          </ul>
        </Card>

        <Card icon="upload" title="2. อัปโหลดไฟล์เพื่อตรวจ" subtitle=".xlsx หรือ .csv ไม่เกิน 5 MB / 10,000 แถว">
          <DropZone busy={busy} file={file} onFile={(f) => check(f)} name="employees_file" />
          {canSave && (
            <fieldset
              ref={rosterBox}
              aria-invalid={rosterMissing || undefined}
              aria-describedby={rosterMissing ? 'roster-missing' : undefined}
              className={`mt-4 rounded-lg text-sm transition-colors duration-150 ${rosterMissing ? 'border border-risk-high/40 bg-risk-high-soft/40 p-3' : ''}`}
            >
              {/* float + w-full: ให้หัวข้ออยู่ในกรอบ ไม่ทับเส้นกรอบตอนแจ้งเตือน */}
              <legend className="float-left mb-2 w-full font-medium text-fg">
                พนักงานที่ไม่อยู่ในไฟล์นี้ ให้ทำอย่างไร? <span className="font-normal text-muted-fg">(ต้องเลือกก่อนบันทึก)</span>
              </legend>

              {[
                [false, 'เก็บไว้เหมือนเดิม', 'ไฟล์นี้มีแค่บางคน เช่น พนักงานใหม่ หรือแผนกเดียว'],
                [true, 'ถือว่าลาออกแล้ว', 'ไฟล์นี้คือรายชื่อพนักงานทุกคนตอนนี้ (ไม่ลบข้อมูล แค่ไม่นับในภาพรวม ถ้ารหัสนั้นกลับมาอยู่ในไฟล์ครั้งหน้า จะกลับมาเป็นพนักงานเหมือนเดิม)'],
              ].map(([value, title, hint]) => (
                <label key={title} className="clear-both flex cursor-pointer items-start gap-2.5 py-1">
                  <input
                    type="radio"
                    name="missing_employees"
                    checked={fullRoster === value}
                    onChange={() => (setFullRoster(value), setRosterMissing(false), file && check(file, value))}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer"
                  />
                  <span>
                    <span className="font-medium text-fg">{title}</span>
                    <span className="block text-xs text-muted-fg">{hint}</span>
                  </span>
                </label>
              ))}
              {rosterMissing && (
                <div id="roster-missing" className="clear-both">
                  <PointHint className="mt-1">เลือกก่อนนะ ว่าจะเก็บพนักงานที่ไม่อยู่ในไฟล์ไว้ หรือถือว่าลาออกแล้ว</PointHint>
                </div>
              )}
            </fieldset>
          )}
        </Card>
      </div>

      {error && <Alert>{error}</Alert>}

      {!result && !error && !busy && (
        <AssistantHint who={who} title="เริ่มจากดาวน์โหลดไฟล์ตัวอย่างนะ">
          กรอกพนักงานหนึ่งคนต่อหนึ่งแถว แล้วลากไฟล์มาวางในช่องด้านบน ระบบจะตรวจให้ก่อนว่าแถวไหนต้องแก้ ยังไม่บันทึกจนกว่าจะกดยืนยัน
        </AssistantHint>
      )}

      {result && (
        <Card
          icon={ok ? 'check' : 'warning'}
          title={ok ? '3. ไฟล์ถูกต้องทั้งหมด' : '3. ผลการตรวจ: มีจุดที่ต้องแก้'}
          subtitle={`${result.filename} · ${result.note}`}
        >
          <CheckDetails result={result} />
          {!result.saved && <ChangesToCheck result={result} />}
          {/* บอกก่อนกดบันทึกว่าจะเกิดอะไร (ต้องต่อ database) */}
          {!result.saved && ok && result.n_new != null && (
            <p className="mt-4 rounded-lg bg-canvas px-4 py-3 text-sm text-fg" aria-live="polite">
              ถ้าบันทึก: เพิ่มใหม่ <b className="tabular-nums">{result.n_new.toLocaleString()}</b> คน · อัปเดต{' '}
              <b className="tabular-nums">{result.n_update.toLocaleString()}</b> คน
              {result.n_leaving != null && (
                <>
                  {' '}
                  · บันทึกว่าออกแล้ว <b className={`tabular-nums ${result.n_leaving ? 'text-risk-high' : ''}`}>{result.n_leaving.toLocaleString()}</b> คน
                </>
              )}
            </p>
          )}

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
                          className="lift inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-fg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          {employeeLabel(id, result.saved_names?.[id])}
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
                  onClick={askSave}
                  disabled={!ok || !canSave || saving}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-action px-5 font-medium text-on-action transition-colors duration-200 hover:bg-action-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-fg"
                >
                  {saving && <MascotLoader />}
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

      <dialog
        ref={confirmBox}
        aria-labelledby="confirm-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-0 text-fg shadow-xl backdrop:bg-ink/40"
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-risk-mid-soft text-risk-mid">
              <Icon name="warning" className="size-5" />
            </span>
            <div>
              <h2 id="confirm-title" className="font-semibold">
                มี {nChanges.toLocaleString()} รหัสที่ควรตรวจก่อนบันทึก
              </h2>
              <p className="mt-1 text-sm text-muted-fg">
                รหัสเดิมที่ข้อมูลเปลี่ยนแปลกจะถูกเขียนทับ (ถ้าเป็นคนใหม่ที่ได้รหัสซ้ำ ข้อมูลของคนเดิมจะหาย) และคนที่อาจกรอกซ้ำจะถูกนับเป็นสองคน ตรวจรายการในหน้านี้แล้ว ต้องการบันทึกใช่หรือไม่
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => confirmBox.current.close()}
              className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              ยกเลิก กลับไปแก้ไฟล์
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-action px-4 text-sm font-medium text-on-action hover:bg-action-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/30"
            >
              ใช่ บันทึก
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
