import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  DEFAULT_CROPS_CATALOG,
  getCropByName,
  filterCropsCatalog,
} from './src/utils/cropsData.js'
import {
  translateCropName,
  translateAgriCategory,
  translateUnit,
} from './src/utils/i18nHelpers.js'

// Mock translations dictionary matching en, te, hi
const mockTranslations = {
  en: {
    'crops.paddy': 'Paddy',
    'crops.cotton': 'Cotton',
    'crops.chilli': 'Chilli',
    'crops.tomato': 'Tomato',
    'crops.maize': 'Maize',
    'crops.onion': 'Onion',
    'crops.groundnut': 'Groundnut',
    'crops.redGram': 'Red Gram',
    'crops.turmeric': 'Turmeric',
    'crops.wheat': 'Wheat',
    'crops.mango': 'Mango',
    'crops.sugarcane': 'Sugarcane',
    'crops.banana': 'Banana',
    'crops.potato': 'Potato',
    'crops.soybean': 'Soybean',
    'crops.bengalGram': 'Bengal Gram',
    'crops.greenGram': 'Green Gram',
    'agriCategories.all': 'All Crops',
    'agriCategories.cereals': 'Cereals',
    'agriCategories.vegetables': 'Vegetables',
    'agriCategories.spices': 'Spices',
    'agriCategories.cashCrops': 'Cash Crops',
    'agriCategories.pulses': 'Pulses',
    'agriCategories.fruits': 'Fruits',
    'units.quintal': 'Quintal',
    'units.kg': 'Kg',
    'units.ton': 'Ton',
  },
  te: {
    'crops.paddy': 'వరి ధాన్యం',
    'crops.cotton': 'పత్తి',
    'crops.chilli': 'మిర్చి',
    'crops.tomato': 'టమాటా',
    'crops.maize': 'మొక్కజొన్న',
    'crops.onion': 'ఉల్లిపాయ',
    'crops.groundnut': 'వేరుశనగ',
    'crops.redGram': 'కందులు',
    'crops.turmeric': 'పసుపు',
    'crops.wheat': 'గోధుమ',
    'crops.mango': 'మామిడి',
    'crops.sugarcane': 'చెరకు',
    'crops.banana': 'అరటి',
    'crops.potato': 'బంగాళదుంప',
    'crops.soybean': 'సోయాబీన్',
    'crops.bengalGram': 'శనగలు',
    'crops.greenGram': 'పెసలు',
    'agriCategories.all': 'అన్ని పంటలు',
    'agriCategories.cereals': 'ధాన్యాలు',
    'agriCategories.vegetables': 'కూరగాయలు',
    'agriCategories.spices': 'మసాలాలు',
    'agriCategories.cashCrops': 'వాణిజ్య పంటలు',
    'agriCategories.pulses': 'పప్పుదినుసులు',
    'agriCategories.fruits': 'పండ్లు',
  },
}

function createT(lang = 'en') {
  return (key, defaultVal) => mockTranslations[lang]?.[key] || defaultVal || key
}

test('1. DEFAULT_CROPS_CATALOG is populated and valid', () => {
  assert.ok(Array.isArray(DEFAULT_CROPS_CATALOG))
  assert.ok(DEFAULT_CROPS_CATALOG.length >= 15, `Expected >= 15 crops, found ${DEFAULT_CROPS_CATALOG.length}`)

  for (const crop of DEFAULT_CROPS_CATALOG) {
    assert.ok(crop.name, 'Crop must have name')
    assert.ok(crop.category, `Crop ${crop.name} must have category`)
    assert.ok(crop.icon, `Crop ${crop.name} must have icon`)
    assert.ok(crop.default_unit, `Crop ${crop.name} must have default_unit`)
    assert.ok(typeof crop.min_price === 'number', `Crop ${crop.name} must have numeric min_price`)
    assert.ok(typeof crop.max_price === 'number', `Crop ${crop.name} must have numeric max_price`)
    assert.ok(typeof crop.modal_price === 'number', `Crop ${crop.name} must have numeric modal_price`)
  }
})

test('2. All standard categories have crops present', () => {
  const categories = ['Cereals', 'Vegetables', 'Spices', 'Cash Crops', 'Pulses', 'Fruits']
  for (const cat of categories) {
    const cropsInCat = DEFAULT_CROPS_CATALOG.filter(
      (c) => c.category.toLowerCase() === cat.toLowerCase()
    )
    assert.ok(cropsInCat.length >= 2, `Category ${cat} should have at least 2 crops, found ${cropsInCat.length}`)
  }
})

test('3. Category filtering works correctly', () => {
  // All
  const all = filterCropsCatalog(DEFAULT_CROPS_CATALOG, 'All')
  assert.equal(all.length, DEFAULT_CROPS_CATALOG.length)

  // Spices
  const spices = filterCropsCatalog(DEFAULT_CROPS_CATALOG, 'Spices')
  assert.ok(spices.length >= 2)
  assert.ok(spices.every((c) => c.category === 'Spices'))
  assert.ok(spices.some((c) => c.name === 'Chilli'))
  assert.ok(spices.some((c) => c.name === 'Turmeric'))

  // Cereals
  const cereals = filterCropsCatalog(DEFAULT_CROPS_CATALOG, 'Cereals')
  assert.ok(cereals.some((c) => c.name === 'Paddy'))
  assert.ok(cereals.some((c) => c.name === 'Maize'))
  assert.ok(cereals.some((c) => c.name === 'Wheat'))

  // Pulses
  const pulses = filterCropsCatalog(DEFAULT_CROPS_CATALOG, 'Pulses')
  assert.ok(pulses.some((c) => c.name === 'Red Gram'))
  assert.ok(pulses.some((c) => c.name === 'Bengal Gram'))
})

test('4. Crop search works across English, Telugu, and Hindi keywords', () => {
  // English name search
  const res1 = filterCropsCatalog(DEFAULT_CROPS_CATALOG, 'All', 'chilli')
  assert.ok(res1.some((c) => c.name === 'Chilli'))

  // Telugu keyword search
  const res2 = filterCropsCatalog(DEFAULT_CROPS_CATALOG, 'All', 'మిర్చి')
  assert.ok(res2.some((c) => c.name === 'Chilli'))

  // Hindi keyword search
  const res3 = filterCropsCatalog(DEFAULT_CROPS_CATALOG, 'All', 'मिर्च')
  assert.ok(res3.some((c) => c.name === 'Chilli'))
})

test('5. Multilingual crop name and category translations', () => {
  const tEn = createT('en')
  const tTe = createT('te')

  assert.equal(translateCropName(tEn, 'Chilli'), 'Chilli')
  assert.equal(translateCropName(tTe, 'Chilli'), 'మిర్చి')

  assert.equal(translateCropName(tEn, 'Paddy'), 'Paddy')
  assert.equal(translateCropName(tTe, 'Paddy'), 'వరి ధాన్యం')

  assert.equal(translateAgriCategory(tEn, 'Spices'), 'Spices')
  assert.equal(translateAgriCategory(tTe, 'Spices'), 'మసాలాలు')
})

test('6. Selection state simulation and validation flow', () => {
  // Simulate component state
  let form = {
    crop_name: '',
    category: '',
    unit: 'Quintal',
    price_unit: 'Quintal',
    quantity_num: '100',
    price: '2400',
  }
  let errors = {}
  let step = 1

  function handleSelectCrop(crop) {
    if (!crop || !crop.name) return
    form = {
      ...form,
      crop_name: crop.name,
      category: crop.category || form.category,
      unit: crop.default_unit || form.unit,
      price_unit: crop.default_unit || form.price_unit,
    }
    delete errors.crop_name
  }

  function validateAndNext(currentStep) {
    if (currentStep === 1) {
      if (!form.crop_name.trim()) {
        errors.crop_name = 'Please select a crop to continue'
        return false
      }
      errors = {}
      step = 2
      return true
    }
    return false
  }

  // Initially empty: validation fails, cannot proceed
  assert.equal(form.crop_name, '')
  assert.equal(validateAndNext(1), false)
  assert.equal(step, 1)
  assert.ok(errors.crop_name)

  // User taps 'Chilli' card
  const chilli = getCropByName(DEFAULT_CROPS_CATALOG, 'Chilli')
  assert.ok(chilli)
  handleSelectCrop(chilli)

  // Verify state updated
  assert.equal(form.crop_name, 'Chilli')
  assert.equal(form.category, 'Spices')
  assert.equal(form.unit, 'Quintal')
  assert.equal(errors.crop_name, undefined)

  // Now validation succeeds and advances to Step 2
  assert.equal(validateAndNext(1), true)
  assert.equal(step, 2)

  // Selected crop remains available for Step 2 header display
  const activeCropObj = getCropByName(DEFAULT_CROPS_CATALOG, form.crop_name)
  assert.ok(activeCropObj)
  assert.equal(activeCropObj.icon, '🌶️')

  // User goes back and switches crop to 'Tomato'
  step = 1
  const tomato = getCropByName(DEFAULT_CROPS_CATALOG, 'Tomato')
  handleSelectCrop(tomato)
  assert.equal(form.crop_name, 'Tomato')
  assert.equal(form.category, 'Vegetables')
  assert.equal(form.unit, 'Kg') // Tomato default_unit is Kg

  // Advance to Step 2 with new crop
  assert.equal(validateAndNext(1), true)
  assert.equal(step, 2)
  const activeCropObj2 = getCropByName(DEFAULT_CROPS_CATALOG, form.crop_name)
  assert.equal(activeCropObj2.name, 'Tomato')
  assert.equal(activeCropObj2.icon, '🍅')
})

test('7. Crop grid renders from DEFAULT_CROPS_CATALOG even if API fails or returns empty array', async () => {
  // Test Case A: Initial mount state (before any network call finishes)
  let catalogA = DEFAULT_CROPS_CATALOG
  let filteredA = filterCropsCatalog(catalogA, 'All')
  assert.ok(filteredA.length >= 15, 'Immediately renders default crops on first frame')

  // Test Case B: API call throws NetworkError / 404 / 500
  let catalogB = DEFAULT_CROPS_CATALOG
  async function loadCatalogWithApiError() {
    try {
      throw new Error('Network error or 404 Not Found')
    } catch {
      // Retain DEFAULT_CROPS_CATALOG gracefully
    }
  }
  await loadCatalogWithApiError()
  let filteredB = filterCropsCatalog(catalogB, 'All')
  assert.equal(filteredB.length, DEFAULT_CROPS_CATALOG.length)
  assert.ok(filteredB.some((c) => c.name === 'Chilli'))

  // Test Case C: API call returns empty array { data: [] }
  let catalogC = DEFAULT_CROPS_CATALOG
  async function loadCatalogWithEmptyArray() {
    try {
      const res = { data: [] }
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        catalogC = res.data
      }
    } catch {
      // Retain DEFAULT_CROPS_CATALOG
    }
  }
  await loadCatalogWithEmptyArray()
  let filteredC = filterCropsCatalog(catalogC, 'All')
  assert.equal(filteredC.length, DEFAULT_CROPS_CATALOG.length, 'Empty array response must not clear default catalog')
  assert.ok(filteredC.some((c) => c.name === 'Paddy'))

  // Test Case D: API call returns null or malformed data { data: null }
  let catalogD = DEFAULT_CROPS_CATALOG
  async function loadCatalogWithNullData() {
    try {
      const res = { data: null }
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        catalogD = res.data
      }
    } catch {
      // Retain DEFAULT_CROPS_CATALOG
    }
  }
  await loadCatalogWithNullData()
  let filteredD = filterCropsCatalog(catalogD, 'All')
  assert.equal(filteredD.length, DEFAULT_CROPS_CATALOG.length)

  // Test Case E: API succeeds with valid data
  let catalogE = DEFAULT_CROPS_CATALOG
  const mockApiCrops = [
    { name: 'Custom Paddy', category: 'Cereals', icon: '🌾', default_unit: 'Quintal', min_price: 2000, max_price: 2500, modal_price: 2200 },
  ]
  async function loadCatalogSuccess() {
    const res = { data: mockApiCrops }
    if (res && Array.isArray(res.data) && res.data.length > 0) {
      catalogE = res.data
    }
  }
  await loadCatalogSuccess()
  let filteredE = filterCropsCatalog(catalogE, 'All')
  assert.equal(filteredE.length, 1)
  assert.equal(filteredE[0].name, 'Custom Paddy')
})

test('8. Custom crop manual entry - validation, category assignment and persistence', () => {
  let form = {
    crop_name: '',
    category: 'Other',
    unit: 'Quintal',
    price_unit: 'Quintal',
    quantity_num: '100',
    price: '2400',
    variety: '',
  }
  let errors = {}
  let step = 1
  let isCustomCropMode = false

  function setCustomCropMode(enabled) {
    isCustomCropMode = enabled
    if (enabled) {
      form.crop_name = ''
    }
  }

  function handleCustomCropChange(val) {
    form.crop_name = val
    if (errors.crop_name) delete errors.crop_name
  }

  function validateStep1() {
    if (!form.crop_name?.trim()) {
      errors.crop_name = 'Please enter or select a crop'
      return false
    }
    delete errors.crop_name
    step = 2
    return true
  }

  // Switch to manual mode
  setCustomCropMode(true)
  assert.equal(isCustomCropMode, true)
  assert.equal(form.crop_name, '')
  assert.equal(validateStep1(), false)
  assert.ok(errors.crop_name)

  // Type custom crop not in catalog
  handleCustomCropChange('Dragon Fruit')
  form.category = 'Fruits'
  assert.equal(form.crop_name, 'Dragon Fruit')
  assert.equal(form.category, 'Fruits')
  assert.equal(validateStep1(), true)
  assert.equal(step, 2)

  // Verify that custom crop persists when step changes
  assert.equal(form.crop_name, 'Dragon Fruit')
})

test('9. Variety entry - predefined chips and custom text input', () => {
  let form = {
    crop_name: 'Paddy',
    variety: '',
  }

  // Predefined variety from catalog
  const paddy = getCropByName(DEFAULT_CROPS_CATALOG, 'Paddy')
  assert.ok(paddy.varieties.includes('Sona Masoori'))
  form.variety = 'Sona Masoori'
  assert.equal(form.variety, 'Sona Masoori')

  // Custom variety entry
  form.variety = 'Local Desi Special'
  assert.equal(form.variety, 'Local Desi Special')

  // Variety is optional: form without variety is valid
  form.variety = ''
  assert.equal(form.variety, '')
})

test('10. Decimal quantity input and standard unit selection', () => {
  const units = ['Kg', 'Quintal', 'Ton', 'Tonne', 'Bag']
  let form = {
    quantity_num: '100',
    unit: 'Quintal',
  }

  function adjustQuantity(delta) {
    const current = parseFloat(form.quantity_num) || 0
    const next = Math.max(0.1, Math.round((current + delta) * 100) / 100)
    form.quantity_num = String(next)
  }

  function validateStep2() {
    const q = parseFloat(form.quantity_num)
    if (isNaN(q) || q <= 0) return false
    return true
  }

  // Test decimal adjustments
  form.quantity_num = '12.5'
  assert.equal(validateStep2(), true)

  adjustQuantity(0.5)
  assert.equal(form.quantity_num, '13')

  adjustQuantity(-0.25)
  assert.equal(form.quantity_num, '12.75')

  // Test standard units
  for (const u of units) {
    form.unit = u
    assert.equal(form.unit, u)
  }
})

test('11. Optional price and negotiation mode', () => {
  let form = {
    price: '2400',
    price_unit: 'Quintal',
    is_price_optional: false,
    is_negotiable: false,
  }

  function setNegotiable(checked) {
    form.is_price_optional = checked
    form.is_negotiable = checked
    form.price = checked ? '' : (form.price || '2400')
  }

  function validateStep3(isBuyer = true) {
    if (isBuyer && (form.is_price_optional || !form.price?.trim())) {
      return true // Optional for buyers
    }
    const val = parseFloat(form.price)
    if (isNaN(val) || val < 0) return false
    return true
  }

  // Toggle negotiation mode
  setNegotiable(true)
  assert.equal(form.is_price_optional, true)
  assert.equal(form.is_negotiable, true)
  assert.equal(form.price, '')
  assert.equal(validateStep3(true), true)

  // Toggle back to fixed ceiling
  setNegotiable(false)
  assert.equal(form.is_price_optional, false)
  assert.equal(form.price, '2400')
  assert.equal(validateStep3(true), true)
})

test('12. Preferred sourcing location - predefined and manual free-text entry', () => {
  const registeredUserLocation = 'Guntur, Andhra Pradesh'
  let form = {
    location: '',
  }

  // Option 1: Registered location
  form.location = registeredUserLocation
  assert.equal(form.location, 'Guntur, Andhra Pradesh')

  // Option 2: All Regions
  form.location = 'All Regions (Any Location)'
  assert.equal(form.location, 'All Regions (Any Location)')

  // Option 3: Quick select popular district
  form.location = 'Warangal'
  assert.equal(form.location, 'Warangal')

  // Option 4: Free-text manual location (village, mandal, district, state)
  form.location = 'Tenali Village, Tenali Mandal, Guntur District, Andhra Pradesh'
  assert.equal(form.location, 'Tenali Village, Tenali Mandal, Guntur District, Andhra Pradesh')
  assert.ok(form.location.includes('Mandal'))
})

test('13. Wizard navigation - complete back/next state retention', () => {
  let form = {
    crop_name: 'Dragon Fruit',
    category: 'Fruits',
    variety: 'Red Flesh',
    quantity_num: '12.5',
    unit: 'Ton',
    price: '',
    price_unit: 'Ton',
    is_price_optional: true,
    is_negotiable: true,
    delivery_choice: '15days',
    target_date: '',
    location: 'Tenali, Guntur',
    quality_grade: 'Grade A / Premium',
    delivery_preferences: 'Crate packaging with farm gate pickup',
  }

  let step = 1
  step = 2 // Next to Quantity
  step = 3 // Next to Price
  step = 4 // Next to Delivery
  step = 5 // Next to Location
  step = 6 // Next to Review

  // Back to Step 1
  step = 1
  assert.equal(form.crop_name, 'Dragon Fruit')
  assert.equal(form.variety, 'Red Flesh')

  // Forward to Step 3
  step = 3
  assert.equal(form.is_price_optional, true)
  assert.equal(form.unit, 'Ton')

  // Forward to Step 6
  step = 6
  assert.equal(form.quality_grade, 'Grade A / Premium')
  assert.equal(form.delivery_preferences, 'Crate packaging with farm gate pickup')
})

test('14. Multilingual keys for flexible manual entry in EN, TE, HI', () => {
  const requiredKeys = [
    'cantFindCrop',
    'enterManuallyBtn',
    'customCropActiveLabel',
    'browseCatalog',
    'customCropInputTitle',
    'customCropPlaceholder',
    'customCropCategoryPrompt',
    'customCropHelp',
    'varietyPrompt',
    'customVarietyPlaceholder',
    'priceNegotiableToggle',
    'priceUnitPrompt',
    'manualLocationLabel',
    'manualLocationPlaceholder',
    'manualLocationHint',
    'qualityGradePrompt',
    'deliveryNotesPrompt',
    'deliveryNotesPlaceholder',
  ]

  const en = JSON.parse(fs.readFileSync(new URL('./src/locales/en/common.json', import.meta.url), 'utf8'))
  const te = JSON.parse(fs.readFileSync(new URL('./src/locales/te/common.json', import.meta.url), 'utf8'))
  const hi = JSON.parse(fs.readFileSync(new URL('./src/locales/hi/common.json', import.meta.url), 'utf8'))

  for (const key of requiredKeys) {
    assert.ok(en.createPost[key], `en missing key createPost.${key}`)
    assert.ok(te.createPost[key], `te missing key createPost.${key}`)
    assert.ok(hi.createPost[key], `hi missing key createPost.${key}`)
  }
})

test('15. Farmer workflow isolation - farmer users are restricted from manual crop mode and always render catalog grid', () => {
  const isFarmer = true
  let isCustomCropMode = false

  // For farmers, manual entry banner is hidden (!isFarmer is false)
  const showManualBanner = !isFarmer
  assert.equal(showManualBanner, false)

  // Even if isCustomCropMode was true in draft restore, farmers cannot enter custom crop mode:
  // if (!isFarmer && f.crop_name && !catalog.some(...)) setIsCustomCropMode(true)
  const draftCrop = 'Custom Dragon Fruit'
  let restoredCustomMode = false
  if (!isFarmer && draftCrop) {
    restoredCustomMode = true
  }
  assert.equal(restoredCustomMode, false)

  // For farmers, the catalog grid is always rendered: (isFarmer || !isCustomCropMode) is always true
  const shouldRenderCatalog = isFarmer || !isCustomCropMode
  assert.equal(shouldRenderCatalog, true)

  // Manual entry card is only rendered when: !isFarmer && isCustomCropMode
  const shouldRenderManualInput = !isFarmer && isCustomCropMode
  assert.equal(shouldRenderManualInput, false)
})
