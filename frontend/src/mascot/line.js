export const MOOD = {
  none: { text: 'สวัสดี! เลือกพนักงานก่อนนะ', sub: 'เราจะช่วยดูความเสี่ยงให้' },
  Low: { text: 'สบายใจได้', sub: 'ความเสี่ยงต่ำ ดูแลแบบเดิมต่อไป' },
  Medium: { text: 'ควรติดตาม', sub: 'ความเสี่ยงปานกลาง ลองดูมาตรการ' },
  High: { text: 'ควรรีบดูแล', sub: 'ความเสี่ยงสูง คุยกับพนักงานเร็วๆ นี้' },
  Sorry: { text: 'ขอโทษนะ', sub: 'ตอนนี้ดึงข้อมูลไม่ได้ ลองใหม่อีกครั้ง' },
  NotFound: { text: 'ไม่เจอพนักงานรหัสนี้นะ', sub: 'ลองเช็กรหัสอีกที' },
}

// ท่า + คำพูดของผู้ช่วยตามสถานการณ์ (ใช้ทั้ง sidebar และหัวเพจ)
// say = ข้อความชั่วคราวหลังทำอะไรสำเร็จ idle = ข้อความของหน้าที่ไม่ใช่รายคน risk = ความเสี่ยงของคนที่ดูอยู่
export function mascotLine({ risk, say, idle }) {
  const mood = say ? 'Low' : risk?.notFound ? 'NotFound' : risk?.error ? 'Sorry' : (risk?.band ?? 'none')
  return { mood, ...(say ?? ((mood === 'none' && idle) || MOOD[mood])) }
}
