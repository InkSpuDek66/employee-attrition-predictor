// สัตว์เลี้ยงผู้ช่วย HR สไตล์จิบิ: แมวส้มลายสลิด / หมาชิบะ (kind = 'cat' | 'dog') ท่าทางตามระดับความเสี่ยง
// ขนเป็นสีคงที่ บอกระดับความเสี่ยงด้วยสีปลอกคอ (token risk-*) แอนิเมชัน: class mascot-* ใน index.css

const LINE = '#3b2f2f'
const FUR = { cat: '#f4b06a', dog: '#d29a5e' }
const FUR_DARK = { cat: '#d9853a', dog: '#b07a44' }
const CREAM = '#fff3e3'
const PINK = '#f7a1b0'
const COLLAR = { none: 'stroke-accent', Low: 'stroke-risk-low', Medium: 'stroke-risk-mid', High: 'stroke-risk-high' }
const o = { stroke: LINE, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }

// ขาหน้า: เส้นขอบหนา + ไส้สีขน + อุ้งเท้ากลมมีรอยนิ้ว
function Paw({ d, end: [x, y], kind }) {
  return (
    <>
      <path d={d} stroke={LINE} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d={d} stroke={FUR[kind]} strokeWidth="7" strokeLinecap="round" fill="none" />
      <circle cx={x} cy={y} r="6" fill={FUR[kind]} {...o} strokeWidth="1.8" />
      <path d={`M${x - 2.5} ${y - 4} v2 M${x + 2.5} ${y - 4} v2`} stroke={LINE} strokeWidth="1.2" strokeLinecap="round" />
    </>
  )
}

function Sparkle({ x, y, s = 1, delay = 0, cls = 'fill-risk-mid' }) {
  const p = (dx, dy) => `${x + dx * s} ${y + dy * s}`
  return (
    <path
      d={`M${p(0, -7)} Q${p(1, -1)} ${p(7, 0)} Q${p(1, 1)} ${p(0, 7)} Q${p(-1, 1)} ${p(-7, 0)} Q${p(-1, -1)} ${p(0, -7)}Z`}
      className={`mascot-twinkle ${cls}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

function Ears({ kind }) {
  if (kind === 'cat') {
    return (
      <>
        <path d="M34 66 L38 28 L62 50 Z" fill={FUR.cat} {...o} />
        <path d="M106 66 L102 28 L78 50 Z" fill={FUR.cat} {...o} />
        <path d="M40 58 L42 38 L55 50 Z" fill={PINK} />
        <path d="M100 58 L98 38 L85 50 Z" fill={PINK} />
      </>
    )
  }
  // หมา: หูตั้งปลายมนแบบชิบะ
  return (
    <>
      <path d="M38 62 Q34 40 47 36 Q57 42 60 52 Z" fill={FUR.dog} {...o} />
      <path d="M102 62 Q106 40 93 36 Q83 42 80 52 Z" fill={FUR.dog} {...o} />
      <path d="M43 56 Q41 45 48 42 Q53 46 55 52 Z" fill={CREAM} />
      <path d="M97 56 Q99 45 92 42 Q87 46 85 52 Z" fill={CREAM} />
    </>
  )
}

function Face({ mood, kind }) {
  const eyes =
    mood === 'Low' ? (
      <>
        <path d="M46 82 Q53 73 60 82" fill="none" {...o} strokeWidth="3" />
        <path d="M80 82 Q87 73 94 82" fill="none" {...o} strokeWidth="3" />
      </>
    ) : mood === 'High' ? (
      <>
        <path d="M47 75 L58 81 L47 87" fill="none" {...o} strokeWidth="3" />
        <path d="M93 75 L82 81 L93 87" fill="none" {...o} strokeWidth="3" />
        <path d="M50 89 Q48 97 50 104" fill="none" stroke="#7cc4f5" strokeWidth="3.5" strokeLinecap="round" className="mascot-drip" />
        <path d="M90 89 Q92 97 90 104" fill="none" stroke="#7cc4f5" strokeWidth="3.5" strokeLinecap="round" className="mascot-drip" style={{ animationDelay: '500ms' }} />
      </>
    ) : (
      <g className="mascot-blink">
        {[53, 87].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy="81" rx="6.5" ry="8" fill="#2b1d1a" />
            <circle cx={cx - 2} cy={mood === 'Medium' ? 76.5 : 78} r="2.8" fill="#fff" />
            <circle cx={cx + 2.2} cy="84.5" r="1.2" fill="#fff" />
          </g>
        ))}
      </g>
    )

  const mouth = {
    none: 'M62 96 q4 4 8 0 q4 4 8 0', // ω
    Low: null,
    Medium: 'M64 98 q3 -2 6 0 t6 0',
    High: 'M62 99 q2 -3 4 0 t4 0 t4 0 t4 0',
  }[mood]

  return (
    <>
      {kind === 'dog' && (
        // แถบขาวรอบปากถึงแก้ม + จุดคิ้วขาวแบบชิบะ
        <>
          <path d="M34 92 Q44 80 58 88 Q70 82 82 88 Q96 80 106 92 Q100 112 70 114 Q40 112 34 92 Z" fill={CREAM} />
          <ellipse cx="50" cy="67" rx="4" ry="2.6" fill={CREAM} />
          <ellipse cx="90" cy="67" rx="4" ry="2.6" fill={CREAM} />
        </>
      )}
      {kind === 'cat' && (
        // ลายสลิดบนหน้าผาก
        <path d="M62 50 l2 8 M70 48 v9 M78 50 l-2 8" stroke={FUR_DARK.cat} strokeWidth="2.6" strokeLinecap="round" />
      )}
      {eyes}
      {[38, 102].map((x) => (
        <ellipse key={x} cx={x} cy="92" rx="6.5" ry="4" fill={PINK} opacity={mood === 'High' ? 0.35 : 0.7} />
      ))}
      {/* จมูก */}
      {kind === 'cat' ? (
        <path d="M66.5 89 H73.5 L70 93 Z" fill={PINK} {...o} strokeWidth="1.4" />
      ) : (
        <ellipse cx="70" cy="89" rx="4.6" ry="3.4" fill="#2b1d1a" />
      )}
      {mood === 'Low' ? (
        // อ้าปากยิ้ม (หมาแลบลิ้น)
        <>
          <path d="M62 95 Q70 105 78 95 Z" fill="#7a2e3a" {...o} strokeWidth="1.6" />
          {kind === 'dog' && <path d="M66 99 Q70 108 74 99 Z" fill={PINK} {...o} strokeWidth="1.2" />}
        </>
      ) : (
        <path d={mouth} fill="none" {...o} strokeWidth="1.8" />
      )}
      {kind === 'cat' && (
        // หนวดแมว
        <path d="M28 88 L42 90 M28 95 L42 94 M112 88 L98 90 M112 95 L98 94" stroke={LINE} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      )}
    </>
  )
}

function Pose({ mood, kind }) {
  if (mood === 'High') {
    return (
      <>
        <g className="mascot-shake">
          <Paw kind={kind} d="M52 118 Q34 104 33 82" end={[32, 78]} />
          <Paw kind={kind} d="M88 118 Q106 104 107 82" end={[108, 78]} />
        </g>
        <path
          d="M50 16 q4 -7 8 0 t8 0 t8 0 t8 0 t8 0 M56 8 l4 4 M84 8 l-4 4"
          className="mascot-float stroke-risk-high"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    )
  }
  const rest = <Paw kind={kind} d="M54 120 Q52 132 56 140" end={[57, 141]} />
  if (mood === 'Low') {
    return (
      <>
        {rest}
        <Paw kind={kind} d="M86 120 Q88 132 84 140" end={[83, 141]} />
        <g className="mascot-check">
          <circle cx="116" cy="40" r="11" className="fill-risk-low" />
          <path d="M110.5 40 l4 4 l7.5 -8" className="stroke-white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
        <Sparkle x={22} y={50} s={0.8} delay={300} cls="fill-accent" />
        <Sparkle x={124} y={74} s={0.7} delay={800} />
      </>
    )
  }
  if (mood === 'Medium') {
    return (
      <>
        {rest}
        <Paw kind={kind} d="M88 120 Q100 112 92 104" end={[90, 103]} />
        <path d="M102 54 Q105 59 103 62 Q100 63 99 60 Q99 57 102 54Z" fill="#7cc4f5" stroke="#3b82c4" strokeWidth="1.1" className="mascot-drip" />
        <g className="mascot-float">
          <circle cx="110" cy="38" r="2.5" className="fill-card" {...o} strokeWidth="1.4" />
          <circle cx="117" cy="28" r="4" className="fill-card" {...o} strokeWidth="1.4" />
          <ellipse cx="126" cy="12" rx="11" ry="10" className="fill-card" {...o} strokeWidth="1.4" />
          <text x="126" y="17" textAnchor="middle" className="fill-risk-mid text-[14px] font-bold">?</text>
        </g>
      </>
    )
  }
  return (
    <>
      {rest}
      <g className="mascot-wave">
        <Paw kind={kind} d="M88 120 Q104 112 108 98" end={[109, 94]} />
        <path d="M116 86 Q120 90 118 96 M119 82 Q125 88 123 98" fill="none" stroke={LINE} strokeWidth="1.3" strokeLinecap="round" opacity="0.45" />
      </g>
    </>
  )
}

// mini = รูปหน้าเล็กสำหรับปุ่มเลือกผู้ช่วย: ตัดภาพเฉพาะหัว ไม่วาดขาหน้า ไม่ขยับ
export default function PetCharacter({ mood, kind = 'cat', mini = false }) {
  const tail =
    kind === 'cat' ? 'M92 140 Q122 140 118 112 Q116 98 126 92' : 'M92 128 Q116 130 116 112 Q116 100 104 102 Q98 106 104 110'
  return (
    <svg
      viewBox={mini ? '22 26 96 96' : '0 0 140 160'}
      className={mini ? 'mascot-static size-full' : 'mx-auto h-52 w-auto overflow-visible'}
      aria-hidden="true"
    >
      <ellipse cx="70" cy="155" rx="30" ry="4" className="mascot-shadow fill-line" />
      <g className="mascot-body">
        {/* หาง (อยู่หลังตัว) กระดิก; เสี่ยงต่ำกระดิกเร็ว */}
        <g className="mascot-tail" style={mood === 'Low' ? { animationDuration: '0.6s' } : undefined}>
          <path d={tail} stroke={LINE} strokeWidth="11" strokeLinecap="round" fill="none" />
          <path d={tail} stroke={FUR[kind]} strokeWidth="7" strokeLinecap="round" fill="none" />
          {kind === 'cat' && <path d="M112 128 l6 -3 M118 112 l6 1" stroke={FUR_DARK.cat} strokeWidth="2.4" strokeLinecap="round" />}
        </g>
        {/* ตัว + พุงสีครีม + เท้า */}
        <ellipse cx="70" cy="132" rx="27" ry="22" fill={FUR[kind]} {...o} />
        <ellipse cx="70" cy="136" rx="15" ry="14" fill={CREAM} />
        {[57, 83].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="152" rx="9" ry="5.5" fill={FUR[kind]} {...o} />
            <path d={`M${x - 3} 149 v3 M${x + 3} 149 v3`} stroke={LINE} strokeWidth="1.2" strokeLinecap="round" />
          </g>
        ))}
        {/* หัว + หู */}
        <Ears kind={kind} />
        <ellipse cx="70" cy="80" rx="41" ry="35" fill={FUR[kind]} {...o} />
        {/* ปลอกคอสีตามระดับความเสี่ยง + กระดิ่ง */}
        <path d="M46 110 Q70 122 94 110" fill="none" className={COLLAR[mood]} strokeWidth="5" strokeLinecap="round" />
        <circle cx="70" cy="119" r="4.2" fill="#f2c14e" {...o} strokeWidth="1.4" />
        <path d="M67 119.5 H73" stroke={LINE} strokeWidth="1" />
        <Face mood={mood} kind={kind} />
        {/* ขาหน้าวาดทับหัว (หัวโต อุ้งเท้าจะได้ไม่หายไปหลังหัว) */}
        {!mini && <Pose mood={mood} kind={kind} />}
      </g>
    </svg>
  )
}
