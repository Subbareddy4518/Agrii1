/**
 * Master Crop Benchmark Catalog and Utilities for AgriConnect 2.0.
 *
 * Provides a production-grade, offline-resilient static catalog of benchmark crops
 * across all 6 agricultural categories (Cereals, Vegetables, Spices, Cash Crops, Pulses, Fruits).
 *
 * This ensures the crop selection interface renders immediately with zero layout shift
 * and zero network latency, even under high latency rural networks or temporary backend downtime.
 */

export const DEFAULT_CROPS_CATALOG = [
  {
    name: 'Paddy',
    category: 'Cereals',
    telugu: 'వరి (Paddy)',
    hindi: 'धान (Paddy)',
    icon: '🌾',
    default_unit: 'Quintal',
    min_price: 2183.0,
    max_price: 2450.0,
    modal_price: 2300.0,
    varieties: ['Sona Masoori', 'BPT 5204 (Samba Masoori)', 'IR 64', 'Basmati', 'RNR 15048 (Telangana Sona)'],
    keywords: ['paddy', 'rice', 'vari', 'dhaan', 'dhan', 'chawal', 'sona masoori', 'bpt', 'rnr', 'వరి', 'వరి ధాన్యం', 'ధాన్యం', 'బియ్యం', 'धान', 'चावल'],
  },
  {
    name: 'Cotton',
    category: 'Cash Crops',
    telugu: 'పత్తి (Cotton)',
    hindi: 'कपास (Cotton)',
    icon: '☁️',
    default_unit: 'Quintal',
    min_price: 6800.0,
    max_price: 7650.0,
    modal_price: 7250.0,
    varieties: ['Bunny BT', 'RCH-2', 'DCH-32', 'Long Staple', 'Medium Staple'],
    keywords: ['cotton', 'patti', 'kapas', 'kapaas', 'ruwi', 'bunny', 'rch', 'పత్తి', 'కపాస్', 'कपास'],
  },
  {
    name: 'Chilli',
    category: 'Spices',
    telugu: 'మిర్చి (Chilli)',
    hindi: 'लाल मिर्च (Chilli)',
    icon: '🌶️',
    default_unit: 'Quintal',
    min_price: 14000.0,
    max_price: 19500.0,
    modal_price: 16800.0,
    varieties: ['Teja', 'Guntur Sannam (S4)', 'Byadgi', 'Wonder Hot', 'Armoor'],
    keywords: ['chilli', 'chili', 'mirchi', 'mirch', 'teja', 'guntur sannam', 'byadgi', 'మిర్చి', 'మిరపకాయ', 'మిరప', 'ఎండుమిర్చి', 'मिर्च', 'लाल मिर्च'],
  },
  {
    name: 'Tomato',
    category: 'Vegetables',
    telugu: 'టమాట (Tomato)',
    hindi: 'टमाटर (Tomato)',
    icon: '🍅',
    default_unit: 'Kg',
    min_price: 18.0,
    max_price: 32.0,
    modal_price: 24.0,
    varieties: ['Vaishnavi', 'Saaho', 'Abhinav', 'Desi Organic', 'Hybrid 1057'],
    keywords: ['tomato', 'tamata', 'tamatar', 'tomatoes', 'saaho', 'vaishnavi', 'టమాటా', 'టమాట', 'టొమాటో', 'टमाटर'],
  },
  {
    name: 'Maize',
    category: 'Cereals',
    telugu: 'మొక్కజొన్న (Maize)',
    hindi: 'मक्का (Maize)',
    icon: '🌽',
    default_unit: 'Quintal',
    min_price: 1950.0,
    max_price: 2280.0,
    modal_price: 2100.0,
    varieties: ['Pioneer 30V92', 'NK 6240', 'DKC 9108', 'Yellow Maize', 'Sweet Corn'],
    keywords: ['maize', 'corn', 'mokkajonna', 'makka', 'bhutta', 'pioneer', 'మొక్కజొన్న', 'మక్క', 'మక్కా', 'मक्का', 'भुट्टा'],
  },
  {
    name: 'Onion',
    category: 'Vegetables',
    telugu: 'ఉల్లిపాయ (Onion)',
    hindi: 'प्याज (Onion)',
    icon: '🧅',
    default_unit: 'Kg',
    min_price: 22.0,
    max_price: 40.0,
    modal_price: 30.0,
    varieties: ['Nasik Red', 'Garwa', 'Pune Fursungi', 'Bellary Red', 'White Onion'],
    keywords: ['onion', 'ulli', 'ullipaya', 'pyaj', 'pyaaz', 'kanda', 'nasik red', 'ఉల్లిపాయ', 'ఉల్లి', 'ఎర్రగడ్డ', 'प्याज', 'कांदा'],
  },
  {
    name: 'Groundnut',
    category: 'Cash Crops',
    telugu: 'వేరుశనగ (Groundnut)',
    hindi: 'मूंगफली (Groundnut)',
    icon: '🥜',
    default_unit: 'Quintal',
    min_price: 6200.0,
    max_price: 7100.0,
    modal_price: 6650.0,
    varieties: ['Kadiri-6 (K-6)', 'TAG-24', 'JL-24', 'Dharani', 'Bold'],
    keywords: ['groundnut', 'peanut', 'verusenaga', 'mungfali', 'moongfali', 'kadiri', 'k6', 'వేరుశనగ', 'పల్లీలు', 'పల్లీ', 'मूंगफली'],
  },
  {
    name: 'Red Gram',
    category: 'Pulses',
    telugu: 'కందులు (Red Gram)',
    hindi: 'अरहर / तूर (Toor Dal)',
    icon: '🫘',
    default_unit: 'Quintal',
    min_price: 6800.0,
    max_price: 7600.0,
    modal_price: 7150.0,
    varieties: ['Asha (ICPL 87119)', 'Maruti (ICP 8863)', 'PRG 176', 'White Toor'],
    keywords: ['red gram', 'toor', 'tur', 'kandulu', 'arhar', 'pigeon pea', 'asha', 'కందులు', 'కందిపప్పు', 'अरहर', 'तूर'],
  },
  {
    name: 'Turmeric',
    category: 'Spices',
    telugu: 'పసుపు (Turmeric)',
    hindi: 'हल्दी (Turmeric)',
    icon: '🟡',
    default_unit: 'Quintal',
    min_price: 12500.0,
    max_price: 17200.0,
    modal_price: 14800.0,
    varieties: ['Nizamabad Finger', 'Salem', 'Duggirala', 'Prathibha'],
    keywords: ['turmeric', 'pasupu', 'haldi', 'nizamabad', 'finger turmeric', 'పసుపు', 'हल्दी'],
  },
  {
    name: 'Wheat',
    category: 'Cereals',
    telugu: 'గోధుమలు (Wheat)',
    hindi: 'गेहूं (Wheat)',
    icon: '🌾',
    default_unit: 'Quintal',
    min_price: 2275.0,
    max_price: 2600.0,
    modal_price: 2420.0,
    varieties: ['Sharbati', 'Lok-1', 'HD 2967', 'GW 322', 'Desi Wheat'],
    keywords: ['wheat', 'godhumalu', 'gehu', 'sharbati', 'lok1', 'గోధుమలు', 'గోధుమ', 'गेहूं'],
  },
  {
    name: 'Mango',
    category: 'Fruits',
    telugu: 'మామిడి (Mango)',
    hindi: 'आम (Mango)',
    icon: '🥭',
    default_unit: 'Kg',
    min_price: 45.0,
    max_price: 95.0,
    modal_price: 68.0,
    varieties: ['Banganapalli', 'Alphonso', 'Totapuri', 'Dasheri', 'Kesar', 'Rasalu'],
    keywords: ['mango', 'mamidi', 'aam', 'banganapalli', 'alphonso', 'totapuri', 'rasalu', 'మామిడి', 'మామిడికాయ', 'आम'],
  },
  {
    name: 'Sugarcane',
    category: 'Cash Crops',
    telugu: 'చెరకు (Sugarcane)',
    hindi: 'गन्ना (Sugarcane)',
    icon: '🎋',
    default_unit: 'Quintal',
    min_price: 315.0,
    max_price: 345.0,
    modal_price: 330.0,
    varieties: ['Co 86032', 'Co 0238', 'CoM 0265'],
    keywords: ['sugarcane', 'cheraku', 'ganna', 'sugar cane', 'చెరకు', 'చెరుకు', 'गन्ना'],
  },
  {
    name: 'Banana',
    category: 'Fruits',
    telugu: 'అరటి (Banana)',
    hindi: 'केला (Banana)',
    icon: '🍌',
    default_unit: 'Kg',
    min_price: 16.0,
    max_price: 28.0,
    modal_price: 22.0,
    varieties: ['Grand Naine (G9)', 'Robusta', 'Yelakki', 'Red Banana', 'Karpuravalli'],
    keywords: ['banana', 'arati', 'kela', 'grand naine', 'yelakki', 'అరటి', 'అరటిపండు', 'केला'],
  },
  {
    name: 'Potato',
    category: 'Vegetables',
    telugu: 'బంగాళాదుంప (Potato)',
    hindi: 'आलू (Potato)',
    icon: '🥔',
    default_unit: 'Kg',
    min_price: 18.0,
    max_price: 28.0,
    modal_price: 23.0,
    varieties: ['Kufri Jyoti', 'Kufri Pukhraj', 'Chipsona', 'Desi Red'],
    keywords: ['potato', 'bangaladumpa', 'aloo', 'alu', 'potatoes', 'బంగాళాదుంప', 'బంగాళదుంప', 'ఆలూ', 'आलू'],
  },
  {
    name: 'Soybean',
    category: 'Pulses',
    telugu: 'సోయాబీన్ (Soybean)',
    hindi: 'सोयाबीन (Soybean)',
    icon: '🌱',
    default_unit: 'Quintal',
    min_price: 4300.0,
    max_price: 4900.0,
    modal_price: 4600.0,
    varieties: ['JS 335', 'JS 93-05', 'MACS 1407'],
    keywords: ['soybean', 'soya', 'soyabean', 'సోయాబీన్', 'सोयाबीन'],
  },
  {
    name: 'Bengal Gram',
    category: 'Pulses',
    telugu: 'శనగలు (Bengal Gram)',
    hindi: 'चना (Chana)',
    icon: '🫘',
    default_unit: 'Quintal',
    min_price: 5200.0,
    max_price: 6100.0,
    modal_price: 5650.0,
    varieties: ['JG 11', 'JAKI 9218', 'Desi Chana', 'Kabuli Chana'],
    keywords: ['bengal gram', 'chana', 'chickpea', 'senagalu', 'శనగలు', 'చనా', 'चना'],
  },
  {
    name: 'Green Gram',
    category: 'Pulses',
    telugu: 'పెసలు (Green Gram)',
    hindi: 'मूंग (Moong)',
    icon: '🫘',
    default_unit: 'Quintal',
    min_price: 7500.0,
    max_price: 8600.0,
    modal_price: 8100.0,
    varieties: ['WGG 42', 'MGG 295', 'IPM 02-03', 'Shiny Moong'],
    keywords: ['green gram', 'moong', 'pesalu', 'mung', 'పెసలు', 'मूंग'],
  },
]

/**
 * Find a crop item by name (case-insensitive) in any catalog.
 */
export function getCropByName(catalog, cropName) {
  if (!catalog || !Array.isArray(catalog) || !cropName) return null
  const target = String(cropName).trim().toLowerCase()
  return catalog.find((c) => (c?.name || '').trim().toLowerCase() === target) || null
}

/**
 * Filter crops by category and optional search term.
 * Safe against undefined or malformed objects.
 */
export function filterCropsCatalog(catalog, selectedCategory = 'All', search = '') {
  if (!catalog || !Array.isArray(catalog)) return []

  const catTarget = (selectedCategory || 'All').trim().toLowerCase()
  const searchLower = (search || '').trim().toLowerCase()

  return catalog.filter((crop) => {
    if (!crop || !crop.name) return false

    // Category filter
    const matchesCategory =
      catTarget === 'all' || (crop.category || '').trim().toLowerCase() === catTarget

    // Search filter
    const matchesSearch =
      !searchLower ||
      (crop.name && crop.name.toLowerCase().includes(searchLower)) ||
      (crop.telugu && crop.telugu.toLowerCase().includes(searchLower)) ||
      (crop.hindi && crop.hindi.toLowerCase().includes(searchLower)) ||
      (Array.isArray(crop.keywords) &&
        crop.keywords.some((kw) => typeof kw === 'string' && kw.toLowerCase().includes(searchLower)))

    return matchesCategory && matchesSearch
  })
}
