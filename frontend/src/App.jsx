import ShapViewer from './ShapViewer'
import WhatIfSimulator from './WhatIfSimulator'

// หน้าหลัก: แต่ละคนเพิ่ม component ของตัวเอง (What-if Simulator, Intervention Tracker, Company Summary) ที่นี่
export default function App() {
  return (
    <main>
      <h1>Employee Attrition Predictor</h1>
      <ShapViewer />
      <WhatIfSimulator />
    </main>
  )
}
