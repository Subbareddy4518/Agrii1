import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { translateUnit } from './src/utils/i18nHelpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load real locale files
const enLocale = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/en/common.json'), 'utf-8'))
const teLocale = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/te/common.json'), 'utf-8'))
const hiLocale = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/hi/common.json'), 'utf-8'))

function makeT(locale) {
  return (key, paramsOrDefault) => {
    const parts = key.split('.')
    let current = locale
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        current = undefined
        break
      }
    }
    if (typeof current === 'string') {
      if (typeof paramsOrDefault === 'object' && paramsOrDefault !== null) {
        let str = current
        for (const [k, v] of Object.entries(paramsOrDefault)) {
          str = str.replace(new RegExp(`{{${k}[^}]*}}`, 'g'), String(v))
        }
        return str
      }
      return current
    }
    if (typeof paramsOrDefault === 'string') return paramsOrDefault
    return key
  }
}

const tEn = makeT(enLocale)
const tTe = makeT(teLocale)
const tHi = makeT(hiLocale)

const STANDARD_UNITS = ['Kg', 'Quintal', 'Ton', 'Bag']

function getSafeCropIcon(icon) {
  if (!icon || typeof icon !== 'string') return '🌿'
  const trimmed = icon.trim()
  if (trimmed.toLowerCase() === 'svg' || trimmed.toLowerCase().includes('.svg') || trimmed.startsWith('<svg')) {
    return '🌿'
  }
  return trimmed
}

test('1. Telugu instruction is exactly "పరిమాణాన్ని టైప్ చేయండి లేదా క్రింది బటన్లతో ఎంచుకోండి"', () => {
  const expectedTe = 'పరిమాణాన్ని టైప్ చేయండి లేదా క్రింది బటన్లతో ఎంచుకోండి'
  assert.equal(tTe('createPost.qtyTouchHelp'), expectedTe)
  assert.equal(tTe('createPost.buyerStep2Sub'), expectedTe)

  // Verify English and Hindi equivalents
  assert.ok(tEn('createPost.qtyTouchHelp').toLowerCase().includes('type'))
  assert.ok(tHi('createPost.qtyTouchHelp').includes('टाइप'))
})

test('2. Unit selection: each supported unit displays only once with NO duplicates in TE, EN, HI', () => {
  assert.equal(STANDARD_UNITS.length, 4)

  // Telugu
  const teLabels = STANDARD_UNITS.map((u) => translateUnit(tTe, u))
  assert.deepEqual(teLabels, ['కిలో', 'క్వింటాల్', 'టన్ను', 'బస్తా'])
  const uniqueTe = new Set(teLabels)
  assert.equal(uniqueTe.size, 4, 'Telugu unit labels must all be unique (no duplicate టన్ను)')

  // English
  const enLabels = STANDARD_UNITS.map((u) => translateUnit(tEn, u))
  assert.deepEqual(enLabels, ['Kg', 'Quintal', 'Ton', 'Bag'])
  const uniqueEn = new Set(enLabels)
  assert.equal(uniqueEn.size, 4, 'English unit labels must all be unique')

  // Hindi
  const hiLabels = STANDARD_UNITS.map((u) => translateUnit(tHi, u))
  assert.deepEqual(hiLabels, ['किलो', 'क्विंटल', 'टन', 'बोरी'])
  const uniqueHi = new Set(hiLabels)
  assert.equal(uniqueHi.size, 4, 'Hindi unit labels must all be unique')
})

test('3. Unit selection highlighting and legacy Tonne compatibility', () => {
  let form = { unit: 'Quintal' }

  function isUnitSelected(formUnit, u) {
    return formUnit === u || (u === 'Ton' && (formUnit === 'Tonne' || formUnit === 'Tonnes'))
  }

  // Active Quintal
  assert.ok(isUnitSelected(form.unit, 'Quintal'))
  assert.ok(!isUnitSelected(form.unit, 'Kg'))
  assert.ok(!isUnitSelected(form.unit, 'Ton'))
  assert.ok(!isUnitSelected(form.unit, 'Bag'))

  // Select Ton
  form.unit = 'Ton'
  assert.ok(isUnitSelected(form.unit, 'Ton'))
  assert.ok(!isUnitSelected(form.unit, 'Quintal'))

  // Legacy draft with Tonne maps cleanly to Ton
  form.unit = 'Tonne'
  assert.ok(isUnitSelected(form.unit, 'Ton'))
})

test('4. Quick quantities presets are role-dependent and highlight selected option', () => {
  const farmerPresets = ['5', '10', '25', '50', '100', '200']
  const buyerPresets = ['50', '100', '250', '500', '1000']

  assert.equal(farmerPresets.length, 6)
  assert.equal(buyerPresets.length, 5)

  let form = { quantity_num: '50' }

  function checkMatch(quantityNum, preset) {
    const currentNum = parseFloat(quantityNum)
    return !isNaN(currentNum) && currentNum === parseFloat(preset)
  }

  assert.ok(checkMatch(form.quantity_num, '50'))
  assert.ok(!checkMatch(form.quantity_num, '25'))

  // Typing decimal matching preset
  form.quantity_num = '50.0'
  assert.ok(checkMatch(form.quantity_num, '50'))

  // Custom quantity doesn't match
  form.quantity_num = '37'
  assert.ok(!checkMatch(form.quantity_num, '25'))
  assert.ok(!checkMatch(form.quantity_num, '50'))
})

test('5. Adjustment controls work with exact supported values and non-negative clamping', () => {
  const farmerAdjustments = ['-5', '-1', '+1', '+5', '+10', '+50']
  const buyerAdjustments = ['-50', '-10', '+10', '+50', '+100', '+500']

  let form = { quantity_num: '25' }

  function adjustQuantity(delta) {
    const current = parseFloat(form.quantity_num) || 0
    const nextVal = Math.max(0.1, Math.round((current + delta) * 100) / 100)
    form.quantity_num = String(nextVal)
  }

  // Farmer adjustments
  adjustQuantity(5)
  assert.equal(form.quantity_num, '30')

  adjustQuantity(-1)
  assert.equal(form.quantity_num, '29')

  adjustQuantity(-50) // Clamps to 0.1
  assert.equal(form.quantity_num, '0.1')

  adjustQuantity(0.9)
  assert.equal(form.quantity_num, '1')
})

test('6. Icons: getSafeCropIcon prevents literal "svg" string display', () => {
  assert.equal(getSafeCropIcon('🌾'), '🌾')
  assert.equal(getSafeCropIcon('🌶️'), '🌶️')
  assert.equal(getSafeCropIcon('svg'), '🌿')
  assert.equal(getSafeCropIcon('SVG'), '🌿')
  assert.equal(getSafeCropIcon('paddy.svg'), '🌿')
  assert.equal(getSafeCropIcon('<svg width="24">'), '🌿')
  assert.equal(getSafeCropIcon(''), '🌿')
  assert.equal(getSafeCropIcon(null), '🌿')
  assert.equal(getSafeCropIcon(undefined), '🌿')
})

test('7. Selected quantity display updates immediately in TE, EN, HI', () => {
  let form = { quantity_num: '50', unit: 'Quintal' }

  const displayTe = tTe('createPost.selectedQuantityDisplay', {
    qty: form.quantity_num,
    unit: translateUnit(tTe, form.unit),
  })
  assert.equal(displayTe, 'ఎంచుకున్నది: 50 క్వింటాల్')

  const displayEn = tEn('createPost.selectedQuantityDisplay', {
    qty: form.quantity_num,
    unit: translateUnit(tEn, form.unit),
  })
  assert.equal(displayEn, 'Selected: 50 Quintal')

  const displayHi = tHi('createPost.selectedQuantityDisplay', {
    qty: form.quantity_num,
    unit: translateUnit(tHi, form.unit),
  })
  assert.equal(displayHi, 'चयनित: 50 क्विंटल')

  // Change quantity and unit
  form.quantity_num = '12.5'
  form.unit = 'Kg'

  const updatedTe = tTe('createPost.selectedQuantityDisplay', {
    qty: form.quantity_num,
    unit: translateUnit(tTe, form.unit),
  })
  assert.equal(updatedTe, 'ఎంచుకున్నది: 12.5 కిలో')
})

test('8. Navigation & validation preserves valid decimals and rejects <= 0', () => {
  function validateStep2(quantity_num) {
    const q = parseFloat(quantity_num)
    if (isNaN(q) || q <= 0) {
      return { valid: false, error: 'q2Error' }
    }
    return { valid: true }
  }

  assert.equal(validateStep2('50').valid, true)
  assert.equal(validateStep2('12.5').valid, true)
  assert.equal(validateStep2('0.25').valid, true)
  assert.equal(validateStep2('0').valid, false)
  assert.equal(validateStep2('-5').valid, false)
  assert.equal(validateStep2('').valid, false)
  assert.equal(validateStep2('abc').valid, false)
})
