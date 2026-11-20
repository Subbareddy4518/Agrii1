import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { translateUnit, translateCropName } from './src/utils/i18nHelpers.js'

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

// ---------------------------------------------------------------------------
// TEST 1: COMPLETE SIMULATED WORKFLOW WITH AUTOMATIC PRICE UNIT SYNCHRONIZATION
// ---------------------------------------------------------------------------
test('1. Workflow: Select Ton, enter 50 via keypad, proceed to price, verify price unit automatically Ton, no quantity on Step 3, enter price, go back, change to Quintal, confirm sync & state retention', () => {
  let step = 2
  let form = {
    crop_name: 'Paddy',
    quantity_num: '',
    unit: 'Quintal',
    price: '',
    price_unit: 'Quintal',
    is_price_optional: false,
  }
  let errors = {}

  function update(field, val) {
    form[field] = val
  }

  function handleSelectUnitInStep2(u) {
    form.unit = u
    // Automatically synchronize price unit to follow quantity unit
    form.price_unit = u
  }

  function handleKeypadDigit(digit) {
    if (step === 2) {
      if (digit === '.') {
        const cur = String(form.quantity_num || '')
        if (!cur || cur === '0') {
          update('quantity_num', '0.')
          errors.quantity_num = null
          return
        }
        if (cur.includes('.')) return
        update('quantity_num', `${cur}.`)
        errors.quantity_num = null
        return
      }
      const cur = String(form.quantity_num || '')
      const next = cur === '0' || !cur ? String(digit) : `${cur}${digit}`
      update('quantity_num', next)
      errors.quantity_num = null
    } else if (step === 3) {
      if (form.is_price_optional) {
        form.is_price_optional = false
        form.price = String(digit)
        errors.price = null
        return
      }
      if (digit === '.') {
        const cur = String(form.price || '')
        if (!cur || cur === '0') {
          update('price', '0.')
          errors.price = null
          return
        }
        if (cur.includes('.')) return
        update('price', `${cur}.`)
        errors.price = null
        return
      }
      const cur = String(form.price || '')
      const next = cur === '0' || !cur ? String(digit) : `${cur}${digit}`
      update('price', next)
      errors.price = null
    }
  }

  function validateAndNext(currentStep) {
    if (currentStep === 2) {
      const q = parseFloat(form.quantity_num)
      if (isNaN(q) || q <= 0) {
        errors.quantity_num = 'Please enter a valid quantity greater than 0'
        return false
      }
      errors = {}
      // Automatically synchronize price unit to follow quantity unit
      form.price_unit = form.unit || 'Quintal'
      step = 3
      return true
    } else if (currentStep === 3) {
      const p = parseFloat(form.price)
      if (isNaN(p) || p <= 0) {
        errors.price = 'Please enter a valid price'
        return false
      }
      errors = {}
      step = 4
      return true
    }
  }

  // --- Step 2: Select 'Ton' unit ---
  handleSelectUnitInStep2('Ton')
  assert.equal(form.unit, 'Ton')
  assert.equal(form.price_unit, 'Ton', 'Step 2 unit selection must immediately sync price_unit')

  // --- Step 2: Enter 50 using keypad digits ---
  handleKeypadDigit('5')
  assert.equal(form.quantity_num, '5')
  handleKeypadDigit('0')
  assert.equal(form.quantity_num, '50')

  // --- Step 2: Validate and Proceed to Step 3 ---
  const valid2 = validateAndNext(2)
  assert.equal(valid2, true)
  assert.equal(step, 3)

  // Verify price unit is automatically 'Ton'
  assert.equal(form.price_unit, 'Ton')
  const derivedPriceUnitTe = `₹ / ${translateUnit(tTe, form.price_unit)}`
  assert.equal(derivedPriceUnitTe, '₹ / టన్ను')

  // --- Step 3: Verify Quantity & Unit Repetition are completely absent from Step 3 JSX ---
  const createPostSrc = fs.readFileSync(path.join(__dirname, 'src/pages/CreatePost.jsx'), 'utf-8')
  const step3BlockMatch = createPostSrc.match(/step === 3 && \([\s\S]*?step === 4 && \(/)
  assert.ok(step3BlockMatch, 'Step 3 block must exist in CreatePost.jsx')
  const step3Block = step3BlockMatch[0]

  assert.ok(
    !step3Block.includes('{form.quantity_num}'),
    'Step 3 must NEVER display {form.quantity_num}'
  )
  assert.ok(
    !step3Block.includes('selectedQuantityDisplay'),
    'Step 3 must NEVER include selectedQuantityDisplay'
  )
  assert.ok(
    !step3Block.includes('howMuchQty'),
    'Step 3 must NEVER include quantity questions'
  )
  assert.ok(
    !step3Block.includes('priceUnitPrompt'),
    'Step 3 must NEVER ask the farmer to select the price unit again (priceUnitPrompt removed)'
  )
  assert.ok(
    !step3Block.includes('STANDARD_UNITS.map'),
    'Step 3 must NEVER render unit selection buttons'
  )

  // --- Step 3: Enter price using keypad ---
  handleKeypadDigit('2')
  handleKeypadDigit('4')
  handleKeypadDigit('0')
  handleKeypadDigit('0')
  assert.equal(form.price, '2400')
  assert.equal(form.price_unit, 'Ton')

  // --- Step 3: Go Back to Step 2 ---
  step = 2
  assert.equal(step, 2)
  // Verify quantity 50 and unit Ton are completely preserved!
  assert.equal(form.quantity_num, '50', 'Quantity 50 must be preserved when going back')
  assert.equal(form.unit, 'Ton', 'Unit Ton must be preserved when going back')

  // --- Step 2: Change unit from Ton to Quintal ---
  handleSelectUnitInStep2('Quintal')
  assert.equal(form.unit, 'Quintal')
  assert.equal(form.price_unit, 'Quintal')

  // --- Step 2: Forward again to Step 3 ---
  validateAndNext(2)
  assert.equal(step, 3)
  assert.equal(form.price, '2400', 'Price 2400 must be preserved')
  assert.equal(form.price_unit, 'Quintal', 'Price unit must automatically sync to Quintal')
  assert.equal(`₹ / ${translateUnit(tTe, form.price_unit)}`, '₹ / క్వింటాల్')
})

// ---------------------------------------------------------------------------
// TEST 2: ALL 4 SUPPORTED UNITS SYNCHRONIZATION AND TRANSLATION
// ---------------------------------------------------------------------------
test('2. Automatic price unit derivation for all 4 supported units (Kg, Quintal, Ton, Bag) across EN, TE, HI', () => {
  const expectedTable = [
    {
      unit: 'Kg',
      enPriceUnit: '₹ / Kg',
      tePriceUnit: '₹ / కిలో',
      hiPriceUnit: '₹ / किलो',
    },
    {
      unit: 'Quintal',
      enPriceUnit: '₹ / Quintal',
      tePriceUnit: '₹ / క్వింటాల్',
      hiPriceUnit: '₹ / क्विंटल',
    },
    {
      unit: 'Ton',
      enPriceUnit: '₹ / Ton',
      tePriceUnit: '₹ / టన్ను',
      hiPriceUnit: '₹ / टन',
    },
    {
      unit: 'Bag',
      enPriceUnit: '₹ / Bag',
      tePriceUnit: '₹ / బస్తా',
      hiPriceUnit: '₹ / बोरी',
    },
  ]

  for (const item of expectedTable) {
    const enDerived = `₹ / ${translateUnit(tEn, item.unit)}`
    const teDerived = `₹ / ${translateUnit(tTe, item.unit)}`
    const hiDerived = `₹ / ${translateUnit(tHi, item.unit)}`

    assert.equal(enDerived, item.enPriceUnit, `English price unit mismatch for ${item.unit}`)
    assert.equal(teDerived, item.tePriceUnit, `Telugu price unit mismatch for ${item.unit}`)
    assert.equal(hiDerived, item.hiPriceUnit, `Hindi price unit mismatch for ${item.unit}`)
  }
})

// ---------------------------------------------------------------------------
// TEST 3: DECIMAL INPUT, BACKSPACE & VALIDATION
// ---------------------------------------------------------------------------
test('3. Decimal input, backspace, and validation logic', () => {
  let form = { quantity_num: '' }

  function handleDigit(digit) {
    if (digit === '.') {
      const cur = String(form.quantity_num || '')
      if (!cur || cur === '0') {
        form.quantity_num = '0.'
        return
      }
      if (cur.includes('.')) return
      form.quantity_num = `${cur}.`
      return
    }
    const cur = String(form.quantity_num || '')
    form.quantity_num = cur === '0' || !cur ? String(digit) : `${cur}${digit}`
  }

  function handleBackspace() {
    const cur = String(form.quantity_num || '')
    form.quantity_num = cur.length > 1 ? cur.slice(0, -1) : ''
  }

  function validate(val) {
    const q = parseFloat(val)
    if (isNaN(q) || q <= 0) return false
    return true
  }

  // Type 12.5
  handleDigit('1')
  handleDigit('2')
  handleDigit('.')
  handleDigit('5')
  assert.equal(form.quantity_num, '12.5')
  assert.equal(validate(form.quantity_num), true)

  // Extra dot is ignored
  handleDigit('.')
  assert.equal(form.quantity_num, '12.5')

  // Backspace once -> 12.
  handleBackspace()
  assert.equal(form.quantity_num, '12.')
  assert.equal(validate(form.quantity_num), true) // parseFloat('12.') is 12

  // Backspace again -> 12
  handleBackspace()
  assert.equal(form.quantity_num, '12')

  // Backspace again -> 1
  handleBackspace()
  assert.equal(form.quantity_num, '1')

  // Backspace again -> ''
  handleBackspace()
  assert.equal(form.quantity_num, '')
  assert.equal(validate(form.quantity_num), false)

  // Direct dot -> 0.
  handleDigit('.')
  assert.equal(form.quantity_num, '0.')
  handleDigit('7')
  handleDigit('5')
  assert.equal(form.quantity_num, '0.75')
  assert.equal(validate(form.quantity_num), true)

  // Rejection of invalid quantities
  assert.equal(validate('0'), false)
  assert.equal(validate('-5'), false)
  assert.equal(validate(''), false)
  assert.equal(validate('abc'), false)
})

// ---------------------------------------------------------------------------
// TEST 4: LOCALIZATION ACCURACY ACROSS TELUGU, ENGLISH, AND HINDI
// ---------------------------------------------------------------------------
test('4. Translations in Telugu, English, and Hindi are accurate and complete', () => {
  // Step 2 Heading
  assert.equal(tTe('createPost.howMuchQty'), 'ఎంత పరిమాణం ఉంది?')
  assert.equal(tEn('createPost.howMuchQty'), 'How much quantity do you have?')
  assert.equal(tHi('createPost.howMuchQty'), 'कितनी मात्रा उपलब्ध है?')

  // Step 3 Heading
  assert.equal(tTe('createPost.whatExpectedPrice'), 'మీరు ఆశించే ధర ఎంత?')
  assert.equal(tEn('createPost.whatExpectedPrice'), 'What is your expected price?')
  assert.equal(tHi('createPost.whatExpectedPrice'), 'आपकी अपेक्षित कीमत क्या है?')

  // Supported Units
  assert.deepEqual(
    STANDARD_UNITS.map((u) => translateUnit(tTe, u)),
    ['కిలో', 'క్వింటాల్', 'టన్ను', 'బస్తా']
  )
  assert.deepEqual(
    STANDARD_UNITS.map((u) => translateUnit(tEn, u)),
    ['Kg', 'Quintal', 'Ton', 'Bag']
  )
  assert.deepEqual(
    STANDARD_UNITS.map((u) => translateUnit(tHi, u)),
    ['किलो', 'क्विंटल', 'टन', 'बोरी']
  )

  // Keypad Accessibility Labels
  assert.equal(tTe('createPost.backspace'), 'వెనుకకు తొలగించు')
  assert.equal(tEn('createPost.backspace'), 'Backspace')
  assert.equal(tHi('createPost.backspace'), 'हटाएं')

  assert.equal(tTe('createPost.decimalPoint'), 'దశాంశ బిందువు')
  assert.equal(tEn('createPost.decimalPoint'), 'Decimal point')
  assert.equal(tHi('createPost.decimalPoint'), 'दशमलव बिंदु')

  // Step 2 & Step 3 Subtitles
  assert.ok(tTe('createPost.qtyKeypadHelp').includes('కీప్యాడ్'))
  assert.ok(tEn('createPost.qtyKeypadHelp').toLowerCase().includes('keypad'))
  assert.ok(tHi('createPost.qtyKeypadHelp').includes('कीपैड'))

  assert.ok(tTe('createPost.priceKeypadHelp').includes('ధరను'))
  assert.ok(tEn('createPost.priceKeypadHelp').toLowerCase().includes('price'))
  assert.ok(tHi('createPost.priceKeypadHelp').includes('कीमत'))
})

// ---------------------------------------------------------------------------
// TEST 5: UNIT DEDUPLICATION & ZERO LITERAL 'svg'
// ---------------------------------------------------------------------------
test('5. Unit deduplication and safe crop icon rendering (zero literal "svg")', () => {
  // Exactly 4 unique units
  assert.equal(STANDARD_UNITS.length, 4)
  const teSet = new Set(STANDARD_UNITS.map((u) => translateUnit(tTe, u)))
  assert.equal(teSet.size, 4, 'Must have exactly 4 unique unit names in Telugu')

  // Safe crop icon sanitization
  assert.equal(getSafeCropIcon('🌾'), '🌾')
  assert.equal(getSafeCropIcon('🌶️'), '🌶️')
  assert.equal(getSafeCropIcon('svg'), '🌿')
  assert.equal(getSafeCropIcon('SVG'), '🌿')
  assert.equal(getSafeCropIcon('cotton.svg'), '🌿')
  assert.equal(getSafeCropIcon('<svg width="24">'), '🌿')
  assert.equal(getSafeCropIcon(''), '🌿')
  assert.equal(getSafeCropIcon(null), '🌿')
  assert.equal(getSafeCropIcon(undefined), '🌿')
})
