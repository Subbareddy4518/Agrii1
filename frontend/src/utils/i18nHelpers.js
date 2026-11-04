// Backend responses stay in English (per spec — the API is never
// modified). These helpers translate the *known, finite* vocabulary
// that the backend sends — crop names, units, categories, roles,
// post status, and a handful of notification phrasings — for display.
//
// Every helper takes the `t` function from useTranslation() as its
// first argument and the raw backend string as its second, so call
// sites stay simple: translateCropName(t, post.crop_name).
//
// Anything the backend sends that we don't recognize (a crop not in
// the fixed list, a custom notification message, etc.) is returned
// unchanged rather than left blank — untranslated real data is always
// better than losing information.

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const CROP_KEYS = {
  rice: 'rice',
  paddy: 'paddy',
  cotton: 'cotton',
  tomato: 'tomato',
  tomatoes: 'tomato',
  potato: 'potato',
  potatoes: 'potato',
  banana: 'banana',
  bananas: 'banana',
  groundnut: 'groundnut',
  groundnuts: 'groundnut',
  peanut: 'groundnut',
  peanuts: 'groundnut',
  onion: 'onion',
  onions: 'onion',
  chilli: 'chilli',
  chili: 'chilli',
  chillies: 'chilli',
  chilies: 'chilli',
  maize: 'maize',
  corn: 'maize',
  wheat: 'wheat',
  mango: 'mango',
  mangoes: 'mango',
  mangos: 'mango',
  sugarcane: 'sugarcane',
  'sugar cane': 'sugarcane',
  'red gram': 'redGram',
  toor: 'redGram',
  tur: 'redGram',
  kandulu: 'redGram',
  turmeric: 'turmeric',
  pasupu: 'turmeric',
  haldi: 'turmeric',
  soybean: 'soybean',
}

const UNIT_KEYS = {
  kg: 'kg',
  kgs: 'kg',
  ton: 'ton',
  tons: 'ton',
  tonne: 'ton',
  tonnes: 'ton',
  quintal: 'quintal',
  quintals: 'quintal',
  bag: 'bag',
  bags: 'bag',
  packet: 'packet',
  packets: 'packet',
  bundle: 'bundle',
  bundles: 'bundle',
}

const AGRI_CATEGORY_KEYS = {
  all: 'all',
  cereals: 'cereals',
  cereal: 'cereals',
  vegetables: 'vegetables',
  vegetable: 'vegetables',
  spices: 'spices',
  spice: 'spices',
  'cash crops': 'cashCrops',
  'cash crop': 'cashCrops',
  pulses: 'pulses',
  pulse: 'pulses',
  fruits: 'fruits',
  fruit: 'fruits',
}

export function translateAgriCategory(t, category) {
  if (!category) return category
  const key = AGRI_CATEGORY_KEYS[normalize(category)]
  return key ? t(`agriCategories.${key}`) : category
}

const ROLE_KEYS = {
  farmer: 'farmer',
  farmers: 'farmer',
  industry: 'industry',
  industries: 'industry',
}

const STATUS_KEYS = {
  active: 'active',
  open: 'active',
  sold: 'sold',
  fulfilled: 'fulfilled',
  closed: 'closed',
  expired: 'expired',
}

/** Translates a crop name coming from the backend (e.g. "Tomato"). */
export function translateCropName(t, cropName) {
  const key = CROP_KEYS[normalize(cropName)]
  return key ? t(`crops.${key}`) : cropName
}

/**
 * Translates a unit that may appear on its own ("Kg") or as a suffix
 * inside a free-text quantity string ("500 kg", "2 Ton"). Only the
 * recognized unit word is swapped; the number and spacing are kept.
 */
export function translateUnit(t, unit) {
  if (!unit) return unit
  const trimmed = String(unit).trim()

  const directKey = UNIT_KEYS[normalize(trimmed)]
  if (directKey) return t(`units.${directKey}`)

  const match = trimmed.match(/^(.*\d[\d.,]*\s*)([a-zA-Z]+)$/)
  if (match) {
    const [, prefix, word] = match
    const key = UNIT_KEYS[normalize(word)]
    if (key) return `${prefix}${t(`units.${key}`)}`
  }
  return unit
}

/** Translates a post category ("Crop" / "Requirement"). */
export function translateCategory(t, category) {
  const key = CATEGORY_KEYS[normalize(category)]
  return key ? t(`categories.${key}`) : category
}

/** Translates a user role ("farmer" / "industry"). */
export function translateRole(t, role) {
  const key = ROLE_KEYS[normalize(role)]
  return key ? t(`roles.${key}`) : role
}

/** Translates a post status ("active" / "sold" / "closed" / ...). */
export function translatePostStatus(t, status) {
  const key = STATUS_KEYS[normalize(status)]
  return key ? t(`postStatus.${key}`) : status
}
