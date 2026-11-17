import test from 'node:test'
import assert from 'node:assert/strict'
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
