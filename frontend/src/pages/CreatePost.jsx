import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  RotateCcw,
  Layers,
  HelpCircle,
  Building2,
  Globe,
  Compass,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import OtpVerificationModal from '../components/OtpVerificationModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createPost, getCropsCatalog, getPriceGuidance } from '../services/api.js'
import { translateCropName, translateUnit, translateAgriCategory } from '../utils/i18nHelpers.js'
import { getSelectedLanguage, speak, stopSpeaking } from '../utils/onboarding.js'
import { DEFAULT_CROPS_CATALOG, filterCropsCatalog } from '../utils/cropsData.js'

const CATEGORIES = ['All', 'Cereals', 'Vegetables', 'Spices', 'Cash Crops', 'Pulses', 'Fruits']
const STANDARD_UNITS = ['Kg', 'Quintal', 'Ton', 'Bag']
const DRAFT_KEY_PREFIX = 'agriconnect_draft_post_'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Helper to safely sanitize crop icons and prevent displaying "svg" text or placeholders
function getSafeCropIcon(icon) {
  if (!icon || typeof icon !== 'string') return '🌿'
  const trimmed = icon.trim()
  if (trimmed.toLowerCase() === 'svg' || trimmed.toLowerCase().includes('.svg') || trimmed.startsWith('<svg')) {
    return '🌿'
  }
  return trimmed
}

// Common districts in Andhra Pradesh & Telangana for instant one-touch buyer selection
const POPULAR_SOURCING_DISTRICTS = [
  'Guntur',
  'Warangal',
  'Kurnool',
  'Krishna',
  'Khammam',
  'Nalgonda',
  'Nizamabad',
  'Anantapur',
  'East Godavari',
  'West Godavari',
]

// Helper to get formatted date string 'YYYY-MM-DD'
function getOffsetDateString(daysOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().split('T')[0]
}

export default function CreatePost() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const isFarmer = user?.role === 'farmer'
  const currentLang = i18n.language || getSelectedLanguage()
  const ttsLang = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN'

  // Total steps: Farmer has 5 (4 questions + Review), Buyer has 6 (5 questions + Review)
  const totalQuestions = isFarmer ? 4 : 5
  const reviewStep = isFarmer ? 5 : 6

  // Authenticated user-scoped draft key
  const draftKey = user?.id ? `${DRAFT_KEY_PREFIX}${user.id}` : null
  const [draftRestored, setDraftRestored] = useState(false)
  const isDraftLoadedRef = useRef(false)

  // Guided wizard step state
  const [step, setStep] = useState(1)

  // Audio instruction indicator
  const [isSpeakingInstruction, setIsSpeakingInstruction] = useState(false)

  // Master Crops Catalog (initialized with offline-resilient default benchmark crops)
  const [catalog, setCatalog] = useState(DEFAULT_CROPS_CATALOG)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [cropSearch, setCropSearch] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [isCustomCropMode, setIsCustomCropMode] = useState(false)

  // Posting Information State + Profile Fallbacks
  const [form, setForm] = useState({
    // Step 1: Crop
    crop_name: '',
    category: '',
    // Step 2: Quantity
    quantity_num: isFarmer ? '50' : '100',
    unit: 'Quintal',
    // Step 3: Price
    price: isFarmer ? '2350' : '2400',
    price_unit: 'Quintal',
    is_negotiable: false,
    is_price_optional: false,
    // Step 4: Delivery
    delivery_choice: isFarmer ? 'today' : '15days',
    target_date: isFarmer ? getOffsetDateString(0) : getOffsetDateString(15),
    time_of_day: 'anytime',
    // Step 5 (Buyer): Preferred Sourcing Location
    location: user?.location || '',
    // Optional / Profile defaults
    variety: '',
    quality_grade: 'Grade A / Premium',
    title: '',
    description: '',
    delivery_preferences: '',
    image: null,
  })

  // Validation Error States
  const [errors, setErrors] = useState({})

  // Mandi Price Guidance
  const [priceGuidance, setPriceGuidance] = useState(null)
  const [loadingGuidance, setLoadingGuidance] = useState(false)

  // Optional Section Toggle in Review Step
  const [showOptionalDetails, setShowOptionalDetails] = useState(false)

  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const isPublishingRef = useRef(false)
  const [publishedPost, setPublishedPost] = useState(null)
  const [showOtpModal, setShowOtpModal] = useState(false)

  // Load Crops Catalog on mount (updates static catalog with backend benchmarks if reachable)
  useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      setLoadingCatalog(true)
      try {
        const res = await getCropsCatalog()
        if (isMounted && res && Array.isArray(res.data) && res.data.length > 0) {
          setCatalog(res.data)
        }
      } catch {
        // Retain DEFAULT_CROPS_CATALOG gracefully on network failure, timeout, or 404
      } finally {
        if (isMounted) {
          setLoadingCatalog(false)
        }
      }
    }
    loadCatalog()
    return () => {
      isMounted = false
    }
  }, [])

  // Restore saved draft on mount
  useEffect(() => {
    if (!draftKey) {
      isDraftLoadedRef.current = true
      return
    }

    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        const age = Date.now() - (parsed.timestamp || 0)
        if (age > DRAFT_MAX_AGE_MS) {
          localStorage.removeItem(draftKey)
        } else if (parsed.form && typeof parsed.form === 'object') {
          const f = parsed.form
          const hasData = Boolean(
            f.crop_name || f.quantity_num || f.price || f.target_date
          )
          if (hasData) {
            setForm((prev) => ({
              ...prev,
              ...f,
              image: f.image && !f.image.startsWith('data:') ? f.image : null,
              location: f.location || prev.location,
              price_unit: f.price_unit || f.unit || prev.price_unit,
              is_price_optional: Boolean(f.is_price_optional),
            }))
            if (f.crop_name && !catalog.some((c) => (c?.name || '').toLowerCase() === f.crop_name.trim().toLowerCase())) {
              setIsCustomCropMode(true)
            }
            const maxStepAllowed = isFarmer ? 5 : 6
            if (parsed.step && parsed.step >= 1 && parsed.step <= maxStepAllowed) {
              setStep(parsed.step)
            }
            setDraftRestored(true)
            toast.success(t('createPost.draftRestoredToast', 'Previous draft restored'))
          }
        }
      }
    } catch (err) {
      console.warn('Could not restore draft:', err)
      try {
        localStorage.removeItem(draftKey)
      } catch {}
    } finally {
      isDraftLoadedRef.current = true
    }
  }, [draftKey, isFarmer, t])

  // Auto-save draft changes
  useEffect(() => {
    if (!isDraftLoadedRef.current || !draftKey) return

    const hasData = Boolean(
      form.crop_name?.trim() ||
      form.quantity_num ||
      form.price ||
      form.variety?.trim() ||
      form.description?.trim()
    )

    if (!hasData) return

    const draftPayload = {
      version: 5,
      timestamp: Date.now(),
      step,
      form: {
        ...form,
        image: form.image && !form.image.startsWith('data:') ? form.image : null,
      },
    }

    try {
      localStorage.setItem(draftKey, JSON.stringify(draftPayload))
    } catch (err) {
      console.warn('Could not save draft to localStorage:', err)
    }
  }, [form, step, draftKey])

  function handleDiscardDraft() {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey)
      } catch {}
    }
    stopSpeaking()
    setForm({
      crop_name: '',
      category: '',
      quantity_num: isFarmer ? '50' : '100',
      unit: 'Quintal',
      price: isFarmer ? '2350' : '2400',
      price_unit: 'Quintal',
      is_negotiable: false,
      is_price_optional: false,
      delivery_choice: isFarmer ? 'today' : '15days',
      target_date: isFarmer ? getOffsetDateString(0) : getOffsetDateString(15),
      time_of_day: 'anytime',
      location: user?.location || '',
      variety: '',
      quality_grade: 'Grade A / Premium',
      title: '',
      description: '',
      delivery_preferences: '',
      image: null,
    })
    setIsCustomCropMode(false)
    setStep(1)
    setDraftRestored(false)
    setErrors({})
    toast.success(t('createPost.draftDiscardedToast', 'Draft discarded'))
    speakStepInstruction(1)
  }

  // Fetch Mandi guidance when crop changes
  useEffect(() => {
    if (!form.crop_name) return
    const matched = catalog.find(
      (c) => (c?.name || '').toLowerCase() === (form.crop_name || '').trim().toLowerCase()
    )
    if (matched && !form.category) {
      update('category', matched.category)
    }

    async function fetchGuidance() {
      setLoadingGuidance(true)
      try {
        const res = await getPriceGuidance(form.crop_name, form.location)
        setPriceGuidance(res.data)
      } catch {
        setPriceGuidance(null)
      } finally {
        setLoadingGuidance(false)
      }
    }
    fetchGuidance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.crop_name, form.location])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  // ============================================================
  // AI SPOKEN AUDIO GUIDANCE (MULTILINGUAL TEXT-TO-SPEECH)
  // Speaks every instruction while visually displaying the question
  // Synchronized across Telugu (te-IN), Hindi (hi-IN) & English (en-IN)
  // ============================================================
  function speakStepInstruction(stepNum) {
    stopSpeaking()
    setIsSpeakingInstruction(true)

    if (isFarmer) {
      let text = ''
      if (stepNum === 1) {
        text = t('createPost.audioStep1')
      } else if (stepNum === 2) {
        const cropText = translateCropName(t, form.crop_name) || t('createPost.stepCropName', 'Crop')
        text = t('createPost.audioStep2', { crop: cropText })
      } else if (stepNum === 3) {
        text = t('createPost.audioStep3')
      } else if (stepNum === 4) {
        text = t('createPost.audioStep4')
      } else if (stepNum === 5) {
        readSummaryAloud()
        return
      }

      speak(text, {
        lang: ttsLang,
        onStart: () => setIsSpeakingInstruction(true),
        onEnd: () => setIsSpeakingInstruction(false),
      })
    } else {
      // Industry / Buyer Spoken Guidance
      let text = ''
      if (stepNum === 1) {
        text = t('createPost.buyerAudioStep1')
      } else if (stepNum === 2) {
        const cropText = translateCropName(t, form.crop_name) || t('createPost.stepCropName', 'Crop')
        text = t('createPost.buyerAudioStep2', { crop: cropText })
      } else if (stepNum === 3) {
        text = t('createPost.buyerAudioStep3')
      } else if (stepNum === 4) {
        text = t('createPost.buyerAudioStep4')
      } else if (stepNum === 5) {
        text = t('createPost.buyerAudioStep5')
      } else if (stepNum === 6) {
        readSummaryAloud()
        return
      }

      speak(text, {
        lang: ttsLang,
        onStart: () => setIsSpeakingInstruction(true),
        onEnd: () => setIsSpeakingInstruction(false),
      })
    }
  }

  // Automatically speak step instruction on step change
  useEffect(() => {
    speakStepInstruction(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Stop previous audio immediately when language changes
  useEffect(() => {
    stopSpeaking()
    setIsSpeakingInstruction(false)
  }, [i18n.language])

  // Automatically synchronize price_unit to follow quantity unit
  useEffect(() => {
    if (form.unit && form.price_unit !== form.unit) {
      setForm((prev) => ({ ...prev, price_unit: prev.unit }))
    }
  }, [form.unit])

  // Read full listing/requirement summary aloud before publication
  function readSummaryAloud() {
    stopSpeaking()
    setIsSpeakingInstruction(true)

    const cropText = translateCropName(t, form.crop_name) || t('createPost.stepCropName', 'Crop')
    const unitText = translateUnit(t, form.unit)
    const priceUnitText = translateUnit(t, form.price_unit)

    if (isFarmer) {
      const deliveryText =
        form.delivery_choice === 'today'
          ? t('createPost.q4Today')
          : form.delivery_choice === 'tomorrow'
          ? t('createPost.q4Tomorrow')
          : form.target_date

      const summaryText = t('createPost.audioSummary', {
        crop: cropText,
        qty: form.quantity_num,
        unit: unitText,
        price: form.price,
        priceUnit: priceUnitText,
        delivery: deliveryText,
      })

      speak(summaryText, {
        lang: ttsLang,
        onStart: () => setIsSpeakingInstruction(true),
        onEnd: () => setIsSpeakingInstruction(false),
      })
    } else {
      // Buyer Spoken Summary
      const deliveryText =
        form.delivery_choice === '7days'
          ? t('createPost.buyerStep4In7Days')
          : form.delivery_choice === '15days'
          ? t('createPost.buyerStep4In15Days')
          : form.delivery_choice === '30days'
          ? t('createPost.buyerStep4In30Days')
          : form.target_date

      const locationText = form.location || user?.location || t('createPost.buyerStep5AllRegions')
      const priceText =
        form.is_price_optional || !form.price
          ? t('createPost.priceNegotiableToggle', 'Open to negotiation / Market rate')
          : `${form.price}`

      const summaryText = t('createPost.buyerAudioSummary', {
        crop: cropText,
        qty: form.quantity_num,
        unit: unitText,
        price: priceText,
        priceUnit: priceUnitText,
        delivery: deliveryText,
        location: locationText,
      })

      speak(summaryText, {
        lang: ttsLang,
        onStart: () => setIsSpeakingInstruction(true),
        onEnd: () => setIsSpeakingInstruction(false),
      })
    }
  }

  // Select crop from visual card
  function handleSelectCrop(crop) {
    if (!crop || !crop.name) return
    setForm((prev) => ({
      ...prev,
      crop_name: crop.name,
      category: crop.category || prev.category,
      unit: crop.default_unit || prev.unit,
      price_unit: crop.default_unit || prev.price_unit,
    }))
    setErrors((prev) => ({ ...prev, crop_name: null }))
    setIsCustomCropMode(false)

    // Pronounce crop name aloud in selected language
    const voiceText =
      currentLang === 'te'
        ? crop.telugu
          ? crop.telugu.split('(')[0].trim()
          : crop.name
        : currentLang === 'hi'
        ? crop.hindi
          ? crop.hindi.split('(')[0].trim()
          : crop.name
        : crop.name

    speak(voiceText, ttsLang)
  }

  // Handle custom crop name typed manually
  function handleCustomCropChange(val) {
    update('crop_name', val)
    setErrors((prev) => ({ ...prev, crop_name: null }))
    const match = catalog.find(
      (c) => (c?.name || '').toLowerCase() === val.trim().toLowerCase()
    )
    if (match) {
      if (match.category && !form.category) update('category', match.category)
      if (match.default_unit) {
        update('unit', match.default_unit)
        update('price_unit', match.default_unit)
      }
    }
  }

  // Plus / Minus adjustments for Quantity
  function adjustQuantity(delta) {
    const current = parseFloat(form.quantity_num) || 0
    const nextVal = Math.max(0.1, Math.round((current + delta) * 100) / 100)
    update('quantity_num', String(nextVal))
    const unitName = translateUnit(t, form.unit)
    speak(`${nextVal} ${unitName}`, ttsLang)
  }

  // Plus / Minus adjustments for Price
  function adjustPrice(delta) {
    if (form.is_price_optional) {
      setForm((prev) => ({ ...prev, is_price_optional: false, price: '100' }))
      speak(t('createPost.spokenPrice', { price: 100 }), ttsLang)
      return
    }
    const current = parseFloat(form.price) || 0
    const nextVal = Math.max(1, Math.round((current + delta) * 100) / 100)
    update('price', String(nextVal))
    speak(t('createPost.spokenPrice', { price: nextVal }), ttsLang)
  }

  // On-screen numeric keypad input for Step 2 (Quantity) and Step 3 (Price)
  function handleKeypadDigit(digit) {
    if (step === 2) {
      if (digit === '.') {
        const cur = String(form.quantity_num || '')
        if (!cur || cur === '0') {
          update('quantity_num', '0.')
          setErrors((prev) => ({ ...prev, quantity_num: null }))
          return
        }
        if (cur.includes('.')) return
        update('quantity_num', `${cur}.`)
        setErrors((prev) => ({ ...prev, quantity_num: null }))
        return
      }
      const cur = String(form.quantity_num || '')
      const next = cur === '0' || !cur ? String(digit) : `${cur}${digit}`
      update('quantity_num', next)
      setErrors((prev) => ({ ...prev, quantity_num: null }))
    } else if (step === 3) {
      if (form.is_price_optional) {
        setForm((prev) => ({ ...prev, is_price_optional: false, price: String(digit) }))
        setErrors((prev) => ({ ...prev, price: null }))
        return
      }
      if (digit === '.') {
        const cur = String(form.price || '')
        if (!cur || cur === '0') {
          update('price', '0.')
          setErrors((prev) => ({ ...prev, price: null }))
          return
        }
        if (cur.includes('.')) return
        update('price', `${cur}.`)
        setErrors((prev) => ({ ...prev, price: null }))
        return
      }
      const cur = String(form.price || '')
      const next = cur === '0' || !cur ? String(digit) : `${cur}${digit}`
      update('price', next)
      setErrors((prev) => ({ ...prev, price: null }))
    }
  }

  function handleKeypadBackspace() {
    if (step === 2) {
      const cur = String(form.quantity_num || '')
      const next = cur.length > 1 ? cur.slice(0, -1) : ''
      update('quantity_num', next)
      setErrors((prev) => ({ ...prev, quantity_num: null }))
    } else if (step === 3) {
      if (form.is_price_optional) return
      const cur = String(form.price || '')
      const next = cur.length > 1 ? cur.slice(0, -1) : ''
      update('price', next)
      setErrors((prev) => ({ ...prev, price: null }))
    }
  }

  // Delivery Choice handler for Farmer
  function handleFarmerDeliveryChoice(choice) {
    update('delivery_choice', choice)
    if (choice === 'today') {
      update('target_date', getOffsetDateString(0))
      speak(t('createPost.deliveryToday'), ttsLang)
    } else if (choice === 'tomorrow') {
      update('target_date', getOffsetDateString(1))
      speak(t('createPost.deliveryTomorrow'), ttsLang)
    } else {
      speak(t('createPost.deliveryCustom'), ttsLang)
    }
  }

  // Delivery Requirement handler for Buyer
  function handleBuyerDeliveryChoice(choice) {
    update('delivery_choice', choice)
    if (choice === '7days') {
      update('target_date', getOffsetDateString(7))
      speak(t('createPost.buyerStep4In7Days'), ttsLang)
    } else if (choice === '15days') {
      update('target_date', getOffsetDateString(15))
      speak(t('createPost.buyerStep4In15Days'), ttsLang)
    } else if (choice === '30days') {
      update('target_date', getOffsetDateString(30))
      speak(t('createPost.buyerStep4In30Days'), ttsLang)
    } else {
      speak(t('createPost.buyerStep4CustomDate'), ttsLang)
    }
  }

  // Step Validation & Progression
  function validateAndNext(currentStep) {
    stopSpeaking()

    if (currentStep === 1) {
      if (!form.crop_name?.trim()) {
        const errMsg = t('createPost.q1Error', 'Please select a crop or enter a custom crop name')
        setErrors((prev) => ({ ...prev, crop_name: errMsg }))
        toast.error(errMsg)
        speak(errMsg, ttsLang)
        return
      }
      setErrors({})
      setStep(2)
    } else if (currentStep === 2) {
      const q = parseFloat(form.quantity_num)
      if (isNaN(q) || q <= 0) {
        const errMsg = t('createPost.q2Error', 'Please enter a valid quantity greater than 0')
        setErrors((prev) => ({ ...prev, quantity_num: errMsg }))
        toast.error(errMsg)
        speak(errMsg, ttsLang)
        return
      }
      setErrors({})
      // Automatically synchronize price unit to follow quantity unit
      setForm((prev) => ({ ...prev, price_unit: prev.unit || 'Quintal' }))
      setStep(3)
    } else if (currentStep === 3) {
      // For buyers: price is optional if marked negotiable or left empty
      if (!isFarmer && (form.is_price_optional || !form.price?.trim())) {
        setErrors({})
        setStep(4)
        return
      }

      const p = parseFloat(form.price)
      if (isNaN(p) || p < 0) {
        const errMsg = t('createPost.q3Error', 'Please enter a valid price or mark as open to negotiation')
        setErrors((prev) => ({ ...prev, price: errMsg }))
        toast.error(errMsg)
        speak(errMsg, ttsLang)
        return
      }
      if (isFarmer && p === 0) {
        const errMsg = t('createPost.q3ErrorFarmer', 'Farmer price must be greater than 0')
        setErrors((prev) => ({ ...prev, price: errMsg }))
        toast.error(errMsg)
        speak(errMsg, ttsLang)
        return
      }
      setErrors({})
      setStep(4)
    } else if (currentStep === 4) {
      if (!form.target_date) {
        const errMsg = t('createPost.q4Error', 'Please select a delivery date')
        setErrors((prev) => ({ ...prev, target_date: errMsg }))
        toast.error(errMsg)
        speak(errMsg, ttsLang)
        return
      }
      // Check date is not in past
      const selected = new Date(form.target_date)
      const today = new Date(getOffsetDateString(0))
      if (selected < today) {
        const errMsg = t('createPost.datePastError', 'Delivery date cannot be in the past')
        setErrors((prev) => ({ ...prev, target_date: errMsg }))
        toast.error(errMsg)
        speak(errMsg, ttsLang)
        return
      }
      setErrors({})
      if (isFarmer) {
        setStep(5) // Farmer moves to Step 5 (Final Review)
      } else {
        setStep(5) // Buyer moves to Step 5 (Preferred Sourcing Location)
      }
    } else if (currentStep === 5 && !isFarmer) {
      // Buyer Step 5 Location validation
      if (!form.location?.trim()) {
        update('location', user?.location || 'All Regions')
      }
      setErrors({})
      setStep(6) // Buyer moves to Step 6 (Final Review)
    }
  }

  // Submit Listing / Purchase Requirement (Requires Explicit User Touch)
  async function handlePublish() {
    if (isPublishingRef.current || submitting) return

    stopSpeaking()

    if (user && !user.is_verified) {
      setShowOtpModal(true)
      return
    }

    if (!form.crop_name.trim()) {
      setStep(1)
      toast.error(t('createPost.q1Error', 'Please select a crop'))
      return
    }

    const titleToUse =
      form.title.trim() ||
      `${isFarmer ? 'Fresh Harvest:' : 'Purchase Requirement:'} ${form.crop_name} ${
        form.variety?.trim() ? `(${form.variety.trim()}) ` : ''
      }${form.quantity_num ? `- ${form.quantity_num} ${form.unit}` : ''}`.trim()

    const quantityFormatted = form.quantity_num ? `${form.quantity_num} ${form.unit}` : null

    let deliveryFormatted = form.target_date
    if (isFarmer) {
      if (form.delivery_choice === 'today') {
        deliveryFormatted = `Today (${form.target_date})`
      } else if (form.delivery_choice === 'tomorrow') {
        deliveryFormatted = `Tomorrow (${form.target_date})`
      }
      if (form.time_of_day && form.time_of_day !== 'anytime') {
        deliveryFormatted += ` - ${form.time_of_day}`
      }
    } else {
      if (form.delivery_choice === '7days') {
        deliveryFormatted = `Within 7 Days (${form.target_date})`
      } else if (form.delivery_choice === '15days') {
        deliveryFormatted = `Within 15 Days (${form.target_date})`
      } else if (form.delivery_choice === '30days') {
        deliveryFormatted = `Within 30 Days (${form.target_date})`
      }
    }

    const locationToUse = form.location.trim() || user?.location || (isFarmer ? 'Local Region' : 'All Regions')

    const priceToSubmit =
      form.price && !form.is_price_optional ? parseFloat(form.price) : null
    const isNegotiableToSubmit = Boolean(form.is_negotiable || form.is_price_optional)

    const descParts = [
      form.description?.trim(),
      form.delivery_preferences?.trim()
        ? `Delivery Preferences: ${form.delivery_preferences.trim()}`
        : null,
    ].filter(Boolean)
    const combinedDesc = descParts.join('\n\n') || null

    isPublishingRef.current = true
    setSubmitting(true)
    try {
      const res = await createPost({
        title: titleToUse,
        crop_name: form.crop_name.trim(),
        category: form.category || null,
        variety: form.variety?.trim() || null,
        quality_grade: form.quality_grade || 'Grade A / Premium',
        quantity: quantityFormatted,
        price: priceToSubmit,
        is_negotiable: isNegotiableToSubmit,
        location: locationToUse,
        target_date: deliveryFormatted,
        description: combinedDesc,
        image: form.image,
      })

      setPublishedPost(res.data)
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey)
        } catch {}
      }
      setDraftRestored(false)
      speak(
        isFarmer ? t('createPost.audioSuccessCelebration') : t('createPost.buyerAudioSuccessCelebration'),
        ttsLang
      )
      toast.success(
        isFarmer
          ? t('createPost.successToastFarmer', 'Crop posted! Industries will see it now.')
          : t('createPost.successToastIndustry', 'Purchase requirement posted! Farmers will see it now.')
      )
    } catch (err) {
      if (err?.isTimeout) {
        toast.error(t('common.networkTimeout', 'Network request timed out. Your draft is safely saved.'))
      } else if (err?.isNetworkError) {
        toast.error(t('common.offlineError', 'You appear to be offline. Your draft is safely saved.'))
      } else {
        toast.error(err.response?.data?.detail || t('createPost.errors.generic', 'Failed to publish. Try again.'))
      }
    } finally {
      isPublishingRef.current = false
      setSubmitting(false)
    }
  }

  // Filter crops in Step 1
  const filteredCatalog = filterCropsCatalog(catalog, selectedCategory, cropSearch)

  // Selected crop object if any
  const activeCropObj = catalog.find(
    (c) => (c?.name || '').toLowerCase() === (form.crop_name || '').trim().toLowerCase()
  )

  // Clean audio cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [])

  // ============================================================
  // SUCCESS CELEBRATION SCREEN
  // ============================================================
  if (publishedPost) {
    return (
      <div className="min-h-screen bg-[#F9FAF7] flex flex-col justify-center items-center px-4 py-8">
        <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200 text-center animate-pop-in">
          <div className="w-20 h-20 bg-green-100 border-2 border-[#1E5E3A] rounded-full flex items-center justify-center mx-auto mb-4 text-[#1E5E3A] shadow-md">
            <Check size={44} strokeWidth={3} />
          </div>

          <span className="text-xs bg-amber-100 text-[#D9822B] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {isFarmer
              ? t('createPost.successBadgeFarmer', 'Crop Listed Live!')
              : t('createPost.buyerSuccessBadge', 'Requirement Live!')}
          </span>

          <h2 className="font-display font-bold text-gray-900 text-2xl sm:text-3xl mt-3">
            {publishedPost.title}
          </h2>

          <p className="text-sm text-gray-600 mt-2">
            {isFarmer
              ? t('createPost.successFarmerHelp', 'Your crop is now visible to verified industries in the marketplace.')
              : t('createPost.buyerSuccessHelp', 'Your purchase requirement is now visible to verified farmers across selected regions.')}
          </p>

          <div className="bg-green-50/70 rounded-2xl p-4 sm:p-5 my-5 text-left border border-green-200 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">{t('createPost.reviewCrop', 'Crop')}:</span>
              <span className="font-bold text-gray-900">{publishedPost.crop_name}</span>
            </div>
            {publishedPost.quantity && (
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">{t('createPost.reviewQty', 'Quantity')}:</span>
                <span className="font-bold text-gray-900">{publishedPost.quantity}</span>
              </div>
            )}
            {publishedPost.price && (
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">
                  {isFarmer ? t('createPost.reviewPrice', 'Price') : t('createPost.budgetCeilingLabel', 'Target Budget')}:
                </span>
                <span className="font-bold text-[#D9822B]">₹{publishedPost.price}</span>
              </div>
            )}
            {publishedPost.target_date && (
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">{t('createPost.reviewDelivery', 'Delivery Time')}:</span>
                <span className="font-semibold text-gray-900">{publishedPost.target_date}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">{t('postCard.location', 'Location')}:</span>
              <span className="font-semibold text-gray-900">{publishedPost.location || user?.location}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/matches')}
              className="w-full bg-[#D9822B] hover:bg-[#b86c22] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md min-h-[52px] text-base"
            >
              <Sparkles size={20} />
              {isFarmer
                ? t('createPost.seeBuyersBtn', 'See Matching Buyers Now')
                : t('createPost.seeCropsBtn', 'See Matching Crops Now')}
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-[#1E5E3A] hover:bg-[#16482c] text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all min-h-[52px] text-base"
            >
              <Eye size={20} />
              {t('createPost.viewMarketplace', 'View Marketplace Feed')}
            </button>

            <button
              onClick={() => {
                setPublishedPost(null)
                setStep(1)
                setForm({
                  crop_name: '',
                  category: '',
                  quantity_num: isFarmer ? '50' : '100',
                  unit: 'Quintal',
                  price: isFarmer ? '2350' : '2400',
                  price_unit: 'Quintal',
                  is_negotiable: false,
                  delivery_choice: isFarmer ? 'today' : '15days',
                  target_date: isFarmer ? getOffsetDateString(0) : getOffsetDateString(15),
                  time_of_day: 'anytime',
                  variety: '',
                  location: user?.location || '',
                  title: '',
                  description: '',
                  image: null,
                })
                speakStepInstruction(1)
              }}
              className="w-full py-3 text-sm text-[#1E5E3A] font-bold hover:bg-gray-100 rounded-xl transition-colors min-h-[48px]"
            >
              + {isFarmer ? t('createPost.postAnotherFarmer', 'Post Another Crop') : t('createPost.postAnotherIndustry', 'Post Another Requirement')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // SINGLE ENTRY POINT: AI GUIDED POSTING – SEE, TOUCH AND LISTEN
  // ============================================================
  return (
    <div className="min-h-screen pb-32 bg-[#F9FAF7]">
      <TopBar
        title={isFarmer ? t('createPost.titleFarmer', 'Post Your Crop') : t('createPost.titleIndustryPost', 'Post Purchase Requirement')}
        subtitle={
          step <= totalQuestions
            ? t('createPost.guidedStepCounter', { current: step, total: totalQuestions })
            : t('createPost.guidedFinalReview', 'Final Review')
        }
        showSearch={false}
      />

      {/* Top Banner: AI Guided Posting Badge & Replay Audio Button */}
      <div className="max-w-md mx-auto px-4 pt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1E5E3A]">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse" />
          <span>{t('createPost.guidedPostingBadge', 'AI Guided Posting · See, Touch and Listen')}</span>
        </div>

        <button
          type="button"
          onClick={() => speakStepInstruction(step)}
          className="flex items-center gap-1.5 text-xs font-bold text-[#1E5E3A] bg-green-50 hover:bg-green-100 border border-green-300 px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all"
          title={t('createPost.replayAudio', 'సూచన మళ్లీ వినండి')}
        >
          <Volume2 size={15} className={isSpeakingInstruction ? 'animate-bounce text-amber-600' : 'text-[#1E5E3A]'} />
          <span>{t('createPost.replayAudio', 'సూచన మళ్లీ వినండి')}</span>
        </button>
      </div>

      {/* Restored Draft Banner */}
      {draftRestored && (
        <div className="max-w-md mx-auto px-4 pt-2">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-gray-900 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={18} className="text-[#1E5E3A] shrink-0" />
              <span className="font-semibold truncate">
                {t('createPost.draftRestoredNotice', 'Your previous draft has been restored.')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-red-700 hover:text-red-800 font-bold underline text-xs shrink-0"
            >
              {t('createPost.discardDraftBtn', 'Discard & Start Fresh')}
            </button>
          </div>
        </div>
      )}

      {/* Visual Progress Bar (4 Segments for Farmer, 5 Segments for Buyer) */}
      <div className="max-w-md mx-auto px-4 pt-2">
        <div className="bg-white rounded-2xl p-3 border border-gray-200/80 shadow-xs">
          {isFarmer ? (
            <div className="flex items-center justify-between mb-2 text-xs font-bold text-gray-700">
              <span className={step >= 1 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                1. {t('createPost.stepCropName', 'పంట')}
              </span>
              <span className={step >= 2 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                2. {t('createPost.stepQtyName', 'పరిమాణం')}
              </span>
              <span className={step >= 3 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                3. {t('createPost.stepPriceName', 'ధర')}
              </span>
              <span className={step >= 4 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                4. {t('createPost.stepDeliveryName', 'డెలివరీ')}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-2 text-[11px] sm:text-xs font-bold text-gray-700">
              <span className={step >= 1 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                1. {t('createPost.stepCropName', 'పంట')}
              </span>
              <span className={step >= 2 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                2. {t('createPost.stepQtyName', 'పరిమాణం')}
              </span>
              <span className={step >= 3 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                3. {t('createPost.stepPriceName', 'ధర')}
              </span>
              <span className={step >= 4 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                4. {t('createPost.stepDeliveryName', 'డెలివరీ')}
              </span>
              <span className={step >= 5 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
                5. {t('createPost.stepLocationName', 'ప్రాంతం')}
              </span>
            </div>
          )}

          <div className={`grid gap-1.5 h-2.5 ${isFarmer ? 'grid-cols-4' : 'grid-cols-5'}`}>
            {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`h-full rounded-full transition-all duration-300 ${
                  step >= s ? 'bg-[#1E5E3A]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4">
        {/* ============================================================ */}
        {/* STEP 1: CROP SELECTION WITH PICTURE TOUCH & VOICE GUIDANCE  */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 1, total: totalQuestions })}
                </span>
                <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                  <Volume2 size={14} className="text-[#1E5E3A]" /> {t('createPost.touchSpeaks', 'తాకినప్పుడు వినిపిస్తుంది')}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.touchToSelectCrop', 'మీ పంట చిత్రాన్ని తాకండి')
                  : t('createPost.buyerStep1Title', 'మీకు ఏ పంట అవసరం?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isFarmer
                  ? t('createPost.touchToSelectCropSub', 'మీ వద్ద ఉన్న పంటను కింద ఉన్న బొమ్మలలో చూసి ఎంచుకోండి లేదా పేరును నేరుగా రాయండి')
                  : t('createPost.buyerStep1Sub', 'మీరు కొనాలనుకుంటున్న పంట బొమ్మను తాకి ఎంచుకోండి లేదా పేరు రాయండి')}
              </p>
            </div>

            {/* Mode Selector Toggle: Picture Selection vs Manual Crop Name Entry */}
            <div className="bg-white rounded-2xl p-1.5 border border-[#C8D9CE] shadow-xs flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsCustomCropMode(false)
                  stopSpeaking()
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer ${
                  !isCustomCropMode
                    ? 'bg-[#1E5E3A] text-white shadow-xs'
                    : 'bg-transparent text-gray-700 hover:bg-[#E8EFE8]'
                }`}
              >
                <span>{t('createPost.selectFromPictures', '🖼️ Select from Pictures')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCustomCropMode(true)
                  stopSpeaking()
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer ${
                  isCustomCropMode
                    ? 'bg-[#1E5E3A] text-white shadow-xs'
                    : 'bg-transparent text-gray-700 hover:bg-[#E8EFE8]'
                }`}
              >
                <span>{t('createPost.enterCropManually', '✍️ Type Crop Name')}</span>
              </button>
            </div>

            {/* Selected Crop Banner */}
            {form.crop_name && (
              <div className="bg-green-100/90 border-2 border-[#1E5E3A] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getSafeCropIcon(activeCropObj?.icon)}</span>
                  <div>
                    <span className="text-[10px] text-[#1E5E3A] font-extrabold uppercase tracking-wide block">
                      {t('createPost.selectedCrop', 'ఎంచుకున్న పంట')}
                    </span>
                    <p className="font-extrabold text-gray-900 text-lg leading-tight">
                      {translateCropName(t, form.crop_name)}
                    </p>
                    {form.category && (
                      <span className="text-xs text-gray-600 font-semibold block mt-0.5">
                        {translateAgriCategory(t, form.category)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('crop_name', '')}
                  className="text-xs font-bold text-red-700 bg-white px-3 py-1.5 rounded-xl border border-red-200 active:scale-95 cursor-pointer"
                >
                  {t('createPost.changeCropBtn', 'మార్చు')}
                </button>
              </div>
            )}

            {/* Manual Crop Entry Card (Visible whenever manual mode is chosen) */}
            {isCustomCropMode && (
              <div className="bg-white rounded-3xl p-5 border-2 border-[#1E5E3A] shadow-sm space-y-4">
                <div>
                  <label className="text-sm font-extrabold text-[#16472C] block mb-1.5 flex items-center justify-between">
                    <span>{t('createPost.manualCropNameLabel', 'Enter Crop Name:')}</span>
                  </label>
                  <p className="text-xs text-gray-500 font-normal mb-2">
                    {t('createPost.manualCropHelp', 'Any crop, grain, pulse, fruit or vegetable (e.g. Dragon Fruit, Millets, Drumstick...)')}
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.crop_name}
                      onChange={(e) => handleCustomCropChange(e.target.value)}
                      placeholder={t('createPost.manualCropPlaceholder', 'e.g. Dragon Fruit, Millets, Drumstick, Papaya...')}
                      className="w-full bg-[#F9FAF7] border border-[#C8D9CE] focus:border-[#1E5E3A] focus:bg-white rounded-2xl px-4 py-3.5 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E5E3A]"
                      autoFocus
                    />
                    {form.crop_name && (
                      <button
                        type="button"
                        onClick={() => update('crop_name', '')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
                        aria-label="Clear crop name"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {errors.crop_name && (
                    <p className="text-xs text-red-600 font-semibold mt-1.5 bg-red-50 p-2 rounded-xl border border-red-200">
                      {errors.crop_name}
                    </p>
                  )}
                </div>

                {/* Optional Category Selector for Custom Crop */}
                <div>
                  <span className="text-xs font-bold text-[#16472C] block mb-1.5">
                    {t('createPost.customCropCategoryPrompt', 'Select Category (Optional):')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => update('category', cat)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all cursor-pointer ${
                          form.category === cat
                            ? 'bg-[#1E5E3A] text-white border-[#1E5E3A] shadow-xs'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {translateAgriCategory(t, cat)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#E8EFE8] rounded-xl p-3 text-xs text-[#16472C] font-semibold border border-[#C8D9CE]">
                  {t('createPost.customCropWarning', 'Note: Custom crop names will be listed directly and matched with buyers seeking this crop.')}
                </div>
              </div>
            )}

            {/* Catalog Mode: Category Filter Chips + Picture Grid (When picture selection mode is active) */}
            {!isCustomCropMode && (
              <>
                <div className="flex items-center justify-between bg-white rounded-2xl p-2.5 px-3 border border-gray-200 shadow-xs">
                  <span className="text-xs font-bold text-gray-700">
                    {t('createPost.cantFindCrop', "Can't find your crop in the pictures?")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCropMode(true)
                      stopSpeaking()
                    }}
                    className="text-xs font-extrabold text-[#1E5E3A] hover:text-[#16482c] bg-green-50 px-3 py-1 rounded-xl border border-green-200 active:scale-95 cursor-pointer"
                  >
                    {t('createPost.enterManuallyBtn', 'Enter crop manually →')}
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Crop Categories">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-xs px-3.5 py-2 rounded-full font-bold shrink-0 transition-all active:scale-95 min-h-[36px] cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#1E5E3A] text-white shadow-sm'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {translateAgriCategory(t, cat)}
                    </button>
                  ))}
                </div>

                <div
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1"
                  role="group"
                  aria-label="Crops"
                >
                  {filteredCatalog.map((crop) => {
                    const isSelected =
                      (form.crop_name || '').trim().toLowerCase() === (crop.name || '').trim().toLowerCase()
                    const primaryName = translateCropName(t, crop.name)
                    const secondaryName =
                      currentLang === 'te'
                        ? crop.name
                        : currentLang === 'hi'
                        ? crop.name
                        : (crop.telugu ? crop.telugu.split('(')[0].trim() : crop.name)

                    return (
                      <button
                        key={crop.name}
                        type="button"
                        onClick={() => handleSelectCrop(crop)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleSelectCrop(crop)
                          }
                        }}
                        role="button"
                        aria-pressed={isSelected}
                        aria-selected={isSelected}
                        aria-label={`${primaryName}${isSelected ? ' - selected' : ''}`}
                        tabIndex={0}
                        className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between min-h-[110px] active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E5E3A] ${
                          isSelected
                            ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                            : 'border-gray-200 bg-white hover:border-[#1E5E3A]/60 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-4xl select-none" role="img" aria-hidden="true">{getSafeCropIcon(crop.icon)}</span>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-[#1E5E3A] text-white flex items-center justify-center shadow-xs">
                              <Check size={14} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="mt-2">
                          <p className="font-extrabold text-gray-900 text-base leading-tight">
                            {primaryName}
                          </p>
                          {secondaryName && secondaryName !== primaryName && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{secondaryName}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                  {filteredCatalog.length === 0 && (
                    <div className="col-span-2 sm:col-span-3 py-8 text-center text-gray-500">
                      <p className="font-medium text-sm">{t('createPost.noCropsFound', 'No crops found matching your selection.')}</p>
                      <button
                        type="button"
                        onClick={() => { setSelectedCategory('All'); setCropSearch(''); }}
                        className="mt-2 text-xs font-bold text-[#1E5E3A] underline cursor-pointer"
                      >
                        {t('createPost.showAllCrops', 'Show All Crops')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Crop Variety Selection / Manual Entry in Step 1 */}
            {form.crop_name && (
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2">
                <label className="text-xs font-bold text-gray-700 block">
                  {t('createPost.varietyPrompt', 'Crop Variety (Optional):')}
                </label>
                {activeCropObj?.varieties?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {activeCropObj.varieties.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update('variety', form.variety === v ? '' : v)}
                        className={`text-xs px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer ${
                          form.variety === v
                            ? 'bg-[#1E5E3A] text-white border-[#1E5E3A]'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={form.variety}
                  onChange={(e) => update('variety', e.target.value)}
                  placeholder={t('createPost.customVarietyPlaceholder', 'Enter custom variety (e.g. Red Flesh, Local Desi)...')}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E5E3A]"
                />
              </div>
            )}

            {/* Next Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => validateAndNext(1)}
                disabled={!form.crop_name?.trim()}
                className={`w-full font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md min-h-[56px] text-lg ${
                  form.crop_name?.trim()
                    ? 'bg-[#1E5E3A] hover:bg-[#16482c] text-white cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span>{t('createPost.q1NextBtn', 'తర్వాత: పరిమాణం ఎంచుకోండి →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: QUANTITY ENTRY (FARMER-FRIENDLY CLEAN WORKFLOW)     */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm text-center">
              {/* Counter & Crop Indicator */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 2, total: totalQuestions })}
                </span>
                <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                  {getSafeCropIcon(activeCropObj?.icon)} {translateCropName(t, form.crop_name)}
                </span>
              </div>

              {/* 1. Heading */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.howMuchQty', 'ఎంత పరిమాణం ఉంది?')
                  : t('createPost.buyerStep2Title', 'మీకు ఎంత పరిమాణం అవసరం?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.qtyKeypadHelp', 'యూనిట్ ఎంచుకుని, కీప్యాడ్‌తో పరిమాణాన్ని నమోదు చేయండి')}
              </p>

              {/* 2. Supported Quantity Units (Exactly once: Kg, Quintal, Ton, Bag) */}
              <div className="my-4 pt-3 border-t border-gray-100">
                <span className="text-xs font-extrabold text-[#16472C] block mb-2 text-left sm:text-center">
                  {t('createPost.unitsTitle', 'యూనిట్ ఎంచుకోండి:')}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-sm mx-auto">
                  {STANDARD_UNITS.map((u) => {
                    const isSelected = form.unit === u || (u === 'Ton' && (form.unit === 'Tonne' || form.unit === 'Tonnes'))
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            unit: u,
                            price_unit: u,
                          }))
                          speak(`${translateUnit(t, u)} ${t('createPost.unitSelected')}`, ttsLang)
                        }}
                        className={`py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm border-2 transition-all min-h-[48px] flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'bg-[#1E5E3A] text-white border-[#1E5E3A] shadow-md ring-2 ring-green-300'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-[#E8EFE8]'
                        }`}
                        aria-pressed={isSelected}
                      >
                        {isSelected && <Check size={16} strokeWidth={3} className="shrink-0" aria-hidden="true" />}
                        <span>{translateUnit(t, u)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 3 & 4. Prominent Numeric Display of Entered Value */}
              <div className="my-3 py-3.5 px-6 rounded-3xl bg-green-50/90 border-2 border-[#1E5E3A] max-w-xs mx-auto flex items-baseline justify-center gap-2 shadow-xs">
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  value={form.quantity_num}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '')
                    const parts = val.split('.')
                    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val
                    update('quantity_num', sanitized)
                    setErrors((prev) => ({ ...prev, quantity_num: null }))
                  }}
                  aria-label={t('createPost.quantityLabel', 'Quantity')}
                  placeholder="0"
                  className="w-full text-center text-4xl sm:text-5xl font-black text-gray-900 bg-transparent border-0 focus:ring-0 focus:outline-none tracking-tight"
                />
                <span className="text-base sm:text-lg font-extrabold text-[#1E5E3A] uppercase shrink-0">
                  {translateUnit(t, form.unit)}
                </span>
              </div>

              {errors.quantity_num && (
                <p className="text-xs text-red-600 font-semibold mb-3 bg-red-50 p-2 rounded-xl border border-red-200 max-w-xs mx-auto">
                  {errors.quantity_num}
                </p>
              )}

              {/* 5. Large Numerical Keypad */}
              <div className="my-3">
                <span className="text-xs font-bold text-gray-500 block mb-2">
                  {t('createPost.keypadExact', 'ఖచ్చితమైన సంఖ్యను నొక్కండి:')}
                </span>
                <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => (k === '⌫' ? handleKeypadBackspace() : handleKeypadDigit(k))}
                      className={`py-3.5 rounded-2xl font-black text-2xl border shadow-xs active:scale-95 min-h-[54px] flex items-center justify-center transition-all cursor-pointer ${
                        k === '⌫'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                          : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
                      }`}
                      aria-label={
                        k === '⌫'
                          ? t('createPost.backspace', 'Backspace')
                          : k === '.'
                          ? t('createPost.decimalPoint', 'Decimal point')
                          : `Digit ${k}`
                      }
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 6. Back & Next Navigation */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1.5 active:scale-98 min-h-[56px] border border-gray-200 cursor-pointer text-base"
                aria-label={t('createPost.backBtn', '← వెనుకకు')}
              >
                <ChevronLeft size={20} aria-hidden="true" />
                <span>{t('createPost.backBtn', '← వెనుకకు')}</span>
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(2)}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg cursor-pointer"
                aria-label={t('createPost.q2NextBtn', 'తర్వాత: ధర నిర్ణయించండి →')}
              >
                <span>{t('createPost.q2NextBtn', 'తర్వాత: ధర నిర్ణయించండి →')}</span>
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: PRICE ENTRY (FOCUSED EXCLUSIVELY ON PRICE)          */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm text-center">
              {/* Header: Counter & Crop ONLY (ZERO Quantity Info) */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 3, total: totalQuestions })}
                </span>
                <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                  {getSafeCropIcon(activeCropObj?.icon)} {translateCropName(t, form.crop_name)}
                </span>
              </div>

              {/* 1. Heading */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.whatExpectedPrice', 'మీరు ఆశించే ధర ఎంత?')
                  : t('createPost.buyerStep3Title', 'మీ లక్ష్య కొనుగోలు ధర ఎంత?')}
              </h1>

              {/* 2. Automatically Derived Price Unit (Follows Step 2 Quantity Unit) */}
              <div className="my-2.5 flex items-center justify-center">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-50 border border-green-200 text-[#1E5E3A] font-extrabold text-base sm:text-lg shadow-xs">
                  <span>₹ / {translateUnit(t, form.unit || form.price_unit || 'Quintal')}</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-1">
                {t('createPost.priceKeypadHelp', 'కీప్యాడ్‌తో మీరు ఆశించే ధరను నమోదు చేయండి')}
              </p>

              {/* 3. Prominent Price Value Display */}
              <div className={`my-3 py-3.5 px-6 rounded-3xl border-2 max-w-xs mx-auto flex items-baseline justify-center gap-1.5 shadow-xs transition-all ${
                form.is_price_optional ? 'bg-gray-100 border-gray-300 opacity-70' : 'bg-amber-50/90 border-[#D9822B]'
              }`}>
                <span className="text-2xl font-bold text-[#D9822B] shrink-0">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  disabled={form.is_price_optional}
                  value={form.is_price_optional ? '' : form.price}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '')
                    const parts = val.split('.')
                    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val
                    update('price', sanitized)
                    setErrors((prev) => ({ ...prev, price: null }))
                  }}
                  aria-label={t('createPost.priceLabel', 'Price')}
                  placeholder={form.is_price_optional ? t('createPost.negotiable', 'చర్చించదగినది') : '0'}
                  className="w-full text-center text-4xl sm:text-5xl font-black text-[#D9822B] bg-transparent border-0 focus:ring-0 focus:outline-none disabled:text-gray-500 tracking-tight"
                />
                <span className="text-sm sm:text-base font-extrabold text-gray-700 shrink-0">
                  / {translateUnit(t, form.unit || form.price_unit || 'Quintal')}
                </span>
              </div>

              {errors.price && (
                <p className="text-xs text-red-600 font-semibold mb-3 bg-red-50 p-2 rounded-xl border border-red-200 max-w-xs mx-auto">
                  {errors.price}
                </p>
              )}

              {/* Optional Pricing Checkbox for Buyer */}
              {!isFarmer && (
                <label className="flex items-center justify-center gap-2.5 p-3 rounded-2xl bg-amber-50/70 border border-amber-200 cursor-pointer my-2 max-w-sm mx-auto hover:bg-amber-100/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_price_optional)}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setForm((prev) => ({
                        ...prev,
                        is_price_optional: checked,
                        is_negotiable: checked,
                        price: checked ? '' : (prev.price || '2400'),
                      }))
                      setErrors((prev) => ({ ...prev, price: null }))
                    }}
                    className="w-4 h-4 text-[#1E5E3A] rounded border-gray-300 focus:ring-[#1E5E3A]"
                  />
                  <span className="text-xs font-bold text-gray-800 text-left">
                    {t('createPost.priceNegotiableToggle', 'Open to negotiation / Market rate (No fixed ceiling)')}
                  </span>
                </label>
              )}

              {/* 4. Large Numerical Keypad below Price */}
              <div className="my-3">
                <span className="text-xs font-bold text-gray-500 block mb-2">
                  {t('createPost.keypadExact', 'ఖచ్చితమైన సంఖ్యను నొక్కండి:')}
                </span>
                <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={form.is_price_optional}
                      onClick={() => (k === '⌫' ? handleKeypadBackspace() : handleKeypadDigit(k))}
                      className={`py-3.5 rounded-2xl font-black text-2xl border shadow-xs active:scale-95 min-h-[54px] flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        k === '⌫'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                          : 'bg-white hover:bg-gray-50 text-gray-900 border-gray-200 hover:border-gray-300'
                      }`}
                      aria-label={
                        k === '⌫'
                          ? t('createPost.backspace', 'Backspace')
                          : k === '.'
                          ? t('createPost.decimalPoint', 'Decimal point')
                          : `Digit ${k}`
                      }
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mandi Benchmark Price Card (Optional Guidance) */}
              {priceGuidance && !form.is_price_optional && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-2.5 my-2 max-w-xs mx-auto text-left">
                  <button
                    type="button"
                    onClick={() => {
                      update('price', String(priceGuidance.modal_price))
                      speak(t('createPost.mandiRecommendationSelected', { price: priceGuidance.modal_price }), ttsLang)
                    }}
                    className="w-full bg-white hover:bg-amber-100 text-amber-950 font-bold text-xs py-1.5 px-3 rounded-xl border border-amber-300 shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>💡 {t('createPost.q3UseMandi', { price: priceGuidance.modal_price, defaultValue: `సిఫార్సు ధర: ₹${priceGuidance.modal_price}` })}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 5. Back & Next Navigation */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1.5 active:scale-98 min-h-[56px] border border-gray-200 cursor-pointer text-base"
                aria-label={t('createPost.backBtn', '← వెనుకకు')}
              >
                <ChevronLeft size={20} aria-hidden="true" />
                <span>{t('createPost.backBtn', '← వెనుకకు')}</span>
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(3)}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg cursor-pointer"
                aria-label={t('createPost.q3NextBtn', 'తర్వాత: డెలివరీ సమయం →')}
              >
                <span>{t('createPost.q3NextBtn', 'తర్వాత: డెలివరీ సమయం →')}</span>
                <ChevronRight size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: TIME OF DELIVERY / DELIVERY REQUIREMENT              */}
        {/* ============================================================ */}
        {step === 4 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full mb-2 inline-block">
                {t('createPost.guidedStepCounter', { current: 4, total: totalQuestions })}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.whenCanDeliver', 'మీ పంటను ఎప్పుడు అందించగలరు?')
                  : t('createPost.buyerStep4Title', 'డెలివరీ ఎప్పటిలోగా కావాలి?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isFarmer
                  ? t('createPost.deliveryTouchHelp', 'మీ పంట ఎప్పుడు సిద్ధంగా ఉంటుందో కింద తాకండి')
                  : t('createPost.buyerStep4Sub', 'పంట డెలివరీ ఎప్పటిలోగా కావాలో కింద తాకండి')}
              </p>

              {isFarmer ? (
                /* Farmer Options: Today, Tomorrow, Custom */
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleFarmerDeliveryChoice('today')}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.delivery_choice === 'today'
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock size={28} className="text-[#1E5E3A]" />
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {t('createPost.q4Today', 'ఈరోజే')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('createPost.q4TodayDesc', 'వెంటనే పికప్ లేదా డెలివరీకి సిద్ధం')}
                        </p>
                      </div>
                    </div>
                    {form.delivery_choice === 'today' && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFarmerDeliveryChoice('tomorrow')}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.delivery_choice === 'tomorrow'
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={28} className="text-[#1E5E3A]" />
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {t('createPost.q4Tomorrow', 'రేపు')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('createPost.q4TomorrowDesc', 'మరుసటి రోజు సిద్ధంగా ఉంటుంది')}
                        </p>
                      </div>
                    </div>
                    {form.delivery_choice === 'tomorrow' && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFarmerDeliveryChoice('custom')}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.delivery_choice === 'custom'
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={28} className="text-[#D9822B]" />
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {t('createPost.q4Custom', 'వేరే తేదీని ఎంచుకోండి')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('createPost.q4CustomDesc', 'నిర్దిష్ట భవిష్యత్ తేదీని పేర్కొనండి')}
                        </p>
                      </div>
                    </div>
                    {form.delivery_choice === 'custom' && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>

                  {form.delivery_choice === 'custom' && (
                    <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 mt-2">
                      <label className="text-xs font-bold text-gray-700 block mb-1">
                        {t('createPost.q4DatePickerLabel', 'డెలివరీ తేదీని ఎంచుకోండి:')}
                      </label>
                      <input
                        type="date"
                        min={getOffsetDateString(0)}
                        value={form.target_date}
                        onChange={(e) => update('target_date', e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Buyer Options: Within 7 Days, Within 15 Days, Within 30 Days, Custom Date */
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleBuyerDeliveryChoice('7days')}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.delivery_choice === '7days'
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock size={28} className="text-[#1E5E3A]" />
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {t('createPost.buyerStep4In7Days', '7 రోజుల్లోగా')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('createPost.buyerStep4In7DaysDesc', 'ఒక వారంలోగా తక్షణ అవసరం')}
                        </p>
                      </div>
                    </div>
                    {form.delivery_choice === '7days' && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBuyerDeliveryChoice('15days')}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.delivery_choice === '15days'
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={28} className="text-[#1E5E3A]" />
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {t('createPost.buyerStep4In15Days', '15 రోజుల్లోగా')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('createPost.buyerStep4In15DaysDesc', 'రెండు వారాల్లోగా సేకరణ')}
                        </p>
                      </div>
                    </div>
                    {form.delivery_choice === '15days' && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBuyerDeliveryChoice('30days')}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.delivery_choice === '30days'
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={28} className="text-[#D9822B]" />
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {t('createPost.buyerStep4In30Days', '30 రోజుల్లోగా')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('createPost.buyerStep4In30DaysDesc', 'నెలాఖరులోగా సేకరణ')}
                        </p>
                      </div>
                    </div>
                    {form.delivery_choice === '30days' && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBuyerDeliveryChoice('custom')}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.delivery_choice === 'custom'
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={28} className="text-[#1E5E3A]" />
                      <div>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {t('createPost.buyerStep4CustomDate', 'నిర్దిష్ట తేదీని ఎంచుకోండి')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('createPost.buyerStep4CustomDateDesc', 'క్యాలెండర్ నుండి నిర్దిష్ట తేదీని పేర్కొనండి')}
                        </p>
                      </div>
                    </div>
                    {form.delivery_choice === 'custom' && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>

                  {form.delivery_choice === 'custom' && (
                    <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200 mt-2">
                      <label className="text-xs font-bold text-gray-700 block mb-1">
                        {t('createPost.q4DatePickerLabel', 'డెలివరీ తేదీని ఎంచుకోండి:')}
                      </label>
                      <input
                        type="date"
                        min={getOffsetDateString(0)}
                        value={form.target_date}
                        onChange={(e) => update('target_date', e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Back & Next Navigation */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-1/3 bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 min-h-[56px]"
              >
                <ChevronLeft size={20} /> {t('createPost.backBtn', '← వెనుకకు')}
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(4)}
                className="flex-1 bg-[#1E5E3A] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg"
              >
                <span>
                  {isFarmer
                    ? t('createPost.q4NextBtn', 'సమీక్షించండి →')
                    : 'తర్వాత: సేకరణ ప్రాంతం →'}
                </span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5 (BUYER ONLY): PREFERRED SOURCING LOCATION             */}
        {/* ============================================================ */}
        {step === 5 && !isFarmer && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full mb-2 inline-block">
                {t('createPost.guidedStepCounter', { current: 5, total: totalQuestions })}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {t('createPost.buyerStep5Title', 'మీరు ఏ ప్రాంతం నుండి సేకరించాలనుకుంటున్నారు?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.buyerStep5Sub', 'మీ నమోదిత ప్రాంతాన్ని ఉంచండి లేదా నిర్దిష్ట జిల్లాను ఎంచుకోండి')}
              </p>

              <div className="mt-5 space-y-3">
                {/* Choice 1: Registered Location */}
                {user?.location && (
                  <button
                    type="button"
                    onClick={() => {
                      update('location', user.location)
                      speak(user.location, ttsLang)
                    }}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                      form.location === user.location
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 size={26} className="text-[#1E5E3A]" />
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">
                          {t('createPost.buyerStep5Registered', 'నమోదిత ప్రాంతం')}
                        </span>
                        <p className="font-extrabold text-gray-900 text-base">
                          {user.location}
                        </p>
                      </div>
                    </div>
                    {form.location === user.location && <Check size={18} className="text-[#1E5E3A]" />}
                  </button>
                )}

                {/* Choice 2: Open to All Regions */}
                <button
                  type="button"
                  onClick={() => {
                    update('location', 'All Regions (Any Location)')
                    speak(t('createPost.buyerStep5AllRegions'), ttsLang)
                  }}
                  className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between active:scale-98 min-h-[64px] ${
                    form.location === 'All Regions (Any Location)'
                      ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Globe size={26} className="text-[#D9822B]" />
                    <div>
                      <p className="font-extrabold text-gray-900 text-base">
                        {t('createPost.buyerStep5AllRegions', 'అన్ని ప్రాంతాలు (ఎక్కడి నుండైనా)')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('createPost.buyerStep5AllRegionsDesc', 'అన్ని జిల్లాల రైతుల పంటలను స్వీకరించండి')}
                      </p>
                    </div>
                  </div>
                  {form.location === 'All Regions (Any Location)' && <Check size={18} className="text-[#1E5E3A]" />}
                </button>

                {/* Choice 3: One-Touch Popular Sourcing Districts */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-gray-600 block mb-2">
                    {t('createPost.buyerStep5DistrictPrompt', 'జిల్లా పేరును ఎంచుకోండి లేదా రాయండి:')}
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pb-1">
                    {POPULAR_SOURCING_DISTRICTS.map((dist) => {
                      const isDistSelected = form.location === dist
                      return (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => {
                            update('location', dist)
                            speak(dist, ttsLang)
                          }}
                          className={`text-xs px-3 py-2 rounded-xl font-bold border transition-all active:scale-95 ${
                            isDistSelected
                              ? 'bg-[#1E5E3A] text-white border-[#1E5E3A] shadow-xs'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200'
                          }`}
                        >
                          {dist}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Choice 4: Free-Text Custom Location (Village, Mandal, District, State) */}
                <div className="pt-3 border-t border-gray-100">
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    {t('createPost.manualLocationLabel', 'లేదా కస్టమ్ ప్రాంతాన్ని రాయండి (గ్రామం, మండలం, జిల్లా, రాష్ట్రం)')}
                  </label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => update('location', e.target.value)}
                      placeholder={t('createPost.manualLocationPlaceholder', 'ఉదా. తెనాలి, గుంటూరు జిల్లా, ఆంధ్రప్రదేశ్')}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E5E3A]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {t('createPost.manualLocationHint', 'నిర్దిష్ట సేకరణ కేంద్రాలు, మండలాలు, గ్రామాలు లేదా రాష్ట్రాలను నమోదు చేయండి')}
                  </p>
                </div>
              </div>
            </div>

            {/* Back & Next Navigation */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-1/3 bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 min-h-[56px]"
              >
                <ChevronLeft size={20} /> {t('createPost.backBtn', '← వెనుకకు')}
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(5)}
                className="flex-1 bg-[#1E5E3A] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg"
              >
                <span>{t('createPost.q4NextBtn', 'సమీక్షించండి →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* FINAL REVIEW & TOUCH PUBLISH (STEP 5 FARMER / STEP 6 BUYER)  */}
        {/* ============================================================ */}
        {step === reviewStep && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900">
                  {isFarmer
                    ? t('createPost.reviewTitle', 'మీ పంట వివరాల సమీక్ష')
                    : t('createPost.buyerStep6Title', 'కొనుగోలు అవసరం సమీక్ష')}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isFarmer
                    ? t('createPost.reviewSub', 'వివరాలు సరిచూసుకుని పోస్ట్ చేయడానికి కింద ఉన్న ఆకుపచ్చ బటన్ తాకండి')
                    : t('createPost.buyerStep6Sub', 'వివరాలు సరిచూసుకుని ప్రచురించడానికి కింద ఉన్న ఆకుపచ్చ బటన్ తాకండి')}
                </p>
              </div>
              <button
                type="button"
                onClick={readSummaryAloud}
                className="bg-green-100 hover:bg-green-200 text-[#1E5E3A] font-extrabold px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs shadow-xs active:scale-95"
              >
                <Volume2 size={16} className={isSpeakingInstruction ? 'animate-bounce text-amber-600' : ''} />
                <span>{t('createPost.listenSummary', 'సారాంశం వినండి')}</span>
              </button>
            </div>

            {/* Clean Summary Cards with Edit ("మార్చు") Buttons */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              {/* Crop */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getSafeCropIcon(activeCropObj?.icon)}</span>
                  <div>
                    <span className="text-xs font-bold text-gray-400 block">
                      {t('createPost.stepCropName', 'పంట')}
                    </span>
                    <p className="font-extrabold text-gray-900 text-lg flex items-center flex-wrap gap-2">
                      <span>{translateCropName(t, form.crop_name)}</span>
                      {form.variety && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg">
                          {form.variety}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl active:scale-95"
                >
                  {t('createPost.editBtn', 'మార్చు')}
                </button>
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                <div>
                  <span className="text-xs font-bold text-gray-400 block">
                    {t('createPost.stepQtyName', 'పరిమాణం')}
                  </span>
                  <p className="font-extrabold text-gray-900 text-lg">
                    {form.quantity_num} {translateUnit(t, form.unit)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl active:scale-95"
                >
                  {t('createPost.editBtn', 'మార్చు')}
                </button>
              </div>

              {/* Price / Target Budget */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                <div>
                  <span className="text-xs font-bold text-gray-400 block">
                    {isFarmer ? t('createPost.stepPriceName', 'ధర') : t('createPost.budgetCeilingLabel', 'లక్ష్య బడ్జెట్')}
                  </span>
                  <p className="font-extrabold text-[#D9822B] text-xl">
                    {form.is_price_optional || !form.price ? (
                      <span className="text-emerald-700 text-base font-bold">
                        {t('createPost.priceNegotiableToggle', 'ధర అవసరం లేదు / మార్కెట్ రేటు లేదా సంప్రదింపులకు సిద్ధం')}
                      </span>
                    ) : (
                      `₹${form.price} / ${translateUnit(t, form.price_unit)}`
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl active:scale-95"
                >
                  {t('createPost.editBtn', 'మార్చు')}
                </button>
              </div>

              {/* Delivery */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                <div>
                  <span className="text-xs font-bold text-gray-400 block">
                    {t('createPost.stepDeliveryName', 'డెలివరీ సమయం')}
                  </span>
                  <p className="font-extrabold text-gray-900 text-base">
                    {isFarmer
                      ? form.delivery_choice === 'today'
                        ? t('createPost.q4Today', 'ఈరోజే')
                        : form.delivery_choice === 'tomorrow'
                        ? t('createPost.q4Tomorrow', 'రేపు')
                        : form.target_date
                      : form.delivery_choice === '7days'
                      ? t('createPost.buyerStep4In7Days', '7 రోజుల్లోగా')
                      : form.delivery_choice === '15days'
                      ? t('createPost.buyerStep4In15Days', '15 రోజుల్లోగా')
                      : form.delivery_choice === '30days'
                      ? t('createPost.buyerStep4In30Days', '30 రోజుల్లోగా')
                      : form.target_date}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl active:scale-95"
                >
                  {t('createPost.editBtn', 'మార్చు')}
                </button>
              </div>

              {/* Location (with Edit button for Buyer) */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                <div className="flex items-center gap-2 text-gray-800">
                  <MapPin size={18} className="text-[#1E5E3A] shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-gray-400 block">
                      {isFarmer ? t('postCard.location', 'Location') : t('createPost.sourcingLocationLabel', 'సేకరణ ప్రాంతం')}
                    </span>
                    <p className="font-extrabold text-gray-900 text-base">
                      {form.location || user?.location || (isFarmer ? t('createPost.profileLocation', 'Profile Registered Location') : 'All Regions')}
                    </p>
                  </div>
                </div>
                {!isFarmer && (
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl active:scale-95"
                  >
                    {t('createPost.editBtn', 'మార్చు')}
                  </button>
                )}
                {isFarmer && (
                  <span className="text-[10px] text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                    ✓ {t('createPost.autoLocation', 'స్వయంచాలకంగా తీసుకోబడింది')}
                  </span>
                )}
              </div>
            </div>

            {/* Optional Details Accordion (Photos, variety, grade, delivery preferences, description) */}
            <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                className="w-full p-4 flex items-center justify-between text-left font-bold text-gray-700 text-sm hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-[#1E5E3A]" />
                  <span>{t('createPost.optionalFieldsTitle', 'ఐచ్ఛిక వివరాలు (ఫోటోలు & వివరణ - అవసరమైతేనే)')}</span>
                </div>
                {showOptionalDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {showOptionalDetails && (
                <div className="p-4 pt-1 border-t border-gray-100 space-y-4 animate-slide-up">
                  <ImagePicker
                    value={form.image}
                    onChange={(url) => update('image', url)}
                    label={t('createPost.photoOptional', 'పంట ఫోటో (ఐచ్ఛికం)')}
                  />

                  {/* Variety (Optional) */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t('createPost.varietyPrompt', 'రకం / వెరైటీ (ఐచ్ఛికం):')}
                    </label>
                    {activeCropObj?.varieties?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {activeCropObj.varieties.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => update('variety', form.variety === v ? '' : v)}
                            className={`text-xs px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer ${
                              form.variety === v
                                ? 'bg-[#1E5E3A] text-white border-[#1E5E3A]'
                                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={form.variety}
                      onChange={(e) => update('variety', e.target.value)}
                      placeholder={t('createPost.customVarietyPlaceholder', 'e.g. BPT 5204, Sona Masoori, Red Flesh...')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E5E3A]"
                    />
                  </div>

                  {/* Quality Grade / Specifications (Optional) */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t('createPost.qualityGradePrompt', 'నాణ్యతా ప్రమాణం / గ్రేడ్ (ఐచ్ఛికం):')}
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {['Grade A / Premium', 'Grade B / Good', 'Standard', 'Organic / Chemical-Free'].map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => update('quality_grade', form.quality_grade === grade ? '' : grade)}
                          className={`text-xs px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer ${
                            form.quality_grade === grade
                              ? 'bg-[#1E5E3A] text-white border-[#1E5E3A]'
                              : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={form.quality_grade}
                      onChange={(e) => update('quality_grade', e.target.value)}
                      placeholder="e.g. Grade A, Moisture < 12%, Cleaned & Sorted..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E5E3A]"
                    />
                  </div>

                  {/* Delivery Preferences / Packaging (Optional) */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t('createPost.deliveryNotesPrompt', 'డెలివరీ ప్రాధాన్యతలు & ప్యాకింగ్ వివరాలు (ఐచ్ఛికం):')}
                    </label>
                    <textarea
                      rows={2}
                      value={form.delivery_preferences}
                      onChange={(e) => update('delivery_preferences', e.target.value)}
                      placeholder={t('createPost.deliveryNotesPlaceholder', 'ఉదా. బస్తా ప్యాకింగ్, వ్యవసాయ క్షేత్రం వద్ద పికప్, రవాణా షరతులు మొదలైనవి')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E5E3A]"
                    />
                  </div>

                  {/* General Description / Additional Notes (Optional) */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t('createPost.descOptional', 'అదనపు వివరాలు (ఐచ్ఛికం)')}
                    </label>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      placeholder={t('createPost.descPlaceholder', 'Crop quality, grade or additional details...')}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1E5E3A]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Back & Touch Publish Button */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(isFarmer ? 4 : 5)}
                className="w-1/3 bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 min-h-[56px]"
              >
                <ChevronLeft size={20} /> {t('createPost.backBtn', '← వెనుకకు')}
              </button>

              {/* Explicit Touch Confirmation Button to Publish */}
              <button
                type="button"
                disabled={submitting}
                onClick={handlePublish}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg min-h-[56px] text-lg"
              >
                {submitting ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <span>
                    {isFarmer
                      ? t('createPost.publishBtn', '🌾 నా పంటను పోస్ట్ చేయండి')
                      : t('createPost.buyerPublishBtn', '📢 కొనుగోలు అవసరాన్ని ప్రచురించండి')}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Mobile OTP Verification Modal */}
      <OtpVerificationModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onVerified={() => {
          setShowOtpModal(false)
          handlePublish()
        }}
        initialMobile={user?.mobile}
        promptReason={t('auth.otp.promptActionPublish', 'Please verify your mobile number to publish a listing.')}
      />
    </div>
  )
}
