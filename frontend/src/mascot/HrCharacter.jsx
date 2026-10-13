// ตัวการ์ตูนสไตล์จิบิ: หัวโต ตาโตมีประกาย ตัวจิ๋วใส่สูท ถือแฟ้ม HR ท่าทางตามระดับความเสี่ยง
// girl = HR ผู้หญิง (ผมยาวตรงแสกข้าง สูทดำ เชิ้ตขาว กระโปรง) ไม่ใส่ = ผู้ชาย (ผมแสกกลาง ตาคม คิ้วหนา สูทกรมท่า เนกไท)
// สีสูท/กางเกง/กระโปรงมาจาก token --color-suit* ใน index.css: โหมดสว่างสีเข้ม โหมดมืดเป็นครีม/ขาว ให้ตัดกับพื้นมืด
// สูทสีคงที่ บอกระดับความเสี่ยงด้วยสีเนกไท/เข็มกลัด (token risk-*) แอนิเมชัน: class mascot-* ใน index.css
  
const SKIN = '#fde2cf'
const SKIN_SHADE = '#f2c4a6'
const LINE = '#3b2f2f'
const HAIR_M = '#2a2226' // ผมผู้ชายดำอมน้ำตาล
const HAIR_M_LIGHT = '#5a4c50'
const HAIR_F = '#5a3a2c'
const HAIR_F_LIGHT = '#82593f'
const FOLDER = '#f2c14e'
// สีสูทเป็น class เต็ม (Tailwind หาเจอ) ค่าสีอยู่ที่ token ใน index.css
const SUIT_BOY = { fill: 'fill-suit', stroke: 'stroke-suit', line: 'stroke-suit-line', button: 'fill-suit-line' }
const SUIT_GIRL = { fill: 'fill-blazer', stroke: 'stroke-blazer', line: 'stroke-blazer-line', button: 'fill-blazer-line' }
const TIE = {
  Sorry: 'fill-muted-fg', NotFound: 'fill-accent', none: 'fill-accent', Low: 'fill-risk-low', Medium: 'fill-risk-mid', High: 'fill-risk-high' }
const o = { stroke: LINE, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }

function Arm({ d, suit }) {
  return (
    <>
      <path d={d} stroke={LINE} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d={d} className={suit.stroke} strokeWidth="7" strokeLinecap="round" fill="none" />
    </>
  )
}

const Hand = ({ cx, cy, r = 5.5 }) => <circle cx={cx} cy={cy} r={r} fill={SKIN} {...o} strokeWidth="1.8" />

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

// ตาโตแบบจิบิ: ตาดำ + ม่านตาสีอ่อนด้านล่าง + ประกาย 2 จุด + ขนตาบน
function BigEye({ cx, cy, look = 0, girl }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="7.5" ry="9.5" fill="#2b1d1a" />
      <ellipse cx={cx} cy={cy + 3.5} rx="5.5" ry="5" fill="#7a5243" />
      <circle cx={cx - 2.5} cy={cy - 3.5 + look} r="3.4" fill="#fff" />
      <circle cx={cx + 2.8} cy={cy + 4} r="1.6" fill="#fff" />
      {/* ขนตาโค้งรับขอบตา + ปลายงอนด้านนอก (แบนๆ จะดูขมวดคิ้ว) */}
      <path d={`M${cx - 7.5} ${cy - 5} Q${cx} ${cy - 15} ${cx + 7.5} ${cy - 5}`} fill="none" {...o} strokeWidth="2.2" />
      <path d={cx < 70 ? `M${cx - 7.5} ${cy - 5} l-3 -2` : `M${cx + 7.5} ${cy - 5} l3 -2`} fill="none" {...o} strokeWidth="2" />
      {girl && (
        // ขนตางอนเพิ่มอีกเส้น
        <path d={cx < 70 ? `M${cx - 5} ${cy - 8.5} l-2.5 -2.5` : `M${cx + 5} ${cy - 8.5} l2.5 -2.5`} fill="none" {...o} strokeWidth="1.8" />
      )}
    </g>
  )
}

// ตาผู้ชาย: กลมโตแบบจิบิ (ดูเด็ก) แต่เปลือกตาบนหนาและหางตาคม ไม่มีเส้นชั้นตา/ใต้ตา (ย่อแล้วดูเป็นริ้วรอย แก่)
function SharpEye({ cx, cy, look = 0 }) {
  const out = cx < 70 ? -1 : 1 // ทิศหางตาแต่ละข้าง
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="7" ry="8.6" fill="#2b1d1a" />
      <ellipse cx={cx} cy={cy + 3.2} rx="5" ry="4.4" fill="#6b4535" />
      <circle cx={cx - 2.4} cy={cy - 3 + look} r="3" fill="#fff" />
      <circle cx={cx + 2.6} cy={cy + 3.6} r="1.3" fill="#fff" />
      <path d={`M${cx - 8} ${cy - 4} Q${cx} ${cy - 13} ${cx + 8} ${cy - 4}`} fill="none" {...o} strokeWidth="2.8" />
      <path d={`M${cx + 8 * out} ${cy - 4} l${2.6 * out} -1`} fill="none" {...o} strokeWidth="2.4" />
    </g>
  )
}

function Face({ mood, girl }) {
  const eyes =
    mood === 'Sorry' ? (
      // หลับตาลงแบบสำนึกผิด
      <>
        <path d="M46 81 Q53 87 60 81" fill="none" {...o} strokeWidth="2.8" />
        <path d="M80 81 Q87 87 94 81" fill="none" {...o} strokeWidth="2.8" />
      </>
    ) : mood === 'Low' ? (
      // ตายิ้ม ^ ^
      <>
        <path d={girl ? 'M45 82 Q53 72 61 82' : 'M45 83 Q53 76 61 83'} fill="none" {...o} strokeWidth="3" />
        <path d={girl ? 'M79 82 Q87 72 95 82' : 'M79 83 Q87 76 95 83'} fill="none" {...o} strokeWidth="3" />
      </>
    ) : mood === 'High' ? (
      // หลับตาแน่น > < + น้ำตาไหล
      <>
        <path d="M46 75 L58 81 L46 87" fill="none" {...o} strokeWidth="3" />
        <path d="M94 75 L82 81 L94 87" fill="none" {...o} strokeWidth="3" />
        <path d="M50 89 Q48 97 50 104" fill="none" stroke="#7cc4f5" strokeWidth="3.5" strokeLinecap="round" className="mascot-drip" />
        <path d="M90 89 Q92 97 90 104" fill="none" stroke="#7cc4f5" strokeWidth="3.5" strokeLinecap="round" className="mascot-drip" style={{ animationDelay: '500ms' }} />
      </>
    ) : (
      <g className="mascot-blink">
        {girl ? (
          <>
            <BigEye cx={53} cy={81} look={mood === 'NotFound' ? -1.5 : 0} girl />
            <BigEye cx={87} cy={81} look={mood === 'NotFound' ? -1.5 : 0} girl />
          </>
        ) : (
          <>
            <SharpEye cx={53} cy={82} look={mood === 'NotFound' ? -1.5 : 0} />
            <SharpEye cx={87} cy={82} look={mood === 'NotFound' ? -1.5 : 0} />
          </>
        )}
      </g>
    )
  const mouth = {
    none: girl ? (
      <path d="M63 95 Q70 102 77 95 Z" fill="#fff" {...o} strokeWidth="1.6" /> // ยิ้มเห็นฟันอ่อนๆ
    ) : (
      <path d="M63 96 Q70 101.5 77 96 Q70 98 63 96 Z" fill="#fff" {...o} strokeWidth="1.6" /> // ยิ้มสุภาพเห็นฟันนิดๆ
    ),
    Low: girl ? (
      <path d="M63 95 Q70 104 77 95 Z" fill="#f47b8e" {...o} strokeWidth="1.8" />
    ) : (
      <path d="M60 94 Q70 105 80 94 Q70 97 60 94 Z" fill="#fff" {...o} strokeWidth="1.8" />
    ),
    Medium: <path d="M66 97.5 Q70 96.5 74 97.5" fill="none" {...o} strokeWidth="1.8" />, // เม้มปาก ครุ่นคิด
    NotFound: <path d="M65 98 q2.5 -2 5 0 t5 0" fill="none" {...o} strokeWidth="1.8" />,
    High: <path d="M62 99 q2 -3 4 0 t4 0 t4 0 t4 0" fill="none" {...o} strokeWidth="1.8" />,
    Sorry: <path d="M65 98 Q70 95 75 98" fill="none" {...o} strokeWidth="1.8" />,
  }[mood]
  const brows = girl
    ? {
        // ผู้หญิง: คิ้วบางโค้ง อยู่ใต้แนวหน้าม้า ห่างจากขนตาพอ (ชิดเกินจะดูขมวดคิ้ว)
        none: ['M47 65 Q52 62 58 64', 'M82 64 Q88 62 93 65'],
        Low: ['M47 64 Q52 60.5 58 63', 'M82 63 Q88 60.5 93 64'],
        Medium: ['M47 64.5 Q52 62.5 57 64', 'M83 64 Q88 62.5 93 64.5'],
        NotFound: ['M47 63 Q52 61 57 63', 'M83 65 Q88 64 93 66'],
        High: ['M47 66 Q52 64 57 61', 'M83 61 Q88 64 93 66'],
        Sorry: ['M47 65 Q52 64 57 61.5', 'M83 61.5 Q88 64 93 65'],
      }[mood]
    : {
        // ผู้ชาย: คิ้วชัดกว่าผู้หญิง แต่บางและโค้งนิดๆ (หนาตรงเกินไปทำให้ดูแก่)
        none: ['M45 68 Q52 64.5 60 66.5', 'M80 66.5 Q88 64.5 95 68'],
        Low: ['M45 67 Q52 63 60 65.5', 'M80 65.5 Q88 63 95 67'],
        Medium: ['M45 68.5 Q52 66 60 67.5', 'M80 67.5 Q88 66 95 68.5'],
        NotFound: ['M45 68 Q52 65.5 60 67', 'M80 65 Q88 62.5 95 65'],
        High: ['M46 70 Q53 68 60 64', 'M80 64 Q87 68 94 70'],
        Sorry: ['M46 69 Q53 68 60 65', 'M80 65 Q87 68 94 69'],
      }[mood]
  return (
    <>
      {brows.map((d) => (
        <path key={d} d={d} fill="none" stroke={girl ? HAIR_F : HAIR_M} strokeWidth={girl ? 1.8 : 2.8} strokeLinecap="round" />
      ))}
      {eyes}
      {/* แก้มแดง + ขีดเขินสามขีด */}
      {[40, 100].map((x) => (
        <g key={x} opacity={girl ? (mood === 'High' ? 0.35 : 0.75) : 0.5}>
          <ellipse cx={x} cy="93" rx="7" ry="4.2" fill="#f9a8b8" />
          {girl && (
            <path d={`M${x - 4} 94.5 l2 -3 M${x} 94.5 l2 -3 M${x + 4} 94.5 l2 -3`} stroke="#f47b8e" strokeWidth="1.2" strokeLinecap="round" />
          )}
        </g>
      ))}
      {mouth}
    </>
  )
}

function Pose({ mood, suit }) {
  if (mood === 'Sorry') {
    // มือประสานไว้หน้าตัว + เหงื่อหยด (หัวก้มด้วย mascot-bow)
    return (
      <>
        <Arm suit={suit} d="M52 118 Q48 130 63 136" />
        <Arm suit={suit} d="M88 118 Q92 130 77 136" />
        <Hand cx={66} cy={136} />
        <Hand cx={74} cy={136} />
        <path d="M101 56 Q104 61 102 64 Q99 65 98 62 Q98 59 101 56Z" fill="#7cc4f5" stroke="#3b82c4" strokeWidth="1.1" className="mascot-drip" />
      </>
    )
  }
  if (mood === 'High') {
    // สองมือกุมหัว + เส้นยุ่งเหนือหัว
    return (
      <g>
        <g className="mascot-shake">
          <Arm suit={suit} d="M52 120 Q34 104 32 82" />
          <Arm suit={suit} d="M88 120 Q106 104 108 82" />
          <Hand cx={31} cy={78} r={6.5} />
          <Hand cx={109} cy={78} r={6.5} />
        </g>
        <path
          d="M50 14 q4 -7 8 0 t8 0 t8 0 t8 0 t8 0 M56 6 l4 4 M84 6 l-4 4"
          className="mascot-float stroke-risk-high"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    )
  }
  // แขนซ้ายถือแฟ้ม (ทุกท่ายกเว้นเสี่ยงสูง)
  const folder = (
    <>
      <Arm suit={suit} d="M52 120 Q42 128 42 136" />
      <g transform="rotate(-14 34 138)">
        <rect x="24" y="124" width="18" height="23" rx="2" fill="#fff" {...o} strokeWidth="1.5" />
        <path d="M27 130 H39 M27 134 H37" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M22 128 H29 L31 125 H42 V150 H22 Z" fill={FOLDER} {...o} strokeWidth="1.6" />
        <path d="M27 138 l2 -2 l2 2 l2 -2" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>
      <Hand cx={41} cy={138} />
    </>
  )
  if (mood === 'Low') {
    return (
      <>
        {/* สองมือชูแฟ้มที่อก บนแฟ้มมีเครื่องหมายถูก = เคสนี้ผ่าน (ไม่ใช้ thumbs up: มือจิ๋วแล้วนิ้วโป้งดูเป็นนิ้วอื่น) */}
        <Arm suit={suit} d="M52 118 Q46 128 57 133" />
        <Arm suit={suit} d="M88 118 Q94 128 83 133" />
        <g className="mascot-check">
          <rect x="58" y="113" width="24" height="8" rx="1.5" fill="#fff" {...o} strokeWidth="1.4" />
          <path d="M55 118 H63 L65 115 H85 V140 H55 Z" fill={FOLDER} {...o} strokeWidth="1.8" />
          <path d="M62 128 l5 5 l10 -11" fill="none" className="stroke-risk-low" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <Hand cx={57} cy={133} />
        <Hand cx={83} cy={133} />
        <Sparkle x={122} y={70} />
        <Sparkle x={18} y={58} s={0.8} delay={500} cls="fill-accent" />
        <Sparkle x={114} y={40} s={0.6} delay={900} cls="fill-risk-high" />
        <path d="M120 96 l3 -3 M124 102 l4 -1" stroke="#f2c14e" strokeWidth="2" strokeLinecap="round" className="mascot-float" />
      </>
    )
  }
  if (mood === 'Medium') {
    // ครุ่นคิด: กอดอก + ฟองความคิด "…" (ไม่ถึงกับกุมขมับแบบเสี่ยงสูง)
    return (
      <>
        <Arm suit={suit} d="M52 118 Q52 131 79 128" />
        <Hand cx={80} cy={127.5} />
        <Arm suit={suit} d="M88 118 Q88 133 61 130" />
        <Hand cx={60} cy={129.5} />
        {/* ฟองความคิด "…" (กำลังชั่งใจ) */}
        <g className="mascot-float">
          <circle cx="110" cy="42" r="2.5" className="fill-card" {...o} strokeWidth="1.4" />
          <circle cx="117" cy="32" r="4" className="fill-card" {...o} strokeWidth="1.4" />
          <ellipse cx="126" cy="16" rx="12" ry="9" className="fill-card" {...o} strokeWidth="1.4" />
          <circle cx="121" cy="16" r="2.2" className="fill-risk-mid" />
          <circle cx="126" cy="16" r="2.2" className="fill-risk-mid" />
          <circle cx="131" cy="16" r="2.2" className="fill-risk-mid" />
        </g>
      </>
    )
  }
  if (mood === 'NotFound') {
    return (
      <>
        {folder}
        {/* หาไม่เจอ: นิ้วจิ้มแก้ม งงๆ + ฟองความคิด "?" */}
        <Arm suit={suit} d="M88 120 Q104 112 102 100" />
        <Hand cx={101} cy={98} />
        <path d="M100 56 Q103 61 101 64 Q98 65 97 62 Q97 59 100 56Z" fill="#7cc4f5" stroke="#3b82c4" strokeWidth="1.1" className="mascot-drip" />
        <g className="mascot-float">
          <circle cx="112" cy="40" r="2.5" className="fill-card" {...o} strokeWidth="1.4" />
          <circle cx="118" cy="30" r="4" className="fill-card" {...o} strokeWidth="1.4" />
          <ellipse cx="126" cy="14" rx="11" ry="10" className="fill-card" {...o} strokeWidth="1.4" />
          <text x="126" y="19" textAnchor="middle" className="fill-accent text-[14px] font-bold">?</text>
        </g>
      </>
    )
  }
  // none: โบกมือ
  return (
    <>
      {folder}
      <g className="mascot-wave">
        <Arm suit={suit} d="M88 120 Q102 112 106 98" />
        <Hand cx={107} cy={94} />
        <path d="M114 86 Q118 90 116 96 M117 82 Q123 88 121 98" fill="none" stroke={LINE} strokeWidth="1.3" strokeLinecap="round" opacity="0.45" />
      </g>
    </>
  )
}

// mini = รูปหน้าเล็กสำหรับปุ่มเลือกผู้ช่วย: ตัดภาพเฉพาะหัว ไม่วาดแขน ไม่ขยับ
export default function ChibiCharacter({ mood, girl = false, mini = false }) {
  const suit = girl ? SUIT_GIRL : SUIT_BOY
  return (
    <svg
      viewBox={mini ? '22 16 96 96' : '0 0 140 172'}
      className={mini ? 'mascot-static size-full' : 'mx-auto h-52 w-auto overflow-visible'}
      aria-hidden="true"
    >
      <ellipse cx="70" cy="167" rx="28" ry="4" className="mascot-shadow fill-line" />
      <g className="mascot-body">
        {girl ? (
          <>
            {/* ผมยาวด้านหลัง (อยู่หลังตัว) */}
            <path d="M28 74 Q20 122 36 144 L52 142 Q44 116 46 94 Z" fill={HAIR_F} {...o} />
            <path d="M112 74 Q120 122 104 144 L88 142 Q96 116 94 94 Z" fill={HAIR_F} {...o} />
            {/* ขา + รองเท้าส้นสูง */}
            <rect x="60" y="148" width="8" height="12" rx="3" fill={SKIN} {...o} strokeWidth="1.6" />
            <rect x="72" y="148" width="8" height="12" rx="3" fill={SKIN} {...o} strokeWidth="1.6" />
            <path d="M57 159 H69 Q69 165 63 165 H57 Z M71 159 H83 V165 H77 Q71 165 71 159 Z" fill="#1f1a1a" {...o} strokeWidth="1.6" />
            {/* กระโปรงดินสอ */}
            <path d="M50 138 L90 138 L92 152 L48 152 Z" className={suit.fill} {...o} />
          </>
        ) : (
          <>
            {/* ขาจิ๋ว + รองเท้า */}
            <rect x="57" y="144" width="11" height="17" rx="4" className="fill-pants" {...o} />
            <rect x="72" y="144" width="11" height="17" rx="4" className="fill-pants" {...o} />
            <ellipse cx="61" cy="163" rx="8" ry="4.5" fill="#1f1a1a" {...o} />
            <ellipse cx="79" cy="163" rx="8" ry="4.5" fill="#1f1a1a" {...o} />
          </>
        )}
        {/* ตัว: สูท + เชิ้ต (+ เนกไท ผู้ชาย / เข็มกลัดสีตามความเสี่ยง ผู้หญิง) */}
        <path d="M50 112 Q44 134 48 146 L92 146 Q96 134 90 112 Q70 104 50 112 Z" className={suit.fill} {...o} />
        {girl ? (
          <>
            <path d="M60 110 L70 131 L80 110 Z" fill="#fff" {...o} strokeWidth="1.6" />
            <path d="M60 110 L65 121 L61 123 Z M80 110 L75 121 L79 123 Z" fill="#fff" {...o} strokeWidth="1.4" />
            <path d="M59 111 L65 124 L62 126 L70 138 M81 111 L75 124 L78 126 L70 138" fill="none" className={suit.line} strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="57" cy="126" r="3.2" className={TIE[mood]} {...o} strokeWidth="1.2" />
            <circle cx="56" cy="125" r="0.9" fill="#fff" />
          </>
        ) : (
          <>
            <path d="M61 110 L70 134 L79 110 Z" fill="#fff" {...o} strokeWidth="1.6" />
            <path d="M67 113 L73 113 L72 117 L68 117 Z M68 117 L72 117 L74 129 L70 133 L66 129 Z" className={TIE[mood]} {...o} strokeWidth="1.4" />
            <path d="M60 111 L66 124 L63 126 L70 136 M80 111 L74 124 L77 126 L70 136" fill="none" className={suit.line} strokeWidth="1.6" strokeLinejoin="round" />
          </>
        )}
        <circle cx="70" cy="141" r="1.6" className={suit.button} />
        <rect x="79" y="128" width="9" height="6" rx="1.5" className="fill-card" {...o} strokeWidth="1.1" />
        <rect x="79" y="128" width="9" height="2" rx="0.8" className="fill-accent" />
        {/* หัว + ผม + หน้า: ท่าขอโทษจะก้มลง (mascot-bow) */}
        <g className={mood === 'Sorry' ? 'mascot-bow' : undefined}>
        {girl ? (
          <>
            <ellipse cx="70" cy="76" rx="42" ry="37" fill={SKIN} {...o} />
            <path d="M60 110 Q70 114 80 110" fill="none" stroke={SKIN_SHADE} strokeWidth="2" />
            {/* ผมยาวตรงแสกข้าง: หน้าม้าปัดขวา + ปอยผมคลุมไหล่ทั้งสองข้าง วาดเป็นรูปเดียว (แยกชิ้นแล้วมีรอยต่อ/ช่องเห็นผิว) */}
            <path
              d="M40 132 Q22 112 27 80 Q22 30 70 28 Q118 30 113 80 Q118 112 100 132 Q95 118 99 104 Q104 90 104 74 Q104 62 104 56 Q90 62 75 57 Q62 52 56 40 Q52 56 40 64 Q35 72 36 80 Q36 92 41 104 Q45 118 40 132 Z"
              fill={HAIR_F}
              {...o}
            />
            <path d="M62 36 Q84 32 100 46" fill="none" stroke={HAIR_F_LIGHT} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M34 60 Q38 50 46 44" fill="none" stroke={HAIR_F_LIGHT} strokeWidth="3" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* หัวโตหน้ากลม + ผมแสกกลาง หน้าม้าเป็นปอยตกลงมาปิดหน้าผาก ด้านบนมีวอลลุ่ม ข้างคลุมหู */}
            <ellipse cx="70" cy="76" rx="42" ry="37" fill={SKIN} {...o} />
            <path d="M60 110 Q70 114 80 110" fill="none" stroke={SKIN_SHADE} strokeWidth="2" />
            <path
              d="M30 94 Q20 60 30 40 Q42 18 70 16 Q98 18 110 40 Q120 60 110 94 Q108 80 106 70 Q104 66 101 65 Q100 56 95 51 Q96 58 93 65 Q89 55 82 50 Q84 57 77 64 Q75 52 71 45 L70 43 L69 45 Q65 52 63 64 Q56 57 58 50 Q51 55 47 65 Q44 58 45 51 Q40 56 39 65 Q36 66 34 70 Q32 80 30 94 Z"
              fill={HAIR_M}
              {...o}
            />
            {/* เส้นผมแยกปอย (ทิศจากแสกกลางออกด้านข้าง) + ไฮไลต์ */}
            <g fill="none" strokeLinecap="round">
              <path d="M69 22 Q63 34 64 56" stroke="#000" strokeOpacity="0.35" strokeWidth="1.4" />
              <path d="M71 22 Q77 34 76 56" stroke="#000" strokeOpacity="0.35" strokeWidth="1.4" />
              <path d="M52 28 Q44 40 45 56" stroke="#000" strokeOpacity="0.3" strokeWidth="1.3" />
              <path d="M88 28 Q96 40 95 56" stroke="#000" strokeOpacity="0.3" strokeWidth="1.3" />
              <path d="M44 32 Q54 22 64 22" stroke={HAIR_M_LIGHT} strokeWidth="2.6" />
              <path d="M76 22 Q86 22 96 32" stroke={HAIR_M_LIGHT} strokeWidth="2.6" />
            </g>
          </>
        )}
        <Face mood={mood} girl={girl} />
        </g>
        {/* แขน/มือวาดทับหัว (หัวโต มือจะได้ไม่หายไปหลังหัว) */}
        {!mini && <Pose mood={mood} suit={suit} />}
      </g>
    </svg>
  )
}
