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
  'bengal gram': 'bengalGram',
  chana: 'bengalGram',
  'green gram': 'greenGram',
  moong: 'greenGram',
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

const MATCH_REASON_PATTERNS = [
  {
    regex: /^Direct crop match for (.+)$/i,
    format: (t, [, crop]) => t('matches.reasons.directCrop', { crop: translateCropName(t, crop) }),
  },
  {
    regex: /^Price matched: Buyer offer \(₹([\d.,]+)\) meets your asking price \(₹([\d.,]+)\)$/i,
    format: (t, [, offer, asking]) => t('matches.reasons.priceMetFarmer', { offer, asking }),
  },
  {
    regex: /^Price negotiable: Buyer budget \(₹([\d.,]+)\) close to your rate \(₹([\d.,]+)\)$/i,
    format: (t, [, offer, asking]) => t('matches.reasons.priceCloseFarmer', { offer, asking }),
  },
  {
    regex: /^Buyer offer is ₹([\d.,]+) below your asking price \(₹([\d.,]+)\)$/i,
    format: (t, [, diff, asking]) => t('matches.reasons.priceBelowFarmer', { diff, asking }),
  },
  {
    regex: /^Within (?:your )?budget: Farmer rate \(₹([\d.,]+)\) (?:is within your budget|meets your requirement budget) \(₹([\d.,]+)\)$/i,
    format: (t, [, rate, budget]) => t('matches.reasons.priceMetIndustry', { rate, budget }),
  },
  {
    regex: /^(?:Close to budget|Slightly above your budget – negotiation may be possible): Farmer asking ₹([\d.,]+) vs your budget ₹([\d.,]+)$/i,
    format: (t, [, asking, budget]) => t('matches.reasons.priceCloseIndustry', { asking, budget }),
  },
  {
    regex: /^Exceeds your budget by ₹([\d.,]+): Farmer asking ₹([\d.,]+) vs your budget ₹([\d.,]+)$/i,
    format: (t, [, diff, asking, budget]) => t('matches.reasons.priceExceedsIndustry', { diff, asking, budget }),
  },
  {
    regex: /^Volume compatibility: (?:Buyer needs|Farmer has) (.+?)(?: available)?$/i,
    format: (t, [, qty]) => t('matches.reasons.volumeBuyer', { qty: translateUnit(t, qty) }),
  },
  {
    regex: /^Delivery requirement: (?:Needed by )?(.+)$/i,
    format: (t, [, del]) => t('matches.reasons.deliveryReq', { delivery: del }),
  },
  {
    regex: /^Delivery timeline: Available (.+)$/i,
    format: (t, [, del]) => t('matches.reasons.deliveryTimeline', { delivery: del }),
  },
  {
    regex: /^Open to all sourcing regions$/i,
    format: (t) => t('matches.reasons.openSourcingRegions'),
  },
  {
    regex: /^Active listing for high-demand (.+)$/i,
    format: (t, [, crop]) => t('matches.reasons.activeDemand', { crop: translateCropName(t, crop) }),
  },
  {
    regex: /^Same district\/region: (.+)$/i,
    format: (t, [, loc]) => t('matches.reasons.sameDistrict', { location: loc }),
  },
  {
    regex: /^Located in: (.+)$/i,
    format: (t, [, loc]) => t('matches.reasons.locatedIn', { location: loc }),
  },
  {
    regex: /^Direct Call and WhatsApp verified$/i,
    format: (t) => t('matches.reasons.directContact'),
  },
]

/** Translates an explainable SmartMatch reason string into user's selected language. */
export function translateMatchReason(t, reason) {
  if (!reason || typeof reason !== 'string') return reason
  for (const { regex, format } of MATCH_REASON_PATTERNS) {
    const match = reason.match(regex)
    if (match) {
      return format(t, match)
    }
  }
  return reason
}

/** Translates an approximate distance badge string (Nearby / Regional / Open). */
export function translateDistance(t, dist) {
  if (!dist || typeof dist !== 'string') return dist
  const cleaned = dist.toLowerCase().trim()
  if (cleaned.includes('nearby') || cleaned.includes('< 50')) {
    return t('matches.distance.nearby', 'Nearby (< 50 km)')
  }
  if (cleaned.includes('regional')) {
    return t('matches.distance.regional', 'Regional')
  }
  if (cleaned.includes('open') || cleaned.includes('any')) {
    return t('matches.distance.open', 'Any Region')
  }
  return dist
}
