// test ตรรกะเงิน/เกณฑ์ (ใช้ node:test ในตัว ไม่ต้องลง library) รัน: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bandOf, incomeBounds, parseIncomeBaht, toApiChanges } from './theme.js'

test('ขอบเขตเงินเดือน: ขั้นต่ำ 15,000 บาท ขั้นสูง 20,000 ดอลลาร์ × อัตรา', () => {
  assert.deepEqual(incomeBounds(35), [15000, 700000])
  assert.deepEqual(incomeBounds(32.5), [15000, 650000])
})

test('พิมพ์เงินเดือนแล้วดันเข้าขอบเขต', () => {
  assert.equal(parseIncomeBaht('50,000', 35, 1), 50000)
  assert.equal(parseIncomeBaht('100', 35, 1), 15000) // ต่ำกว่าแถบ
  assert.equal(parseIncomeBaht('99,999,999', 35, 1), 700000) // สูงกว่าแถบ
  assert.equal(parseIncomeBaht('abc', 35, 42000), 42000) // พิมพ์มั่ว = ค่าเดิม
  assert.equal(parseIncomeBaht('', 35, 42000), 42000)
})

test('ส่งเงินเดือนเข้า API เป็นดอลลาร์จำนวนเต็ม (backend ปฏิเสธทศนิยม)', () => {
  assert.deepEqual(toApiChanges({ MonthlyIncome: 50000 / 35, OverTime: 'No' }), { MonthlyIncome: 1429, OverTime: 'No' })
  const other = { OverTime: 'No' }
  assert.equal(toApiChanges(other), other)
})

test('แบ่งระดับความเสี่ยงที่ 40/70 (README 6.1)', () => {
  assert.deepEqual([0.399, 0.4, 0.699, 0.7].map(bandOf), ['Low', 'Medium', 'Medium', 'High'])
})
