// ตัวการ์ตูนผู้ช่วย HR: ใน sidebar เปลี่ยนท่าตามระดับความเสี่ยงของพนักงานที่ดูอยู่ + ใช้ในหน้าว่าง/หน้า error
// แทน "สถานการณ์" ไม่ใช่ตัวพนักงาน และเป็นของตกแต่ง (aria-hidden) ข้อมูลจริงอยู่ที่ตัวเลข/ป้ายในหน้า
// แอนิเมชันอยู่ใน index.css (mascot-*) ปิดเองเมื่อผู้ใช้ตั้ง reduced-motion
// มี 4 ตัว: joy (Joy.jsx) / kit (Kit.jsx), cat / dog (PetCharacter.jsx) ตัวที่เลือกเก็บใน App (theme.js: loadMascot/saveMascot)
import Joy from './Joy'
import Kit from './Kit'
import PetCharacter from './PetCharacter'
import { loadMascot, MASCOTS } from '../theme'
import { mascotLine } from './line'


const CHARACTERS = {
  joy: Joy,
  kit: Kit,
  cat: (p) => <PetCharacter {...p} kind="cat" />,
  dog: (p) => <PetCharacter {...p} kind="dog" />,
}
// ชื่อผู้ช่วย ใช้ทั้งปุ่มเลือกผู้ช่วยใน sidebar และป้ายชื่อหน้า login
const LABELS = { joy: 'HR จอย', kit: 'HR กิต', cat: 'น้องส้มฉุน', dog: 'น้องปุกปุย' }

// กล่องคำพูด หางชี้ไปหาตัวการ์ตูน (tail = ทิศที่ตัวการ์ตูนอยู่)
function Bubble({ tail = 'top', className = '', live = false, children }) {
  const pos = {
    top: '-top-[7px] left-1/2 -translate-x-1/2 border-l border-t',
    left: 'top-1/2 -left-[7px] -translate-y-1/2 border-l border-b',
    right: 'top-1/2 -right-[7px] -translate-y-1/2 border-r border-t',
    // มือถือ: ตัวการ์ตูนอยู่ด้านบน / จอใหญ่: อยู่ด้านซ้าย
    side: '-top-[7px] left-1/2 -translate-x-1/2 border-l border-t sm:top-1/2 sm:-left-[7px] sm:-translate-y-1/2 sm:translate-x-0 sm:border-t-0 sm:border-b',
  }[tail]
  return (
    <div className={`relative rounded-2xl border border-line bg-card px-4 py-3 ${className}`} aria-live={live ? 'polite' : undefined}>
      {pos && <span className={`absolute size-3 rotate-45 border-line bg-card ${pos}`} />}
      {children}
    </div>
  )
}

// ตัวโหลดในปุ่ม: หน้าผู้ช่วยที่เลือกไว้ (อ่านจาก localStorage เหมือน App) กระโดด + จุด 3 จุดเด้ง แทนวงกลมหมุน
// ของตกแต่ง ซ่อนจากโปรแกรมอ่านหน้าจอ (ข้อความ "กำลัง..." ข้างๆ บอกสถานะแทน) ท่าอยู่ใน index.css (loader-*)
export function MascotLoader() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {/* ทั้งหัวไม่ใส่กรอบวงกลม (ตัดเป็นวงกลมแล้วผม/หูขาด ดูแปลก) */}
      <span className="loader-hop mr-0.5 inline-flex h-6 [&_svg]:h-6 [&_svg]:w-auto">{CHARACTERS[loadMascot()]({ mood: 'none', mini: 'head' })}</span>
      <span className="loader-dot size-1 rounded-full bg-current" />
      <span className="loader-dot size-1 rounded-full bg-current" />
      <span className="loader-dot size-1 rounded-full bg-current" />
    </span>
  )
}

// ผู้ช่วยตัวเล็กยกมือชี้ขึ้นไปที่ช่อง/จุดที่อยู่ด้านบน + กล่องคำพูดบอกว่าต้องแก้อะไร (ช่องกรอกที่ผิด ตัวเลือกที่ยังไม่เลือก ฯลฯ)
// วางไว้ใต้สิ่งที่ชี้ align = 'left' (ตัวการ์ตูนซ้าย) | 'right' (ตัวการ์ตูนขวา ชี้ของที่อยู่ชิดขวา)
// ข้อความอยู่ในกล่องคำพูด (role alert/status) โปรแกรมอ่านหน้าจออ่านได้ ตัวการ์ตูนเป็นของตกแต่ง
// ตัวที่ชี้ + สัตว์เลี้ยงตัวจิ๋วยืนข้างๆ (ด้านนอก) ซ้ายหรือขวาของกล่องคำพูด
function Pointer({ who, pet, right }) {
  return (
    <div className={`flex shrink-0 items-end ${right ? 'flex-row-reverse' : ''}`} aria-hidden="true">
      {pet && <div className={`${right ? '-ml-2' : '-mr-2'} [&_svg]:h-12 [&_svg]:w-auto`}>{CHARACTERS[pet]({ mood: 'none' })}</div>}
      <div className="-mt-2 [&_svg]:h-24 [&_svg]:w-auto">{CHARACTERS[who]({ mood: 'Point' })}</div>
    </div>
  )
}

// who = ตัวที่ชี้ (ไม่ส่ง = ตัวที่ผู้ใช้เลือกไว้) pet = สัตว์เลี้ยงตัวจิ๋วยืนข้างๆ (หน้า login: จอย+ปุกปุย ซ้าย, กิต+ส้มฉุน ขวา)
// partner = { who, pet } อีกคู่ยืนอีกฝั่ง ชี้ช่องที่กว้างเต็มแถว (กล่องคำพูดอยู่ตรงกลาง)
export function PointHint({ children, align = 'left', who, pet, partner, role = 'alert', className = '' }) {
  const right = align === 'right' && !partner
  return (
    <div role={role} className={`fade-up flex items-end gap-1.5 ${right ? 'flex-row-reverse' : ''} ${className}`}>
      <Pointer who={who ?? loadMascot()} pet={pet} right={right} />
      <Bubble tail={partner ? 'none' : right ? 'right' : 'left'} className={`mb-4 px-3 py-2 text-sm font-medium text-risk-high ${partner ? 'flex-1 text-center' : ''}`}>
        {children}
      </Bubble>
      {partner && <Pointer {...partner} right />}
    </div>
  )
}

// หัวหน้าเพจ: ผู้ช่วยยืนพูดหัวข้อของหน้าเอง (กล่องคำพูดใหญ่ หางชี้ไปที่ตัวการ์ตูน)
// มือถือ: ตัวการ์ตูนอยู่บน กล่องคำพูดอยู่ล่าง / จอใหญ่: ตัวการ์ตูนซ้าย
// mood = ท่าของตัวการ์ตูน (ตามความเสี่ยงของคนที่ดูอยู่) replay = เปลี่ยนค่าแล้วเล่นท่าเข้าใหม่ size = 'lg' หน้าภาพรวม | 'md' หน้าอื่น
export function SpeakingMascot({ who, mood = 'none', replay, size = 'lg', children }) {
  const Character = CHARACTERS[who]
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-5">
      <div className={`shrink-0 [&_svg]:h-auto [&_svg]:w-full ${size === 'lg' ? 'w-24 sm:w-40' : 'w-20 sm:w-28'}`} aria-hidden="true">
        <Character key={`${who}-${mood}-${replay ?? ''}`} mood={mood} />
      </div>
      <Bubble
        tail="side"
        className={`w-full max-w-3xl shadow-[0_18px_40px_-24px_rgb(30_70_140/0.35)] ${size === 'lg' ? 'px-6 py-5 sm:mb-6 sm:px-8 sm:py-6' : 'px-5 py-4 sm:mb-3 sm:px-7 sm:py-5'}`}
      >
        {children}
      </Bubble>
    </div>
  )
}

// หน้าว่างก่อนเลือกพนักงาน: ผู้ช่วยที่เลือกไว้โบกมือ + บอกว่าต้องทำอะไร
export function AssistantHint({ title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-secondary px-6 py-10 sm:flex-row sm:justify-center sm:gap-6">
      {/* ตัวการ์ตูนอยู่ที่หัวเพจแล้ว (ไม่ให้ขึ้นสองตัว) เหลือแค่กล่องคำพูด */}
      <Bubble tail="none" className="max-w-md text-left">
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
// away = ตัวที่ออกไปชี้ช่องในฟอร์มอยู่ (PointHint) ค่อยๆ จางหายจากข้างฟอร์ม แล้วกลับมาเมื่อแก้แล้ว (ที่ว่างคงไว้ หน้าไม่ขยับ)
export function WelcomeMascots({ keys = MASCOTS, enter, away = [], className = '' }) {
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
          {/* ห่ออีกชั้น: ตัวนอกมีแอนิเมชันกระโดดเข้า (ค้าง opacity) จางที่ชั้นในแทน */}
          <div className={`flex flex-col items-center transition duration-300 ${away.includes(k) ? 'translate-y-2 scale-90 opacity-0' : ''}`}>
            {CHARACTERS[k]({ mood: 'none' })}
            <span className="-mt-1 rounded-full border border-line bg-card/80 px-2.5 py-0.5 text-xs font-medium text-fg">{LABELS[k]}</span>
          </div>
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
// idle = { text, sub } ข้อความตอนยังไม่มีพนักงานให้ดู (หน้าที่ไม่ใช่รายคน เช่น นำเข้า/บัญชี) ไม่ส่ง = ชวนเลือกพนักงาน
// chooserOnly = เหลือแค่ปุ่มเลือกผู้ช่วย (หน้าภาพรวมมีผู้ช่วยพูดอยู่ในหัวหน้าแล้ว ไม่ให้ขึ้นสองตัว)
export default function Mascot({ risk, who, onChoose, say, idle, chooserOnly = false }) {
  const m = mascotLine({ risk, say, idle })
  const mood = m.mood
  const Character = CHARACTERS[who]

  return (
    <div className="px-4 pb-2 text-center">
      {!chooserOnly && (
      <>
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
          <div className="mt-1 text-xs tabular-nums text-muted-fg/80">
            พนักงาน #{risk.id} · {risk.label} {Math.round(risk.score * 100)}
          </div>
        )}
      </Bubble>
      </>
      )}
      {/* เลือกผู้ช่วย: รูปหน้าเล็กเรียงกัน (คล้ายเลือกรูปโปรไฟล์) */}
      <div className={chooserOnly ? '' : 'mt-4 border-t border-line pt-3'}>
        <div className="text-xs text-muted-fg">อยากให้ใครเป็นผู้ช่วยดี?</div>
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
        <div className="mt-1.5 text-xs font-medium text-fg">{LABELS[who]}</div>
      </div>
    </div>
  )
}
