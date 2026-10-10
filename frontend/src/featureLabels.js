// ชื่อฟีเจอร์ภาษาไทย (ชุดเดียวกับ src/test_app.py) ฟีเจอร์ one-hot เช่น JobRole_Manager แสดงเป็น "ตำแหน่งงาน: Manager"
const LABELS = {
  Age: 'อายุ',
  Gender: 'เพศ (ชาย)',
  MaritalStatus: 'สถานภาพสมรส',
  Education: 'ระดับการศึกษา',
  EducationField: 'สาขาที่เรียน',
  DistanceFromHome: 'ระยะทางจากบ้าน',
  Department: 'แผนก',
  JobRole: 'ตำแหน่งงาน',
  JobLevel: 'ระดับตำแหน่ง',
  BusinessTravel: 'เดินทางไปทำงานนอกสถานที่', // business trip (ไม่ใช่การเดินทางไปออฟฟิศ อันนั้นคือ DistanceFromHome)
  OverTime: 'ทำงานล่วงเวลา (OT)',
  PerformanceRating: 'ผลประเมินการทำงาน',
  TrainingTimesLastYear: 'จำนวนครั้งที่อบรมปีที่ผ่านมา',
  MonthlyIncome: 'รายได้ต่อเดือน',
  PercentSalaryHike: 'เงินเดือนขึ้นล่าสุด (%)',
  StockOptionLevel: 'สิทธิ์ซื้อหุ้นพนักงาน',
  DailyRate: 'อัตราค่าจ้างรายวัน',
  HourlyRate: 'อัตราค่าจ้างรายชั่วโมง',
  MonthlyRate: 'อัตราค่าจ้างรายเดือน',
  EnvironmentSatisfaction: 'พอใจสภาพแวดล้อมที่ทำงาน',
  JobSatisfaction: 'พอใจในงานที่ทำ',
  RelationshipSatisfaction: 'พอใจความสัมพันธ์กับเพื่อนร่วมงาน',
  JobInvolvement: 'ความทุ่มเทให้กับงาน',
  WorkLifeBalance: 'สมดุลงานกับชีวิต',
  TotalWorkingYears: 'อายุงานรวม (ปี)',
  NumCompaniesWorked: 'จำนวนบริษัทที่เคยทำงาน',
  YearsAtCompany: 'อยู่บริษัทนี้ (ปี)',
  YearsInCurrentRole: 'อยู่ตำแหน่งปัจจุบัน (ปี)',
  YearsSinceLastPromotion: 'ตั้งแต่เลื่อนตำแหน่งล่าสุด (ปี)',
  YearsWithCurrManager: 'อยู่กับหัวหน้าคนปัจจุบัน (ปี)',
  TenureRatio: 'สัดส่วนอายุงานที่บริษัทนี้',
  AvgSatisfaction: 'ความพึงพอใจเฉลี่ย',
  OverTimeXDistance: 'OT × ระยะทางจากบ้าน',
}

// ระดับตำแหน่ง 1–5 ของ IBM เป็นคำ (เดาจากเงินเดือน/ประสบการณ์/ตำแหน่งในข้อมูล) ต้องตรงกับ JOB_LEVELS ใน backend/routers/employee_upload.py
export const JOB_LEVELS = { 1: 'จูเนียร์', 2: 'พนักงานระดับกลาง', 3: 'ซีเนียร์', 4: 'ผู้จัดการแผนก', 5: 'ผู้จัดการใหญ่' }

// ช่องจากแบบสำรวจพนักงาน อธิบายที่มาให้ผู้ใช้ (ใช้ใน What-if และหน้านำเข้า)
export const SURVEY_NOTE =
  'คะแนนความพึงพอใจและสมดุลงานกับชีวิตมาจากแบบสำรวจพนักงาน (เช่น แบบสำรวจความผูกพันประจำปี) ส่วนความทุ่มเทมาจากการประเมินของหัวหน้า ปรับค่าเพื่อดูว่าถ้ามาตรการทำให้คะแนนดีขึ้น ความเสี่ยงจะเปลี่ยนแค่ไหน'

// ค่าที่ถูกเข้ารหัสเป็นตัวเลขตอน clean -> คำที่คนอ่านเข้าใจ (ชุดเดียวกับ src/test_app.py)
const SAT = { 1: 'ต่ำ', 2: 'ปานกลาง', 3: 'สูง', 4: 'สูงมาก' }
const VALUES = {
  OverTime: { 0: 'ไม่ทำ', 1: 'ทำ' },
  Gender: { 0: 'หญิง', 1: 'ชาย' },
  BusinessTravel: { 0: 'ไม่ต้องไป', 1: 'นานๆ ครั้ง', 2: 'บ่อย' },
  Education: { 1: 'ต่ำกว่ามหาวิทยาลัย', 2: 'อนุปริญญา', 3: 'ปริญญาตรี', 4: 'ปริญญาโท', 5: 'ปริญญาเอก' },
  EnvironmentSatisfaction: SAT,
  JobSatisfaction: SAT,
  RelationshipSatisfaction: SAT,
  JobInvolvement: SAT,
  WorkLifeBalance: { 1: 'แย่', 2: 'พอใช้', 3: 'ดี', 4: 'ดีมาก' },
  PerformanceRating: { 1: 'ต่ำ', 2: 'ดี', 3: 'ดีเยี่ยม', 4: 'โดดเด่น' },
  StockOptionLevel: { 0: 'ไม่มีสิทธิ์', 1: 'ระดับ 1', 2: 'ระดับ 2', 3: 'ระดับ 3' },
  JobLevel: JOB_LEVELS,
}

// หน่วยที่ต่อท้ายค่า (IBM ไม่ได้ระบุหน่วยระยะทาง ใช้ กม. แบบเดียวกับหน้า Streamlit)
const UNITS = { DistanceFromHome: 'กม.', OverTimeXDistance: 'กม.', PercentSalaryHike: '%' }

export function featureValue(name, value) {
  if (VALUES[name]?.[value]) return VALUES[name][value]
  if (UNITS[name]) return `${Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)} ${UNITS[name]}`.replace(' %', '%')
  if (name.includes('_') && LABELS[name.split('_')[0]]) return value ? 'ใช่' : 'ไม่ใช่' // one-hot
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
}

export function featureLabel(name) {
  if (LABELS[name]) return LABELS[name]
  const i = name.indexOf('_')
  return i > 0 && LABELS[name.slice(0, i)] ? `${LABELS[name.slice(0, i)]}: ${name.slice(i + 1)}` : name
}

// ประโยคที่คนอ่านเข้าใจ แทน "ค่าของพนักงาน: …" เช่น "เงินเดือน 47,565 บาท", "บ้านห่างจากที่ทำงาน 3 กม."
// shown = ค่าที่แปลงแล้ว (featureValue หรือเงินบาท), value = ค่าดิบ (ใช้กับฟีเจอร์ที่ต้องดูค่าจริง)
const PHRASES = {
  MonthlyIncome: (s) => `เงินเดือน ${s}`,
  DistanceFromHome: (s) => `บ้านห่างจากที่ทำงาน ${s}`,
  OverTime: (s) => (s === 'ทำ' ? 'ทำงานล่วงเวลา (OT)' : 'ไม่ทำ OT'),
  OverTimeXDistance: (s, v) => (v > 0 ? `ทำ OT และบ้านห่างจากที่ทำงาน ${s}` : 'ไม่ทำ OT'),
  BusinessTravel: (s) => (s === 'ไม่ต้องไป' ? 'ไม่ต้องไปทำงานนอกสถานที่' : `ต้องไปทำงานนอกสถานที่${s}`),
  NumCompaniesWorked: (s) => `เคยทำงานมาแล้ว ${s} บริษัท`,
  Age: (s) => `อายุ ${s} ปี`,
  TotalWorkingYears: (s) => `ทำงานมาแล้วรวม ${s} ปี`,
  YearsAtCompany: (s) => `อยู่บริษัทนี้มา ${s} ปี`,
  YearsInCurrentRole: (s) => `อยู่ตำแหน่งปัจจุบันมา ${s} ปี`,
  YearsSinceLastPromotion: (s) => `ไม่ได้เลื่อนตำแหน่งมา ${s} ปี`,
  YearsWithCurrManager: (s) => `อยู่กับหัวหน้าคนปัจจุบันมา ${s} ปี`,
  JobLevel: (s) => `ตำแหน่ง${s}`,
  StockOptionLevel: (s) => (s === 'ไม่มีสิทธิ์' ? 'ไม่มีสิทธิ์ซื้อหุ้นพนักงาน' : `สิทธิ์ซื้อหุ้นพนักงาน${s}`),
  PercentSalaryHike: (s) => `เงินเดือนขึ้นล่าสุด ${s}`,
  TrainingTimesLastYear: (s) => `อบรม ${s} ครั้งในปีที่ผ่านมา`,
  WorkLifeBalance: (s) => `สมดุลงานกับชีวิต${s}`,
  JobSatisfaction: (s) => `พอใจในงานที่ทำระดับ${s}`,
  EnvironmentSatisfaction: (s) => `พอใจสภาพแวดล้อมที่ทำงานระดับ${s}`,
  RelationshipSatisfaction: (s) => `พอใจความสัมพันธ์กับเพื่อนร่วมงานระดับ${s}`,
  JobInvolvement: (s) => `ทุ่มเทให้กับงานระดับ${s}`,
  AvgSatisfaction: (s) => `ความพึงพอใจเฉลี่ย ${s} จาก 4`,
}

export function featurePhrase(name, value, shown) {
  return PHRASES[name]?.(shown, value) ?? `${featureLabel(name)}: ${shown}`
}
