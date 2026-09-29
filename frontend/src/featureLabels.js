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
  BusinessTravel: 'การเดินทางไปทำงาน',
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

// ค่าที่ถูกเข้ารหัสเป็นตัวเลขตอน clean -> คำที่คนอ่านเข้าใจ (ชุดเดียวกับ src/test_app.py)
const SAT = { 1: 'ต่ำ', 2: 'ปานกลาง', 3: 'สูง', 4: 'สูงมาก' }
const VALUES = {
  OverTime: { 0: 'ไม่ทำ', 1: 'ทำ' },
  Gender: { 0: 'หญิง', 1: 'ชาย' },
  BusinessTravel: { 0: 'ไม่เดินทาง', 1: 'นานๆ ครั้ง', 2: 'บ่อย' },
  Education: { 1: 'ต่ำกว่ามหาวิทยาลัย', 2: 'อนุปริญญา', 3: 'ปริญญาตรี', 4: 'ปริญญาโท', 5: 'ปริญญาเอก' },
  EnvironmentSatisfaction: SAT,
  JobSatisfaction: SAT,
  RelationshipSatisfaction: SAT,
  JobInvolvement: SAT,
  WorkLifeBalance: { 1: 'แย่', 2: 'พอใช้', 3: 'ดี', 4: 'ดีมาก' },
  PerformanceRating: { 1: 'ต่ำ', 2: 'ดี', 3: 'ดีเยี่ยม', 4: 'โดดเด่น' },
  StockOptionLevel: { 0: 'ไม่มีสิทธิ์', 1: 'ระดับ 1', 2: 'ระดับ 2', 3: 'ระดับ 3' },
}

export function featureValue(name, value) {
  if (VALUES[name]?.[value]) return VALUES[name][value]
  if (name.includes('_') && LABELS[name.split('_')[0]]) return value ? 'ใช่' : 'ไม่ใช่' // one-hot
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)
}

export function featureLabel(name) {
  if (LABELS[name]) return LABELS[name]
  const i = name.indexOf('_')
  return i > 0 && LABELS[name.slice(0, i)] ? `${LABELS[name.slice(0, i)]}: ${name.slice(i + 1)}` : name
}
