// ตัวการ์ตูนผู้ช่วย HR ใน sidebar เปลี่ยนท่าตามระดับความเสี่ยงของพนักงานที่ดูอยู่
// แทน "สถานการณ์" ไม่ใช่ตัวพนักงาน และเป็นของตกแต่ง (aria-hidden) ข้อมูลจริงอยู่ที่ตัวเลข/ป้ายในหน้า
// แอนิเมชันอยู่ใน index.css (mascot-*) ปิดเองเมื่อผู้ใช้ตั้ง reduced-motion
// มี 4 ตัว: chibiGirl / chibiBoy (ChibiCharacter.jsx), cat / dog (PetCharacter.jsx) เลือกจากปุ่มใต้ตัว หรือกดที่ตัวเพื่อวนเปลี่ยน จำไว้ใน localStorage
import { useState } from 'react'
import ChibiCharacter from './ChibiCharacter'
import PetCharacter from './PetCharacter'

const MOOD = {
  none: { text: 'สวัสดี! เลือกพนักงานก่อนนะ', sub: 'เราจะช่วยดูความเสี่ยงให้' },
  Low: { text: 'สบายใจได้', sub: 'ความเสี่ยงต่ำ ดูแลแบบเดิมต่อไป' },
  Medium: { text: 'ควรติดตาม', sub: 'ความเสี่ยงปานกลาง ลองดูมาตรการ' },
  High: { text: 'ควรรีบดูแล', sub: 'ความเสี่ยงสูง คุยกับพนักงานเร็วๆ นี้' },
}

const CHARACTERS = {
  chibiGirl: (p) => <ChibiCharacter {...p} girl />,
  chibiBoy: ChibiCharacter,
  cat: (p) => <PetCharacter {...p} kind="cat" />,
  dog: (p) => <PetCharacter {...p} kind="dog" />,
}
const ORDER = Object.keys(CHARACTERS)
const LABELS = { chibiGirl: 'พี่ HR (หญิง)', chibiBoy: 'พี่ HR (ชาย)', cat: 'น้องแมว', dog: 'น้องหมา' }

function savedCharacter() {
  try {
    const v = localStorage.getItem('mascot')
    return v in CHARACTERS ? v : 'chibiGirl'
  } catch {
    return 'chibiGirl'
  }
}

export default function Mascot({ risk }) {
  const mood = risk?.band ?? 'none'
  const m = MOOD[mood]
  const [who, setWho] = useState(savedCharacter)
  const Character = CHARACTERS[who]

  function choose(next) {
    setWho(next)
    try {
      localStorage.setItem('mascot', next)
    } catch {
      // storage ปิด: สลับได้แต่ไม่จำ
    }
  }

  return (
    <div className="px-4 pb-2 text-center">
      <button
        type="button"
        onClick={() => choose(ORDER[(ORDER.indexOf(who) + 1) % ORDER.length])}
        title="กดเพื่อเปลี่ยนตัวการ์ตูน"
        aria-label="เปลี่ยนตัวการ์ตูน"
        className="cursor-pointer rounded-xl p-1 transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {/* key: เปลี่ยนระดับ/ตัวการ์ตูนแล้วเล่นท่าเข้าใหม่ */}
        <Character key={`${who}-${mood}`} mood={mood} />
      </button>
      <div className="mt-2 text-sm font-semibold text-fg">{m.text}</div>
      <div className="text-xs text-muted-fg">{m.sub}</div>
      {risk && (
        <div className="mt-1 text-[11px] tabular-nums text-muted-fg/80">
          พนักงาน #{risk.id} · {risk.label} {Math.round(risk.score * 100)}
        </div>
      )}
      {/* เลือกผู้ช่วย: รูปหน้าเล็กเรียงกัน (คล้ายเลือกรูปโปรไฟล์) */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="text-[11px] text-muted-fg">อยากให้ใครเป็นผู้ช่วยดี?</div>
        <div className="mt-2 flex justify-center gap-2" role="radiogroup" aria-label="เลือกผู้ช่วย">
          {ORDER.map((k) => {
            const Avatar = CHARACTERS[k]
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={who === k}
                aria-label={LABELS[k]}
                title={LABELS[k]}
                onClick={() => choose(k)}
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
