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
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createPost, getCropsCatalog, getPriceGuidance } from '../services/api.js'
import { translateCropName, translateUnit, translateAgriCategory } from '../utils/i18nHelpers.js'
import { getSelectedLanguage, speak, stopSpeaking } from '../utils/onboarding.js'

const CATEGORIES = ['All', 'Cereals', 'Vegetables', 'Spices', 'Cash Crops', 'Pulses', 'Fruits']
const STANDARD_UNITS = ['Kg', 'Quintal', 'Ton']
const DRAFT_KEY_PREFIX = 'agriconnect_draft_post_'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

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

  // Authenticated user-scoped draft key
  const draftKey = user?.id ? `${DRAFT_KEY_PREFIX}${user.id}` : null
  const [draftRestored, setDraftRestored] = useState(false)
  const isDraftLoadedRef = useRef(false)

  // Guided wizard step state:
  // 1: Crop (పంట)
  // 2: Quantity (పరిమాణం)
  // 3: Expected Price (ఆశించే ధర)
  // 4: Delivery Time (డెలివరీ సమయం)
  // 5: Final Review & Publishing (సమీక్ష & ప్రచురణ)
  const [step, setStep] = useState(1)

  // Audio instruction indicator
  const [isSpeakingInstruction, setIsSpeakingInstruction] = useState(false)

  // Master Crops Catalog
  const [catalog, setCatalog] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [cropSearch, setCropSearch] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  // 4 Core Posting Information State + Profile Fallbacks
  const [form, setForm] = useState({
    // Step 1: Crop
    crop_name: '',
    category: '',
    // Step 2: Quantity
    quantity_num: '50',
    unit: 'Quintal',
    // Step 3: Expected Price
    price: '2350',
    price_unit: 'Quintal',
    is_negotiable: false,
    // Step 4: Delivery Time
    delivery_choice: 'today', // 'today' | 'tomorrow' | 'custom'
    target_date: getOffsetDateString(0),
    time_of_day: 'anytime',
    // Optional / Profile defaults
    variety: '',
    location: user?.location || '',
    title: '',
    description: '',
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

  // Load Crops Catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true)
      try {
        const res = await getCropsCatalog()
        setCatalog(res.data || [])
      } catch {
        // Fallback static list handled gracefully
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
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
            }))
            if (parsed.step && parsed.step >= 1 && parsed.step <= 5) {
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
  }, [draftKey, t])

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
      version: 4,
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
      quantity_num: '50',
      unit: 'Quintal',
      price: '2350',
      price_unit: 'Quintal',
      is_negotiable: false,
      delivery_choice: 'today',
      target_date: getOffsetDateString(0),
      time_of_day: 'anytime',
      variety: '',
      location: user?.location || '',
      title: '',
      description: '',
      image: null,
    })
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
      (c) => c.name.toLowerCase() === form.crop_name.toLowerCase()
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

  // Read full listing summary aloud before publication (Requirement 8)
  function readSummaryAloud() {
    stopSpeaking()
    setIsSpeakingInstruction(true)

    const cropText = translateCropName(t, form.crop_name) || t('createPost.stepCropName', 'Crop')
    const unitText = translateUnit(t, form.unit)
    const priceUnitText = translateUnit(t, form.price_unit)
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
  }

  // Select crop from visual card
  function handleSelectCrop(crop) {
    setForm((prev) => ({
      ...prev,
      crop_name: crop.name,
      category: crop.category,
      unit: crop.default_unit || prev.unit,
      price_unit: crop.default_unit || prev.price_unit,
    }))
    setErrors((prev) => ({ ...prev, crop_name: null }))

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

  // Plus / Minus adjustments for Quantity
  function adjustQuantity(delta) {
    const current = parseFloat(form.quantity_num) || 0
    const nextVal = Math.max(1, current + delta)
    update('quantity_num', String(nextVal))
    const unitName = translateUnit(t, form.unit)
    speak(`${nextVal} ${unitName}`, ttsLang)
  }

  // Plus / Minus adjustments for Price
  function adjustPrice(delta) {
    const current = parseFloat(form.price) || 0
    const nextVal = Math.max(10, current + delta)
    update('price', String(nextVal))
    speak(t('createPost.spokenPrice', { price: nextVal }), ttsLang)
  }

  // On-screen numeric keypad input (zero typing on phone keyboard required)
  function handleKeypadDigit(digit) {
    if (step === 2) {
      const next = form.quantity_num === '0' ? String(digit) : `${form.quantity_num}${digit}`
      update('quantity_num', next)
    } else if (step === 3) {
      const next = form.price === '0' ? String(digit) : `${form.price}${digit}`
      update('price', next)
    }
  }

  function handleKeypadBackspace() {
    if (step === 2) {
      const next = form.quantity_num.slice(0, -1) || '0'
      update('quantity_num', next)
    } else if (step === 3) {
      const next = form.price.slice(0, -1) || '0'
      update('price', next)
    }
  }

  // Delivery Choice handler
  function handleDeliveryChoice(choice) {
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

  // Step Validation & Progression
  function validateAndNext(currentStep) {
    stopSpeaking()

    if (currentStep === 1) {
      if (!form.crop_name.trim()) {
        const errMsg = t('createPost.q1Error', 'Please select a crop to continue')
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
      setStep(3)
    } else if (currentStep === 3) {
      const p = parseFloat(form.price)
      if (isNaN(p) || p <= 0) {
        const errMsg = t('createPost.q3Error', 'Please enter an expected price greater than 0')
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
      setErrors({})
      setStep(5) // Move to Final Review
    }
  }

  // Submit Listing (From Step 5 Review - Requires Farmer Touch)
  async function handlePublish() {
    if (isPublishingRef.current || submitting) return

    stopSpeaking()

    if (!form.crop_name.trim()) {
      setStep(1)
      toast.error(t('createPost.q1Error', 'Please select a crop'))
      return
    }

    const titleToUse =
      form.title.trim() ||
      `${isFarmer ? 'Fresh Harvest' : 'Requirement:'} ${form.crop_name} ${
        form.quantity_num ? `- ${form.quantity_num} ${form.unit}` : ''
      }`.trim()

    const quantityFormatted = form.quantity_num ? `${form.quantity_num} ${form.unit}` : null

    let deliveryFormatted = form.target_date
    if (form.delivery_choice === 'today') {
      deliveryFormatted = `Today (${form.target_date})`
    } else if (form.delivery_choice === 'tomorrow') {
      deliveryFormatted = `Tomorrow (${form.target_date})`
    }
    if (form.time_of_day && form.time_of_day !== 'anytime') {
      deliveryFormatted += ` - ${form.time_of_day}`
    }

    isPublishingRef.current = true
    setSubmitting(true)
    try {
      const res = await createPost({
        title: titleToUse,
        crop_name: form.crop_name.trim(),
        category: form.category || null,
        variety: form.variety.trim() || null,
        quality_grade: 'Grade A / Premium',
        quantity: quantityFormatted,
        price: form.price ? parseFloat(form.price) : null,
        is_negotiable: form.is_negotiable,
        location: form.location.trim() || user?.location || null,
        target_date: deliveryFormatted,
        description: form.description.trim() || null,
        image: form.image,
      })

      setPublishedPost(res.data)
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey)
        } catch {}
      }
      setDraftRestored(false)
      speak(t('createPost.audioSuccessCelebration'), ttsLang)
      toast.success(
        isFarmer
          ? t('createPost.successToastFarmer', 'Crop posted! Industries will see it now.')
          : t('createPost.successToastIndustry', 'Requirement posted!')
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
  const filteredCatalog = catalog.filter((crop) => {
    const matchesCategory =
      selectedCategory === 'All' || crop.category.toLowerCase() === selectedCategory.toLowerCase()
    const matchesSearch =
      !cropSearch.trim() ||
      crop.name.toLowerCase().includes(cropSearch.toLowerCase()) ||
      (crop.telugu && crop.telugu.toLowerCase().includes(cropSearch.toLowerCase())) ||
      (crop.hindi && crop.hindi.toLowerCase().includes(cropSearch.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  // Selected crop object if any
  const activeCropObj = catalog.find(
    (c) => c.name.toLowerCase() === form.crop_name.toLowerCase()
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
              : t('createPost.successBadgeIndustry', 'Requirement Live!')}
          </span>

          <h2 className="font-display font-bold text-gray-900 text-2xl sm:text-3xl mt-3">
            {publishedPost.title}
          </h2>

          <p className="text-sm text-gray-600 mt-2">
            {isFarmer
              ? t('createPost.successFarmerHelp', 'Your crop is now visible to verified industries in the marketplace.')
              : t('createPost.successIndustryHelp', 'Your requirement is now visible to verified farmers in the marketplace.')}
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
                <span className="text-gray-600 font-medium">{t('createPost.reviewPrice', 'Price')}:</span>
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
                  quantity_num: '50',
                  unit: 'Quintal',
                  price: '2350',
                  price_unit: 'Quintal',
                  is_negotiable: false,
                  delivery_choice: 'today',
                  target_date: getOffsetDateString(0),
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
        title={isFarmer ? t('createPost.titleFarmer', 'Post Your Crop') : t('createPost.titleIndustry', 'Post Requirement')}
        subtitle={
          step <= 4
            ? t('createPost.guidedStepCounter', { current: step, defaultValue: `Step ${step} of 4` })
            : t('createPost.guidedFinalReview', 'Final Review')
        }
        showSearch={false}
      />

      {/* Top Banner: AI Guided Posting Badge & Replay Audio Button */}
      <div className="max-w-md mx-auto px-4 pt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1E5E3A]">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse" />
          <span>{t('createPost.guidedPostingBadge', 'AI గైడెడ్ పోస్టింగ్ · చూసి, తాకి, వినండి')}</span>
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

      {/* 4-Segment Visual Progress Bar */}
      <div className="max-w-md mx-auto px-4 pt-2">
        <div className="bg-white rounded-2xl p-3 border border-gray-200/80 shadow-xs">
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

          <div className="grid grid-cols-4 gap-1.5 h-2.5">
            {[1, 2, 3, 4].map((s) => (
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
                  {t('createPost.guidedStepCounter', { current: 1, defaultValue: 'దశ 1 / 4' })}
                </span>
                <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                  <Volume2 size={14} className="text-[#1E5E3A]" /> {t('createPost.touchSpeaks', 'తాకినప్పుడు వినిపిస్తుంది')}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {t('createPost.touchToSelectCrop', 'మీ పంట చిత్రాన్ని తాకండి')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.touchToSelectCropSub', 'మీ వద్ద ఉన్న పంటను కింద ఉన్న బొమ్మలలో చూసి ఎంచుకోండి')}
              </p>
            </div>

            {/* Selected Crop Banner */}
            {form.crop_name && (
              <div className="bg-green-100/90 border-2 border-[#1E5E3A] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{activeCropObj?.icon || '🌾'}</span>
                  <div>
                    <span className="text-[10px] text-[#1E5E3A] font-extrabold uppercase tracking-wide block">
                      {t('createPost.selectedCrop', 'ఎంచుకున్న పంట')}
                    </span>
                    <p className="font-extrabold text-gray-900 text-lg">
                      {translateCropName(t, form.crop_name)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('crop_name', '')}
                  className="text-xs font-bold text-red-700 bg-white px-3 py-1.5 rounded-xl border border-red-200 active:scale-95"
                >
                  {t('createPost.editBtn', 'మార్చు')}
                </button>
              </div>
            )}

            {/* Category Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-3.5 py-2 rounded-full font-bold shrink-0 transition-all active:scale-95 min-h-[36px] ${
                    selectedCategory === cat
                      ? 'bg-[#1E5E3A] text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {translateAgriCategory(t, cat)}
                </button>
              ))}
            </div>

            {/* Crop Grid with Large Pictures */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {filteredCatalog.map((crop) => {
                const isSelected = form.crop_name.toLowerCase() === crop.name.toLowerCase()
                return (
                  <button
                    key={crop.name}
                    type="button"
                    onClick={() => handleSelectCrop(crop)}
                    className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between min-h-[110px] active:scale-95 ${
                      isSelected
                        ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                        : 'border-gray-200 bg-white hover:border-[#1E5E3A]/60 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-4xl">{crop.icon}</span>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#1E5E3A] text-white flex items-center justify-center">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className="font-extrabold text-gray-900 text-base leading-tight">
                        {crop.telugu ? crop.telugu.split('(')[0] : crop.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{crop.name}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Next Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => validateAndNext(1)}
                className={`w-full font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md min-h-[56px] text-lg ${
                  form.crop_name.trim()
                    ? 'bg-[#1E5E3A] hover:bg-[#16482c] text-white'
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
        {/* STEP 2: QUANTITY WITH LARGE PLUS / MINUS CONTROLS           */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm text-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 2, defaultValue: 'దశ 2 / 4' })}
                </span>
                <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                  {activeCropObj?.icon} {translateCropName(t, form.crop_name)}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {t('createPost.howMuchQty', 'ఎంత పరిమాణం ఉంది?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.qtyTouchHelp', '+ మరియు - బటన్లతో పరిమాణాన్ని మార్చండి (టైపింగ్ అవసరం లేదు)')}
              </p>

              {/* Large Numeric Display with Plus and Minus Buttons */}
              <div className="my-6 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => adjustQuantity(-5)}
                  className="w-16 h-16 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 flex items-center justify-center font-black text-3xl shadow-sm border border-gray-300 active:scale-95"
                  title="తగ్గించు"
                >
                  <Minus size={28} strokeWidth={3} />
                </button>

                <div className="min-w-[140px] px-4 py-3 rounded-3xl bg-green-50 border-2 border-[#1E5E3A]">
                  <span className="text-4xl sm:text-5xl font-black text-gray-900 block">
                    {form.quantity_num || '0'}
                  </span>
                  <span className="text-xs font-extrabold text-[#1E5E3A] uppercase tracking-wider block mt-1">
                    {form.unit === 'Quintal' ? 'క్వింటాళ్లు' : form.unit === 'Ton' ? 'టన్నులు' : 'కిలోలు'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => adjustQuantity(5)}
                  className="w-16 h-16 rounded-2xl bg-[#1E5E3A] hover:bg-[#16482c] text-white flex items-center justify-center font-black text-3xl shadow-md active:scale-95"
                  title="పెంచు"
                >
                  <Plus size={28} strokeWidth={3} />
                </button>
              </div>

              {/* Unit Selection Pills: Kg, Quintal, Ton */}
              <div className="grid grid-cols-3 gap-2.5 mt-4">
                {STANDARD_UNITS.map((u) => {
                  const isSelected = form.unit === u
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        update('unit', u)
                        update('price_unit', u)
                        speak(`${translateUnit(t, u)} ${t('createPost.unitSelected')}`, ttsLang)
                      }}
                      className={`py-3.5 px-2 rounded-2xl font-bold text-sm sm:text-base border-2 transition-all min-h-[50px] flex items-center justify-center gap-1.5 active:scale-95 ${
                        isSelected
                          ? 'bg-[#1E5E3A] text-white border-[#1E5E3A] shadow-md'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {isSelected && <Check size={16} strokeWidth={3} />}
                      <span>{translateUnit(t, u)}</span>
                    </button>
                  )
                })}
              </div>

              {/* Quick Preset Increments */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap justify-center gap-2">
                {['+1', '+5', '+10', '+50', '+100'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => adjustQuantity(parseInt(preset))}
                    className="text-xs sm:text-sm font-extrabold px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-green-100 text-gray-800 active:scale-95 min-h-[40px]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Back & Next Navigation */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 min-h-[56px]"
              >
                <ChevronLeft size={20} /> {t('createPost.backBtn', '← వెనుకకు')}
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(2)}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg"
              >
                <span>{t('createPost.q2NextBtn', 'తర్వాత: ధర నిర్ణయించండి →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: EXPECTED PRICE WITH RUPEE STEPPERS & KEYPAD          */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm text-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 3, defaultValue: 'దశ 3 / 4' })}
                </span>
                <span className="text-xs font-bold text-gray-600">
                  {form.quantity_num} {form.unit === 'Quintal' ? 'క్వింటాళ్లు' : form.unit}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {t('createPost.whatExpectedPrice', 'మీరు ఆశించే ధర ఎంత?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.priceTouchHelp', '+ మరియు - బటన్లతో లేదా కీప్యాడ్‌తో ధరను నిర్ణయించండి')}
              </p>

              {/* Large Rupee Display */}
              <div className="my-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => adjustPrice(-100)}
                  className="w-14 h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-900 flex items-center justify-center font-black text-2xl shadow-sm border border-gray-300 active:scale-95"
                >
                  -100
                </button>

                <div className="min-w-[150px] px-4 py-3 rounded-3xl bg-amber-50 border-2 border-[#D9822B]">
                  <span className="text-4xl sm:text-5xl font-black text-[#D9822B] block">
                    ₹{form.price || '0'}
                  </span>
                  <span className="text-xs font-bold text-gray-600 block mt-1">
                    / {form.price_unit === 'Quintal' ? 'క్వింటాల్‌కు' : form.price_unit === 'Ton' ? 'టన్నుకు' : 'కిలోకు'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => adjustPrice(100)}
                  className="w-14 h-14 rounded-2xl bg-[#D9822B] hover:bg-amber-600 text-white flex items-center justify-center font-black text-2xl shadow-md active:scale-95"
                >
                  +100
                </button>
              </div>

              {/* Mandi Benchmark Price Card */}
              {priceGuidance && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 my-3 text-left">
                  <p className="text-xs text-amber-950 font-medium">
                    {t('createPost.q3MandiRange', {
                      market: priceGuidance.market_name,
                      min: priceGuidance.min_price,
                      max: priceGuidance.max_price,
                      unit: form.price_unit,
                      defaultValue: `మండీ మార్కెట్ ధర: ₹${priceGuidance.min_price} – ₹${priceGuidance.max_price} (${priceGuidance.market_name})`,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      update('price', String(priceGuidance.modal_price))
                      speak(t('createPost.mandiRecommendationSelected', { price: priceGuidance.modal_price }), ttsLang)
                    }}
                    className="mt-2 bg-white hover:bg-amber-100 text-amber-950 font-bold text-xs py-1.5 px-3 rounded-xl border border-amber-300 shadow-xs"
                  >
                    💡 {t('createPost.q3UseMandi', { price: priceGuidance.modal_price, defaultValue: `సిఫార్సు ధరను వాడండి: ₹${priceGuidance.modal_price}` })}
                  </button>
                </div>
              )}

              {/* On-Screen Numeric Keypad (No mobile keyboard needed) */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-500 block mb-2">
                  {t('createPost.keypadExact', 'ఖచ్చితమైన సంఖ్యను నొక్కండి:')}
                </span>
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '0', '⌫'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => (k === '⌫' ? handleKeypadBackspace() : handleKeypadDigit(k))}
                      className={`py-3 rounded-2xl font-extrabold text-lg sm:text-xl border shadow-xs active:scale-95 min-h-[48px] ${
                        k === '⌫'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Back & Next Navigation */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 min-h-[56px]"
              >
                <ChevronLeft size={20} /> {t('createPost.backBtn', '← వెనుకకు')}
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(3)}
                className="flex-1 bg-[#1E5E3A] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg"
              >
                <span>{t('createPost.q3NextBtn', 'తర్వాత: డెలివరీ సమయం →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: TIME OF DELIVERY WITH TOUCH CARDS                    */}
        {/* ============================================================ */}
        {step === 4 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full mb-2 inline-block">
                {t('createPost.guidedStepCounter', { current: 4, defaultValue: 'దశ 4 / 4' })}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {t('createPost.whenCanDeliver', 'మీ పంటను ఎప్పుడు అందించగలరు?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.deliveryTouchHelp', 'మీ పంట ఎప్పుడు సిద్ధంగా ఉంటుందో కింద తాకండి')}
              </p>

              <div className="mt-5 space-y-3">
                {/* Option 1: Today */}
                <button
                  type="button"
                  onClick={() => handleDeliveryChoice('today')}
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

                {/* Option 2: Tomorrow */}
                <button
                  type="button"
                  onClick={() => handleDeliveryChoice('tomorrow')}
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

                {/* Option 3: Custom Date */}
                <button
                  type="button"
                  onClick={() => handleDeliveryChoice('custom')}
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

                {/* Date Picker if Custom chosen */}
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
                <span>{t('createPost.q4NextBtn', 'సమీక్షించండి →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: FINAL REVIEW & TOUCH PUBLISH (REQUIREMENT 8 & 9)    */}
        {/* ============================================================ */}
        {step === 5 && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900">
                  {t('createPost.reviewTitle', 'మీ పంట వివరాల సమీక్ష')}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('createPost.reviewSub', 'వివరాలు సరిచూసుకుని పోస్ట్ చేయడానికి కింద ఉన్న ఆకుపచ్చ బటన్ తాకండి')}
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

            {/* 4 Clean Summary Cards with Edit ("మార్చు") Buttons */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              {/* Crop */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{activeCropObj?.icon || '🌾'}</span>
                  <div>
                    <span className="text-xs font-bold text-gray-400 block">
                      {t('createPost.stepCropName', 'పంట')}
                    </span>
                    <p className="font-extrabold text-gray-900 text-lg">
                      {translateCropName(t, form.crop_name)}
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

              {/* Price */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                <div>
                  <span className="text-xs font-bold text-gray-400 block">
                    {t('createPost.stepPriceName', 'ధర')}
                  </span>
                  <p className="font-extrabold text-[#D9822B] text-xl">
                    ₹{form.price} / {translateUnit(t, form.price_unit)}
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
                    {form.delivery_choice === 'today'
                      ? t('createPost.q4Today', 'ఈరోజే')
                      : form.delivery_choice === 'tomorrow'
                      ? t('createPost.q4Tomorrow', 'రేపు')
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

              {/* Inherited Location Banner (Auto-filled, no farmer re-typing) */}
              <div className="p-3 bg-green-50/60 rounded-2xl border border-green-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin size={16} className="text-[#1E5E3A] shrink-0" />
                  <span>
                    <strong>{t('postCard.location', 'Location')}:</strong> {form.location || user?.location || t('createPost.profileLocation', 'Profile Registered Location')}
                  </span>
                </div>
                <span className="text-[10px] text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                  ✓ {t('createPost.autoLocation', 'స్వయంచాలకంగా తీసుకోబడింది')}
                </span>
              </div>
            </div>

            {/* Optional Details Accordion (Photos, variety, description) */}
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
                <div className="p-4 pt-1 border-t border-gray-100 space-y-3 animate-slide-up">
                  <ImagePicker
                    value={form.image}
                    onChange={(url) => update('image', url)}
                    label={t('createPost.photoOptional', 'పంట ఫోటో (ఐచ్ఛికం)')}
                  />

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      {t('createPost.varietyOptional', 'రకం / వెరైటీ (ఐచ్ఛికం)')}
                    </label>
                    <input
                      type="text"
                      value={form.variety}
                      onChange={(e) => update('variety', e.target.value)}
                      placeholder={t('createPost.varietyPlaceholder', 'e.g. BPT 5204, Sona Masoori')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      {t('createPost.descOptional', 'అదనపు వివరాలు (ఐచ్ఛికం)')}
                    </label>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      placeholder={t('createPost.descPlaceholder', 'Crop quality, grade or additional details...')}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Back & Touch Publish Button */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-1/3 bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 min-h-[56px]"
              >
                <ChevronLeft size={20} /> {t('createPost.backBtn', '← వెనుకకు')}
              </button>

              {/* Requirement 9: Require the farmer to touch Publish to confirm */}
              <button
                type="button"
                disabled={submitting}
                onClick={handlePublish}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg min-h-[56px] text-lg"
              >
                {submitting ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <span>{t('createPost.publishBtn', '🌾 నా పంటను పోస్ట్ చేయండి')}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
