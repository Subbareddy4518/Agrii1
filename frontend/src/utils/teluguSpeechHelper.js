/**
 * Natural Telugu Conversational Voice Helper for AgriConnect.
 * Understands regional spoken Telugu, crop synonyms, numbers, units, delivery times, and affirmations.
 */

// Master crop synonyms for Telugu speech recognition
export const TELUGU_CROP_SYNONYMS = {
  Paddy: ['వరి', 'వరి ధాన్యం', 'ధాన్యం', 'వడ్లు', 'బియ్యం', 'సోనా మసూరి', 'బాస్మతి', 'బిపిటి', 'paddy', 'rice', 'vari', 'vadlu'],
  Cotton: ['పత్తి', 'దూది', 'కపాస్', 'కాటన్', 'బన్నీ', 'cotton', 'patti', 'kapas'],
  Chilli: ['మిర్చి', 'మిరప', 'మిరపకాయ', 'ఎండుమిర్చి', 'పచ్చిమిర్చి', 'తేజ', 'గుంటూరు', 'chilli', 'chili', 'mirchi'],
  Tomato: ['టమాట', 'టమాటా', 'టొమాటో', 'tomato', 'tamata'],
  Maize: ['మొక్కజొన్న', 'మక్క', 'మక్కా', 'జొన్న', 'maize', 'corn', 'mokkajonna'],
  Onion: ['ఉల్లిపాయ', 'ఉల్లి', 'ఎర్రగడ్డ', 'onion', 'ulli', 'ullipaya'],
  Groundnut: ['వేరుశనగ', 'పల్లీలు', 'పల్లీ', 'వేరుశనక్కాయలు', 'groundnut', 'peanut', 'verusenaga', 'palleelu'],
  'Red Gram': ['కందులు', 'కందిపప్పు', 'తూర్', 'తోర్', 'red gram', 'toor', 'kandulu'],
  Turmeric: ['పసుపు', 'కొమ్ము పసుపు', 'turmeric', 'pasupu'],
  Wheat: ['గోధుమలు', 'గోధుమ', 'wheat', 'godhumalu'],
  Mango: ['మామిడి', 'మామిడికాయ', 'మామిడిపండు', 'బంగినపల్లి', 'mango', 'mamidi'],
  Sugarcane: ['చెరకు', 'చెరుకు', 'sugarcane', 'cheraku'],
  Banana: ['అరటి', 'అరటిపండు', 'అరటికాయ', 'banana', 'arati'],
  Potato: ['బంగాళాదుంప', 'ఆలు', 'ఆలూ', 'potato', 'bangaladumpa', 'aalu'],
  Soybean: ['సోయాబీన్', 'సోయా', 'soybean', 'soya'],
}

// Common spoken Telugu numbers
const TELUGU_WORD_TO_NUMBER = {
  'ఒకటి': 1, 'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5,
  'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
  'పదకొండు': 11, 'పన్నెండు': 12, 'పదమూడు': 13, 'పద్నాలుగు': 14, 'పదిహేను': 15,
  'పదహారు': 16, 'పదిహేడు': 17, 'పద్దెనిమిది': 18, 'పందొమ్మిది': 19,
  'ఇరవై': 20, 'ఇరవై ఐదు': 25, 'ముప్పై': 30, 'నలభై': 40, 'యాభై': 50,
  'అరవై': 60, 'డెబ్బై': 70, 'ఎనభై': 80, 'తొంభై': 90,
  'వంద': 100, 'రెండు వందలు': 200, 'ఐదు వందలు': 500, 'వెయ్యి': 1000,
  'రెండు వేలు': 2000, 'మూడు వేలు': 3000,
}

/**
 * Parses spoken text to find a matching Crop.
 */
export function parseTeluguCrop(text) {
  if (!text) return null
  const cleaned = text.toLowerCase().trim()

  for (const [canonical, synonyms] of Object.entries(TELUGU_CROP_SYNONYMS)) {
    for (const syn of synonyms) {
      if (cleaned.includes(syn.toLowerCase())) {
        return canonical
      }
    }
  }
  return null
}

/**
 * Parses spoken text to extract Quantity and Unit.
 */
export function parseTeluguQuantity(text) {
  if (!text) return null
  const cleaned = text.toLowerCase().trim()

  // 1. Detect Unit
  let unit = 'Quintal' // Default for Indian agriculture
  if (cleaned.includes('కిలో') || cleaned.includes('కేజీ') || cleaned.includes('kg') || cleaned.includes('kilo')) {
    unit = 'Kg'
  } else if (cleaned.includes('టన్ను') || cleaned.includes('ton') || cleaned.includes('tonne')) {
    unit = 'Ton'
  } else if (cleaned.includes('క్వింటాల్') || cleaned.includes('క్వింటా') || cleaned.includes('quintal') || cleaned.includes('qtl')) {
    unit = 'Quintal'
  } else if (cleaned.includes('బస్తా') || cleaned.includes('బస్తాలు')) {
    unit = 'Quintal' // 2 bags = ~1 quintal, default quintal
  }

  // 2. Extract numeric digits
  const digitMatch = cleaned.match(/\d+(?:\.\d+)?/)
  if (digitMatch) {
    const val = parseFloat(digitMatch[0])
    if (val > 0) {
      return { quantity: String(val), unit }
    }
  }

  // 3. Extract word numbers
  for (const [word, num] of Object.entries(TELUGU_WORD_TO_NUMBER)) {
    if (cleaned.includes(word)) {
      return { quantity: String(num), unit }
    }
  }

  return null
}

/**
 * Parses spoken text to extract Price and Unit.
 */
export function parseTeluguPrice(text) {
  if (!text) return null
  const cleaned = text.toLowerCase().trim()

  // Detect price unit
  let price_unit = 'Quintal'
  if (cleaned.includes('కిలో') || cleaned.includes('kg')) {
    price_unit = 'Kg'
  } else if (cleaned.includes('టన్ను') || cleaned.includes('ton')) {
    price_unit = 'Ton'
  }

  // Extract digits (often prices are 2000, 2350, 16000, 25, 40)
  const digitMatch = cleaned.match(/\d+(?:\.\d+)?/)
  if (digitMatch) {
    const val = parseFloat(digitMatch[0])
    if (val > 0) {
      return { price: String(val), price_unit }
    }
  }

  // Telugu word numbers for thousands
  for (const [word, num] of Object.entries(TELUGU_WORD_TO_NUMBER)) {
    if (cleaned.includes(word)) {
      return { price: String(num), price_unit }
    }
  }

  return null
}

/**
 * Parses spoken text to extract Delivery Choice (Today, Tomorrow, Custom).
 */
export function parseTeluguDelivery(text) {
  if (!text) return null
  const cleaned = text.toLowerCase().trim()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  if (
    cleaned.includes('ఈరోజే') ||
    cleaned.includes('ఈరోజు') ||
    cleaned.includes('ఇప్పుడే') ||
    cleaned.includes('నేడు') ||
    cleaned.includes('today')
  ) {
    return { choice: 'today', target_date: todayStr, label: 'ఈరోజే' }
  }

  if (
    cleaned.includes('రేపు') ||
    cleaned.includes('మరుసటి రోజు') ||
    cleaned.includes('tomorrow')
  ) {
    return { choice: 'tomorrow', target_date: tomorrowStr, label: 'రేపు' }
  }

  if (
    cleaned.includes('ఎల్లుండి') ||
    cleaned.includes('రెండు రోజులు') ||
    cleaned.includes('మూడు రోజులు') ||
    cleaned.includes('వారం') ||
    cleaned.includes('తర్వాత') ||
    cleaned.includes('తేదీ')
  ) {
    // Default to 3 days future
    const future = new Date(today)
    future.setDate(future.getDate() + 3)
    return { choice: 'custom', target_date: future.toISOString().split('T')[0], label: '3 రోజుల్లో' }
  }

  return null
}

/**
 * Parses spoken response for Affirmation/Confirmation or Rejection/Correction.
 */
export function parseTeluguConfirmation(text) {
  if (!text) return null
  const cleaned = text.toLowerCase().trim()

  // Affirmations (Yes / Publish)
  const yesWords = [
    'అవును', 'సరే', 'పోస్ట్ చేయండి', 'హా', 'ఖరారు', 'ఆమోదం', 'చేయండి', 'సరిపోయింది',
    'బాగుంది', 'ఓకే', 'yes', 'post', 'ok', 'okay', 'confirm'
  ]
  for (const w of yesWords) {
    if (cleaned.includes(w)) return 'confirm'
  }

  // Rejections / Corrections (No / Edit)
  const noWords = [
    'కాదు', 'మార్చాలి', 'తప్పు', 'సరికాదు', 'మళ్లీ', 'మార్చు', 'నో', 'no', 'change', 'edit', 'cancel'
  ]
  for (const w of noWords) {
    if (cleaned.includes(w)) return 'reject'
  }

  return null
}

/**
 * Returns conversational Telugu prompts for AI Voice Assistant.
 */
export const TELUGU_VOICE_CONVERSATION = {
  welcome: 'నమస్కారం! మాట్లాడి పంటను సులభంగా పోస్ట్ చేద్దాం. మైక్రోఫోన్ బటన్ నొక్కి మాట్లాడండి.',
  q1Crop: 'మీ వద్ద ఏ పంట ఉంది? ఉదాహరణకు వరి, పత్తి, మిర్చి, టమాట...',
  q1Confirm: (crop) => `మీరు ${crop} అని చెప్పారు. సరిగ్గానే ఉందా?`,
  q1Retry: 'క్షమించండి, మీ పంట పేరు స్పష్టంగా వినపడలేదు. దయచేసి మళ్లీ చెప్పండి.',
  
  q2Qty: (crop) => `${crop} పంట ఎంత పరిమాణం ఉంది? ఉదాహరణకు యాభై క్వింటాళ్లు లేదా వంద కిలోలు...`,
  q2Confirm: (qty, unit) => `${qty} ${unit} అని నమోదు చేశాను.`,
  q2Retry: 'క్షమించండి, పరిమాణం అర్థం కాలేదు. దయచేసి సంఖ్య మరియు యూనిట్ చెప్పండి.',

  q3Price: (unit) => `ఒక ${unit} కు మీరు ఆశించే ధర ఎంత? ఉదాహరణకు రెండు వేల మూడు వందల యాభై రూపాయలు...`,
  q3Confirm: (price, unit) => `ఒక ${unit} కు ₹${price} గా నమోదు చేశాను.`,
  q3Retry: 'క్షమించండి, ధర సరిగ్గా వినపడలేదు. దయచేసి ధర ఎంత రూపాయలో చెప్పండి.',

  q4Delivery: 'మీ పంటను ఎప్పుడు అందించగలరు? ఈరోజేనా, రేపా, లేదా వేరే రోజా?',
  q4Confirm: (delivery) => `డెలివరీ సమయం ${delivery} గా నమోదు చేశాను.`,
  q4Retry: 'దయచేసి డెలివరీ ఎప్పుడో చెప్పండి. ఈరోజేనా లేదా రేపా?',

  finalReview: ({ crop, qty, unit, price, price_unit, delivery }) =>
    `మీ పంట వివరాలు ఇవి: పంట ${crop}, పరిమాణం ${qty} ${unit}, ఆశించే ధర ₹${price} ${price_unit} కు, డెలివరీ సమయం ${delivery}. మీ పంటను మార్కెట్లో పోస్ట్ చేయమంటారా? 'అవును' లేదా 'పోస్ట్ చేయండి' అని చెప్పండి.`,

  publishedSuccess: 'మీ పంట విజయవంతంగా మార్కెట్లో పోస్ట్ చేయబడింది! కొనుగోలుదారులు త్వరలోనే చూస్తారు.',
}
