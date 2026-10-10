// ตัวการ์ตูนผู้ช่วย HR: ใน sidebar เปลี่ยนท่าตามระดับความเสี่ยงของพนักงานที่ดูอยู่ + ใช้ในหน้าว่าง/หน้า error
// แทน "สถานการณ์" ไม่ใช่ตัวพนักงาน และเป็นของตกแต่ง (aria-hidden) ข้อมูลจริงอยู่ที่ตัวเลข/ป้ายในหน้า
// แอนิเมชันอยู่ใน index.css (mascot-*) ปิดเองเมื่อผู้ใช้ตั้ง reduced-motion
// มี 4 ตัว: chibiGirl / chibiBoy (ChibiCharacter.jsx), cat / dog (PetCharacter.jsx) ตัวที่เลือกเก็บใน App (theme.js: loadMascot/saveMascot)
import ChibiCharacter from './ChibiCharacter'
import PetCharacter from './PetCharacter'
import { loadMascot, MASCOTS } from '../theme'

const MOOD = {
  none: { text: 'สวัสดี! เลือกพนักงานก่อนนะ', sub: 'เราจะช่วยดูความเสี่ยงให้' },
  Low: { text: 'สบายใจได้', sub: 'ความเสี่ยงต่ำ ดูแลแบบเดิมต่อไป' },
  Medium: { text: 'ควรติดตาม', sub: 'ความเสี่ยงปานกลาง ลองดูมาตรการ' },
  High: { text: 'ควรรีบดูแล', sub: 'ความเสี่ยงสูง คุยกับพนักงานเร็วๆ นี้' },
  Sorry: { text: 'ขอโทษนะ', sub: 'ตอนนี้ดึงข้อมูลไม่ได้ ลองใหม่อีกครั้ง' },
  NotFound: { text: 'ไม่เจอพนักงานรหัสนี้นะ', sub: 'ลองเช็กรหัสอีกที' },
}

const CHARACTERS = {
  chibiGirl: (p) => <ChibiCharacter {...p} girl />,
  chibiBoy: ChibiCharacter,
  cat: (p) => <PetCharacter {...p} kind="cat" />,
  dog: (p) => <PetCharacter {...p} kind="dog" />,
}
// ชื่อผู้ช่วย ใช้ทั้งปุ่มเลือกผู้ช่วยใน sidebar และป้ายชื่อหน้า login
const LABELS = { chibiGirl: 'จอย', chibiBoy: 'กิต', cat: 'ส้มฉุน', dog: 'ปุกปุย' }

// กล่องคำพูด หางชี้ไปหาตัวการ์ตูน (tail = ทิศที่ตัวการ์ตูนอยู่)
function Bubble({ tail = 'top', className = '', live = false, children }) {
  const pos = {
    top: '-top-[7px] left-1/2 -translate-x-1/2 border-l border-t',
    left: 'top-1/2 -left-[7px] -translate-y-1/2 border-l border-b',
    // มือถือ: ตัวการ์ตูนอยู่ด้านบน / จอใหญ่: อยู่ด้านซ้าย
    side: '-top-[7px] left-1/2 -translate-x-1/2 border-l border-t sm:top-1/2 sm:-left-[7px] sm:-translate-y-1/2 sm:translate-x-0 sm:border-t-0 sm:border-b',
  }[tail]
  return (
    <div className={`relative rounded-2xl border border-line bg-card px-4 py-3 ${className}`} aria-live={live ? 'polite' : undefined}>
      <span className={`absolute size-3 rotate-45 border-line bg-card ${pos}`} />
      {children}
    </div>
  )
}

// ตัวโหลดในปุ่ม: หน้าผู้ช่วยที่เลือกไว้ (อ่านจาก localStorage เหมือน App) กระโดด + จุด 3 จุดเด้ง แทนวงกลมหมุน
// ของตกแต่ง ซ่อนจากโปรแกรมอ่านหน้าจอ (ข้อความ "กำลัง..." ข้างๆ บอกสถานะแทน) ท่าอยู่ใน index.css (loader-*)
export function MascotLoader() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="loader-hop mr-0.5 size-5 overflow-hidden rounded-full bg-card/80 ring-1 ring-on-primary/20">
        {CHARACTERS[loadMascot()]({ mood: 'none', mini: true })}
      </span>
      <span className="loader-dot size-1 rounded-full bg-current" />
      <span className="loader-dot size-1 rounded-full bg-current" />
      <span className="loader-dot size-1 rounded-full bg-current" />
    </span>
  )
}

// หน้าว่างก่อนเลือกพนักงาน: ผู้ช่วยที่เลือกไว้โบกมือ + บอกว่าต้องทำอะไร
export function AssistantHint({ who, title, children }) {
  const Character = CHARACTERS[who]
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-secondary px-6 py-10 sm:flex-row sm:justify-center sm:gap-6">
      <div className="w-36 shrink-0">
        <Character mood="none" />
      </div>
      <Bubble tail="side" className="max-w-md text-left">
        <div className="font-semibold text-fg">{title}</div>
        <p className="mt-1 text-sm text-muted-fg">{children}</p>
      </Bubble>
    </div>
  )
}

// โหลดไม่ได้: ผู้ช่วยทั้ง 4 ตัวโค้งขอโทษพร้อมกัน (เหลื่อมจังหวะกันนิดๆ) + ข้อความ error จริง
export function SorryState({ message }) {
  return (
    <div role="alert" className="rounded-2xl border border-risk-high/20 bg-risk-high-soft/40 px-6 py-8 text-center">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
        {MASCOTS.map((k, i) => {
          const Character = CHARACTERS[k]
          return (
            <div key={k} style={{ '--bow-delay': `${i * 150}ms` }} className="[&_.mascot-bow]:[animation-delay:var(--bow-delay)]">
              <Character mood="Sorry" />
            </div>
          )
        })}
      </div>
      <div className="mt-4 font-semibold text-fg">ขอโทษนะ ตอนนี้ดึงข้อมูลไม่ได้</div>
      <p className="mx-auto mt-1 max-w-lg text-sm text-risk-high">{message}</p>
    </div>
  )
}

// หน้า login: ผู้ช่วยยืนโบกมือต้อนรับ พร้อมป้ายชื่อ (keys = ตัวที่จะแสดง เรียงซ้ายไปขวา)
// enter = 'left' | 'right' กระโดดเข้ามาจากขอบจอฝั่งนั้น ตัวที่อยู่ด้านนอกมาก่อน
// โบก/ขยับไม่พร้อมกัน ดูมีชีวิต เป็นของตกแต่ง ซ่อนจากโปรแกรมอ่านหน้าจอ
export function WelcomeMascots({ keys = MASCOTS, enter, className = '' }) {
  return (
    <div className={`flex items-end ${className}`} aria-hidden="true">
      {keys.map((k, i) => (
        <div
          key={k}
          data-kind={k === 'cat' || k === 'dog' ? 'pet' : 'person'} // ให้หน้าที่ใช้ปรับขนาดสัตว์แยกได้
          style={{
            '--delay': `${MASCOTS.indexOf(k) * 220}ms`,
            '--hop': `${200 + (enter === 'right' ? keys.length - 1 - i : i) * 220}ms`,
          }}
          className={`flex flex-col items-center [&_.mascot-body]:[animation-delay:var(--delay)] [&_.mascot-wave]:[animation-delay:var(--delay)] ${
            enter ? `hop-in-${enter}` : ''
          }`}
        >
          {CHARACTERS[k]({ mood: 'none' })}
          <span className="-mt-1 rounded-full border border-line bg-card/80 px-2.5 py-0.5 text-xs font-medium text-fg">{LABELS[k]}</span>
        </div>
      ))}
    </div>
  )
}

// กรอกรหัสผิด (404): ผู้ช่วยตัวเดียวทำท่างง ไม่ต้องขอโทษ เพราะระบบไม่ได้พัง
export function NotFoundState({ who, message }) {
  const Character = CHARACTERS[who]
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-secondary px-6 py-10 sm:flex-row sm:justify-center sm:gap-6">
      <div className="w-36 shrink-0">
        <Character mood="NotFound" />
      </div>
      <Bubble tail="side" className="max-w-md text-left">
        <div className="font-semibold text-fg">ไม่เจอพนักงานรหัสนี้นะ</div>
        <p className="mt-1 text-sm text-muted-fg">ลองเช็กรหัสพนักงานอีกที แล้วกด “โหลด” ใหม่</p>
        <p className="mt-2 text-xs text-muted-fg/80">{message}</p>
      </Bubble>
    </div>
  )
}

// say = { n, text, sub } ข้อความชั่วคราวหลังผู้ใช้ทำอะไรสำเร็จ (บันทึก/ปรับเทียบ/ดาวน์โหลด) ทำท่าดีใจแทนท่าตามความเสี่ยง
export default function Mascot({ risk, who, onChoose, say }) {
  const mood = say ? 'Low' : risk?.notFound ? 'NotFound' : risk?.error ? 'Sorry' : (risk?.band ?? 'none')
  const m = say ?? MOOD[mood]
  const Character = CHARACTERS[who]

  return (
    <div className="px-4 pb-2 text-center">
      <button
        type="button"
        onClick={() => onChoose(MASCOTS[(MASCOTS.indexOf(who) + 1) % MASCOTS.length])}
        title="กดเพื่อเปลี่ยนตัวการ์ตูน"
        aria-label="เปลี่ยนตัวการ์ตูน"
        className="cursor-pointer rounded-xl p-1 transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {/* key: เปลี่ยนระดับ/ตัวการ์ตูนแล้วเล่นท่าเข้าใหม่ */}
        <Character key={`${who}-${mood}-${say?.n ?? 0}`} mood={mood} />
      </button>
      <Bubble className="mt-2" live>
        <div className="text-sm font-semibold text-fg">{m.text}</div>
        <div className="text-xs text-muted-fg">{m.sub}</div>
        {risk?.band && !say && (
          <div className="mt-1 text-[11px] tabular-nums text-muted-fg/80">
            พนักงาน #{risk.id} · {risk.label} {Math.round(risk.score * 100)}
          </div>
        )}
      </Bubble>
      {/* เลือกผู้ช่วย: รูปหน้าเล็กเรียงกัน (คล้ายเลือกรูปโปรไฟล์) */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="text-[11px] text-muted-fg">อยากให้ใครเป็นผู้ช่วยดี?</div>
        <div className="mt-2 flex justify-center gap-2" role="radiogroup" aria-label="เลือกผู้ช่วย">
          {MASCOTS.map((k) => {
            const Avatar = CHARACTERS[k]
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={who === k}
                aria-label={LABELS[k]}
                title={LABELS[k]}
                onClick={() => onChoose(k)}
                className={`size-10 cursor-pointer overflow-hidden rounded-full bg-muted transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  who === k ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Avatar mood="none" mini />
              </button>
            )
          })}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-fg">{LABELS[who]}</div>
      </div>
    </div>
  )
}
