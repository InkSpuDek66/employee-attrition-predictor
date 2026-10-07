// ตัวการ์ตูนผู้ช่วย HR ใน sidebar เปลี่ยนท่าตามระดับความเสี่ยงของพนักงานที่ดูอยู่
// แทน "สถานการณ์" ไม่ใช่ตัวพนักงาน และเป็นของตกแต่ง (aria-hidden) ข้อมูลจริงอยู่ที่ตัวเลข/ป้ายในหน้า
// แอนิเมชันอยู่ใน index.css (mascot-*) ปิดเองเมื่อผู้ใช้ตั้ง reduced-motion

const MOOD = {
  none: { body: 'fill-muted stroke-muted-fg', text: 'สวัสดี! เลือกพนักงานก่อนนะ', sub: 'ผมจะช่วยดูความเสี่ยงให้' },
  Low: { body: 'fill-risk-low-soft stroke-risk-low', text: 'สบายใจได้', sub: 'ความเสี่ยงต่ำ ดูแลแบบเดิมต่อไป' },
  Medium: { body: 'fill-risk-mid-soft stroke-risk-mid', text: 'ควรติดตาม', sub: 'ความเสี่ยงปานกลาง ลองดูมาตรการ' },
  High: { body: 'fill-risk-high-soft stroke-risk-high', text: 'ควรรีบดูแล', sub: 'ความเสี่ยงสูง คุยกับพนักงานเร็วๆ นี้' },
}

function Arms({ mood }) {
  const s = { strokeWidth: 3, strokeLinecap: 'round', fill: 'none' }
  const left = <path d="M32 88 Q22 96 26 106" {...s} />
  if (mood === 'Low') {
    // ชูนิ้วโป้ง
    return (
      <>
        {left}
        <g className="mascot-pop">
          <path d="M88 86 Q98 82 100 74" {...s} />
          {/* กำปั้นแนวนอน + นิ้วโป้งชี้ขึ้นจากขอบซ้าย + รอยนิ้ว 2 เส้น ให้อ่านเป็น thumbs up ชัดๆ */}
          <rect x="95" y="58" width="18" height="16" rx="5" strokeWidth="2.5" />
          <rect x="95" y="43" width="7" height="18" rx="3.5" strokeWidth="2.5" />
          <path d="M104 63.5 H112 M104 68.5 H112" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      </>
    )
  }
  if (mood === 'Medium') {
    // เกาหัว + เครื่องหมายคำถาม
    return (
      <>
        {left}
        <path d="M88 84 Q106 66 92 46" {...s} />
        <circle cx="90" cy="44" r="6" strokeWidth="2.5" />
        <text x="100" y="30" className="mascot-float fill-risk-mid stroke-none text-[18px] font-bold">?</text>
      </>
    )
  }
  // High / none: โบกมือ (High มีป้าย ! เตือน)
  return (
    <>
      {left}
      <g className="mascot-wave">
        <path d="M88 86 L104 64" {...s} />
        <circle cx="106" cy="60" r="6" strokeWidth="2.5" />
      </g>
      {mood === 'High' && (
        <g className="mascot-float">
          <circle cx="104" cy="28" r="10" className="fill-risk-high stroke-none" />
          <text x="104" y="33" textAnchor="middle" className="fill-white stroke-none text-[14px] font-bold">!</text>
        </g>
      )}
    </>
  )
}

function Face({ mood }) {
  const line = { className: 'stroke-fg', strokeWidth: 2.5, strokeLinecap: 'round', fill: 'none' }
  const mouth = {
    none: 'M51 83 Q60 90 69 83',
    Low: 'M49 81 Q60 92 71 81',
    Medium: 'M52 85 L68 84',
    High: 'M51 88 Q60 81 69 88',
  }[mood]
  return (
    <>
      <g className="mascot-blink">
        <circle cx="50" cy="68" r="3.2" className="fill-fg stroke-none" />
        <circle cx="70" cy="68" r="3.2" className="fill-fg stroke-none" />
      </g>
      {mood === 'High' && (
        <>
          {/* คิ้วยกด้านใน = กังวล (ไม่ใช่โกรธ) */}
          <path d="M44 62 L54 58" {...line} />
          <path d="M76 62 L66 58" {...line} />
        </>
      )}
      {mood === 'Low' && (
        <>
          <circle cx="43" cy="78" r="4" className="fill-risk-high/25 stroke-none" />
          <circle cx="77" cy="78" r="4" className="fill-risk-high/25 stroke-none" />
        </>
      )}
      <path d={mouth} {...line} />
    </>
  )
}

export default function Mascot({ risk }) {
  const mood = risk?.band ?? 'none'
  const m = MOOD[mood]
  return (
    <div className="px-4 pb-2 text-center">
      {/* key = mood: เปลี่ยนระดับแล้วเล่นท่าเข้าใหม่ */}
      <svg key={mood} viewBox="0 0 130 140" className="mx-auto h-44 w-auto overflow-visible" aria-hidden="true">
        <ellipse cx="60" cy="132" rx="26" ry="4" className="mascot-shadow fill-line" />
        <g className={`mascot-body ${m.body}`} strokeWidth="2.5">
          <rect x="30" y="40" width="60" height="84" rx="30" />
          <Face mood={mood} />
          <Arms mood={mood} />
        </g>
      </svg>
      <div className="mt-2 text-sm font-semibold text-fg">{m.text}</div>
      <div className="text-xs text-muted-fg">{m.sub}</div>
      {risk && (
        <div className="mt-1 text-[11px] tabular-nums text-muted-fg/80">
          พนักงาน #{risk.id} · {risk.label} {Math.round(risk.score * 100)}
        </div>
      )}
    </div>
  )
}
