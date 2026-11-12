import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic,
  MicOff,
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
  RefreshCw,
  Loader2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createPost, getCropsCatalog, getPriceGuidance } from '../services/api.js'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../utils/voiceInput.js'
import { translateCropName, translateUnit, translateAgriCategory } from '../utils/i18nHelpers.js'
import { getSelectedLanguage } from '../utils/onboarding.js'

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
  const { t } = useTranslation()
  const isFarmer = user?.role === 'farmer'
  const currentLang = getSelectedLanguage()

  // Authenticated user-scoped draft key
  const draftKey = user?.id ? `${DRAFT_KEY_PREFIX}${user.id}` : null
  const [draftRestored, setDraftRestored] = useState(false)
  const isDraftLoadedRef = useRef(false)

  // Guided Steps:
  // 1: Select Crop
  // 2: Enter Quantity
  // 3: Enter Expected Price
  // 4: Select Delivery Time
  // 5: Final Review & Publishing
  const [step, setStep] = useState(1)

  // Master Crops Catalog & Search
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
    quantity_num: '',
    unit: 'Quintal',
    // Step 3: Expected Price
    price: '',
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

  // Validation Error States per step
  const [errors, setErrors] = useState({})

  // Voice Input State per step
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const recognizerRef = useRef(null)
  const transcriptRef = useRef('')

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

  // Auto-save draft changes as farmer progresses
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
      version: 2,
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
    setForm({
      crop_name: '',
      category: '',
      quantity_num: '',
      unit: 'Quintal',
      price: '',
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

  // Select crop from card
  function handleSelectCrop(crop) {
    setForm((prev) => ({
      ...prev,
      crop_name: crop.name,
      category: crop.category,
      unit: crop.default_unit || prev.unit,
      price_unit: crop.default_unit || prev.price_unit,
    }))
    setErrors((prev) => ({ ...prev, crop_name: null }))
  }

  // Voice Input Handler: Speech-to-Text per Step
  function toggleVoiceInput() {
    if (isListening) {
      recognizerRef.current?.stop()
      setIsListening(false)
      return
    }

    if (!isSpeechRecognitionSupported()) {
      toast.error(t('createPost.voiceNotSupported', 'Voice recognition is not supported in this browser. Please type or select directly.'))
      return
    }

    transcriptRef.current = ''
    setVoiceTranscript('')

    const recognizer = createSpeechRecognizer({
      lang: currentLang,
      onStart: () => {
        setIsListening(true)
        transcriptRef.current = ''
        setVoiceTranscript('')
      },
      onResult: ({ text }) => {
        const cleaned = (text || '').trim()
        transcriptRef.current = cleaned
        setVoiceTranscript(cleaned)
      },
      onError: (err) => {
        setIsListening(false)
        const errType = err?.type || err
        if (errType === 'not-allowed') {
          toast.error(t('createPost.voiceErrors.micDenied', 'Microphone permission denied.'))
        } else if (errType !== 'aborted') {
          toast.error(t('createPost.voiceErrors.generic', 'Could not recognize speech. Please tap to enter.'))
        }
      },
      onEnd: () => {
        setIsListening(false)
        const captured = transcriptRef.current.trim()
        if (captured) {
          applySpokenVoiceToCurrentStep(captured)
        }
      },
    })

    if (recognizer) {
      recognizerRef.current = recognizer
      recognizer.start()
    }
  }

  // Parses spoken text and populates the active step's answer
  function applySpokenVoiceToCurrentStep(spokenText) {
    const lower = spokenText.toLowerCase()

    if (step === 1) {
      // Step 1: Detect crop name
      const matched = catalog.find(
        (c) =>
          lower.includes(c.name.toLowerCase()) ||
          (c.keywords && c.keywords.some((kw) => lower.includes(kw.toLowerCase()))) ||
          (c.telugu && lower.includes(c.telugu.toLowerCase())) ||
          (c.hindi && lower.includes(c.hindi.toLowerCase()))
      )
      if (matched) {
        handleSelectCrop(matched)
        toast.success(`Selected ${matched.name}!`)
      } else {
        setCropSearch(spokenText)
        toast.info(`Searching for "${spokenText}"`)
      }
    } else if (step === 2) {
      // Step 2: Detect quantity number and unit
      const numMatch = lower.match(/\d+(\.\d+)?/)
      if (numMatch) {
        update('quantity_num', numMatch[0])
        if (lower.includes('ton') || lower.includes('టన్ను') || lower.includes('टन')) {
          update('unit', 'Ton')
          update('price_unit', 'Ton')
        } else if (lower.includes('kg') || lower.includes('కిలో') || lower.includes('किग्रा')) {
          update('unit', 'Kg')
          update('price_unit', 'Kg')
        } else if (lower.includes('quintal') || lower.includes('క్వింటాల్') || lower.includes('क्विंटल')) {
          update('unit', 'Quintal')
          update('price_unit', 'Quintal')
        }
        toast.success(`Quantity entered: ${numMatch[0]}`)
      } else {
        toast.error('Could not detect quantity number. Please enter with keyboard.')
      }
    } else if (step === 3) {
      // Step 3: Detect price number
      const numMatch = lower.match(/\d+(\.\d+)?/)
      if (numMatch) {
        update('price', numMatch[0])
        toast.success(`Price entered: ₹${numMatch[0]}`)
      } else {
        toast.error('Could not detect price. Please enter with keyboard.')
      }
    }
  }

  // Step Validation & Progression
  function validateAndNext(currentStep) {
    if (currentStep === 1) {
      if (!form.crop_name.trim()) {
        setErrors((prev) => ({ ...prev, crop_name: t('createPost.q1Error', 'Please select a crop to continue') }))
        toast.error(t('createPost.q1Error', 'Please select a crop to continue'))
        return
      }
      setErrors({})
      setStep(2)
    } else if (currentStep === 2) {
      const q = parseFloat(form.quantity_num)
      if (isNaN(q) || q <= 0) {
        setErrors((prev) => ({ ...prev, quantity_num: t('createPost.q2Error', 'Please enter a valid quantity greater than 0') }))
        toast.error(t('createPost.q2Error', 'Please enter a valid quantity greater than 0'))
        return
      }
      setErrors({})
      setStep(3)
    } else if (currentStep === 3) {
      const p = parseFloat(form.price)
      if (isNaN(p) || p <= 0) {
        setErrors((prev) => ({ ...prev, price: t('createPost.q3Error', 'Please enter an expected price greater than 0') }))
        toast.error(t('createPost.q3Error', 'Please enter an expected price greater than 0'))
        return
      }
      setErrors({})
      setStep(4)
    } else if (currentStep === 4) {
      if (!form.target_date) {
        setErrors((prev) => ({ ...prev, target_date: t('createPost.q4Error', 'Please select a delivery date') }))
        toast.error(t('createPost.q4Error', 'Please select a delivery date'))
        return
      }
      setErrors({})
      setStep(5) // Review
    }
  }

  // Pre-fill Recommended Mandi Price
  function handleUseMandiPrice(price) {
    update('price', String(price))
    toast.success(t('createPost.priceApplied', 'Mandi benchmark price applied!'))
  }

  // Delivery Choice handler
  function handleDeliveryChoice(choice) {
    update('delivery_choice', choice)
    if (choice === 'today') {
      update('target_date', getOffsetDateString(0))
    } else if (choice === 'tomorrow') {
      update('target_date', getOffsetDateString(1))
    }
  }

  // Submit Listing (From Step 5 Review)
  async function handlePublish() {
    if (isPublishingRef.current || submitting) return

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

    // Formatted readable delivery text
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
                  quantity_num: '',
                  unit: 'Quintal',
                  price: '',
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
  // GUIDED 4-STEP WIZARD + REVIEW
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

      {/* 4-Segment Progress Bar */}
      <div className="max-w-md mx-auto px-4 pt-3">
        <div className="bg-white rounded-2xl p-3.5 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2 text-xs font-bold text-gray-700">
            <span className={step >= 1 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
              1. {t('createPost.reviewCrop', 'Crop')}
            </span>
            <span className={step >= 2 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
              2. {t('createPost.reviewQty', 'Quantity')}
            </span>
            <span className={step >= 3 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
              3. {t('createPost.reviewPrice', 'Price')}
            </span>
            <span className={step >= 4 ? 'text-[#1E5E3A] font-extrabold' : 'text-gray-400'}>
              4. {t('createPost.reviewDelivery', 'Delivery')}
            </span>
          </div>

          {/* 4 Segment Bars */}
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
        {/* Restored Draft Banner */}
        {draftRestored && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-gray-900 shadow-xs mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={18} className="text-[#1E5E3A] shrink-0" />
              <span className="font-semibold truncate">
                {t('createPost.draftRestoredNotice', 'Your previous draft has been restored.')}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="text-red-700 hover:text-red-800 font-bold underline text-xs px-1 py-0.5"
              >
                {t('createPost.discardDraftBtn', 'Discard & Start Fresh')}
              </button>
              <button
                type="button"
                onClick={() => setDraftRestored(false)}
                className="text-gray-500 hover:text-gray-800 font-bold px-1.5 text-base"
                aria-label="Dismiss banner"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 1: WHAT CROP DO YOU HAVE?                               */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            {/* Step 1 Question Card */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full mb-2">
                {t('createPost.guidedStepCounter', { current: 1, defaultValue: 'Step 1 of 4' })}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.q1CropFarmer', 'What crop do you have?')
                  : t('createPost.q1CropIndustry', 'What crop do you need?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isFarmer
                  ? t('createPost.q1SubtitleFarmer', 'Select your crop from familiar crops below or search')
                  : t('createPost.q1SubtitleIndustry', 'Select the crop you wish to buy or search below')}
              </p>

              {/* Optional Voice Mic Button */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-label="Toggle voice input"
                  className={`flex-1 py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all min-h-[48px] ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-green-50 hover:bg-green-100 text-[#1E5E3A] border border-green-200'
                  }`}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  <span>{isListening ? 'Listening...' : t('createPost.q1SpeakBtn', '🎙️ Speak Crop Name')}</span>
                </button>
              </div>

              {isListening && (
                <p className="text-xs text-red-600 font-semibold mt-2 text-center animate-pulse">
                  {voiceTranscript || 'Speak your crop clearly into microphone...'}
                </p>
              )}
            </div>

            {/* Selected Crop Pill (If crop chosen) */}
            {form.crop_name && (
              <div className="bg-green-100/80 border-2 border-[#1E5E3A] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{activeCropObj?.icon || '🌾'}</span>
                  <div>
                    <span className="text-[10px] text-[#1E5E3A] font-extrabold uppercase tracking-wide block">
                      {t('createPost.q1SelectedBadge', 'Selected Crop')}
                    </span>
                    <p className="font-extrabold text-gray-900 text-lg">
                      {translateCropName(t, form.crop_name)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('crop_name', '')}
                  className="text-xs font-bold text-red-700 bg-white hover:bg-red-50 px-3 py-1.5 rounded-xl border border-red-200"
                >
                  {t('createPost.q1ChangeCrop', 'Change Crop')}
                </button>
              </div>
            )}

            {/* Simple Search Input */}
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white focus:border-[#1E5E3A] focus:ring-4 focus:ring-green-100 outline-none text-base font-medium shadow-xs"
                placeholder={t('createPost.q1SearchPlaceholder', 'Search crop name (వరి, धान, Cotton, Tomato...)')}
                value={cropSearch}
                onChange={(e) => setCropSearch(e.target.value)}
              />
              {cropSearch && (
                <button
                  type="button"
                  onClick={() => setCropSearch('')}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-700 font-bold"
                >
                  &times;
                </button>
              )}
            </div>

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

            {/* Crop Grid Cards */}
            {loadingCatalog ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {filteredCatalog.map((crop) => {
                  const isSelected = form.crop_name.toLowerCase() === crop.name.toLowerCase()
                  return (
                    <button
                      key={crop.name}
                      type="button"
                      onClick={() => handleSelectCrop(crop)}
                      className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between min-h-[105px] active:scale-98 ${
                        isSelected
                          ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                          : 'border-gray-200 bg-white hover:border-[#1E5E3A]/60 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-3xl">{crop.icon}</span>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#1E5E3A] text-white flex items-center justify-center">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="font-extrabold text-gray-900 text-base leading-tight">
                          {translateCropName(t, crop.name)}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {currentLang === 'te'
                            ? crop.telugu.split('(')[0]
                            : currentLang === 'hi'
                            ? crop.hindi.split('(')[0]
                            : crop.category}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {errors.crop_name && (
              <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 mt-1">
                <AlertCircle size={14} /> {errors.crop_name}
              </p>
            )}

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
                <span>{t('createPost.q1NextBtn', 'Next: Enter Quantity →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: HOW MUCH QUANTITY DO YOU HAVE?                       */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            {/* Step 2 Question Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 2, defaultValue: 'Step 2 of 4' })}
                </span>
                <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                  {activeCropObj?.icon} {translateCropName(t, form.crop_name)}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.q2QtyFarmer', 'How much quantity do you have?')
                  : t('createPost.q2QtyIndustry', 'How much quantity do you need?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.q2Subtitle', {
                  crop: translateCropName(t, form.crop_name),
                  defaultValue: `Enter available harvest quantity for ${translateCropName(t, form.crop_name)}`,
                })}
              </p>

              {/* Large Numeric Input */}
              <div className="mt-6 mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                  {t('createPost.reviewQty', 'Quantity')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    autoFocus
                    className={`w-full text-center text-3xl sm:text-4xl font-extrabold py-4 px-4 rounded-2xl border-2 outline-none transition-all shadow-inner ${
                      errors.quantity_num
                        ? 'border-red-500 bg-red-50 text-red-900'
                        : 'border-gray-200 bg-gray-50/70 focus:bg-white focus:border-[#1E5E3A] text-gray-900'
                    }`}
                    placeholder="0"
                    value={form.quantity_num}
                    onChange={(e) => update('quantity_num', e.target.value)}
                  />
                  <span className="absolute right-4 top-5 font-bold text-gray-500 text-base">
                    {translateUnit(t, form.unit)}
                  </span>
                </div>
                {errors.quantity_num && (
                  <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 mt-2">
                    <AlertCircle size={14} /> {errors.quantity_num}
                  </p>
                )}
              </div>

              {/* Unit Choices: Kg, Quintal, Ton */}
              <div className="mt-4">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-2">
                  {t('common.unit', 'Unit')}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {STANDARD_UNITS.map((u) => {
                    const isSelected = form.unit === u
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          update('unit', u)
                          update('price_unit', u)
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
              </div>

              {/* Quick Preset Chips */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 block mb-2">
                  {t('createPost.q2QuickPresets', 'Quick presets:')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {['10', '25', '50', '100', '250', '500'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => update('quantity_num', preset)}
                      className={`text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl transition-all min-h-[38px] active:scale-95 ${
                        form.quantity_num === preset
                          ? 'bg-green-100 text-[#1E5E3A] border-2 border-[#1E5E3A]'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset} {translateUnit(t, form.unit)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Voice Mic */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-green-50 hover:bg-green-100 text-[#1E5E3A]'
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  <span>{isListening ? 'Listening...' : t('createPost.q2SpeakBtn', '🎙️ Speak Quantity (e.g. 50 quintals)')}</span>
                </button>
              </div>
            </div>

            {/* Back & Next Navigation */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 transition-all min-h-[56px] text-base"
              >
                <ChevronLeft size={20} />
                <span>{t('createPost.q2BackBtn', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(2)}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md min-h-[56px] text-lg"
              >
                <span>{t('createPost.q2NextBtn', 'Next: Enter Price →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: WHAT IS YOUR EXPECTED PRICE?                        */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            {/* Step 3 Question Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 3, defaultValue: 'Step 3 of 4' })}
                </span>
                <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                  {form.quantity_num} {translateUnit(t, form.unit)} · {translateCropName(t, form.crop_name)}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.q3PriceFarmer', 'What is your expected price?')
                  : t('createPost.q3PriceIndustry', 'What is your budget price?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isFarmer
                  ? t('createPost.q3SubtitleFarmer', 'Enter your expected price per unit')
                  : t('createPost.q3SubtitleIndustry', 'Enter your budget price per unit')}
              </p>

              {/* Large Price Input */}
              <div className="mt-6 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {t('createPost.reviewPrice', 'Expected Price')}
                  </label>
                  <span className="text-xs font-bold text-[#1E5E3A]">
                    per {translateUnit(t, form.price_unit)}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-4 text-2xl font-extrabold text-gray-400">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    autoFocus
                    className={`w-full text-center text-3xl sm:text-4xl font-extrabold py-4 px-10 rounded-2xl border-2 outline-none transition-all shadow-inner ${
                      errors.price
                        ? 'border-red-500 bg-red-50 text-red-900'
                        : 'border-gray-200 bg-gray-50/70 focus:bg-white focus:border-[#1E5E3A] text-[#D9822B]'
                    }`}
                    placeholder="0"
                    value={form.price}
                    onChange={(e) => update('price', e.target.value)}
                  />
                  <span className="absolute right-4 top-5 font-bold text-gray-500 text-sm">
                    / {translateUnit(t, form.price_unit)}
                  </span>
                </div>
                {errors.price && (
                  <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 mt-2">
                    <AlertCircle size={14} /> {errors.price}
                  </p>
                )}
              </div>

              {/* Price Unit Selector (Per kg, Per quintal, Per ton) */}
              <div className="mt-4">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-2">
                  {t('createPost.priceUnit', 'Price Unit')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STANDARD_UNITS.map((u) => {
                    const isSelected = form.price_unit === u
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => update('price_unit', u)}
                        className={`py-3 px-2 rounded-2xl font-bold text-xs sm:text-sm border-2 transition-all min-h-[46px] flex items-center justify-center gap-1 active:scale-95 ${
                          isSelected
                            ? 'bg-[#1E5E3A] text-white border-[#1E5E3A] shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {isSelected && <Check size={14} strokeWidth={3} />}
                        <span>per {translateUnit(t, u)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mandi Market Reference Card (Reassuring benchmark) */}
              {priceGuidance && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 mt-5 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1">
                      <IndianRupee size={14} />
                      {t('createPost.q3MandiTitle', 'Mandi Market Guidance')}
                    </span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                      {priceGuidance.market_name}
                    </span>
                  </div>
                  <p className="text-xs text-amber-950 font-medium">
                    {t('createPost.q3MandiRange', {
                      market: priceGuidance.market_name,
                      min: priceGuidance.min_price,
                      max: priceGuidance.max_price,
                      unit: priceGuidance.unit,
                      defaultValue: `Typical market range: ₹${priceGuidance.min_price} – ₹${priceGuidance.max_price} per ${priceGuidance.unit}`,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleUseMandiPrice(priceGuidance.modal_price)}
                    className="mt-2.5 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 font-bold text-xs py-2 px-3.5 rounded-xl active:scale-95 transition-all shadow-xs"
                  >
                    {t('createPost.q3UseMandi', {
                      price: priceGuidance.modal_price,
                      defaultValue: `💡 Use Recommended Price: ₹${priceGuidance.modal_price}`,
                    })}
                  </button>
                </div>
              )}

              {/* Negotiable Toggle */}
              <label className="flex items-center gap-3 cursor-pointer mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <input
                  type="checkbox"
                  checked={form.is_negotiable}
                  onChange={(e) => update('is_negotiable', e.target.checked)}
                  className="w-5 h-5 rounded text-[#1E5E3A] accent-[#1E5E3A]"
                />
                <span className="text-sm font-semibold text-gray-800">
                  {t('createPost.q3Negotiable', 'Price is negotiable upon discussion')}
                </span>
              </label>

              {/* Optional Voice Mic */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-green-50 hover:bg-green-100 text-[#1E5E3A]'
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  <span>{isListening ? 'Listening...' : t('createPost.q3SpeakBtn', '🎙️ Speak Price')}</span>
                </button>
              </div>
            </div>

            {/* Back & Next Navigation */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 transition-all min-h-[56px] text-base"
              >
                <ChevronLeft size={20} />
                <span>{t('createPost.q3BackBtn', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(3)}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md min-h-[56px] text-lg"
              >
                <span>{t('createPost.q3NextBtn', 'Next: Delivery Time →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: WHEN CAN YOU DELIVER YOUR CROP?                     */}
        {/* ============================================================ */}
        {step === 4 && (
          <div className="space-y-4 animate-slide-up">
            {/* Step 4 Question Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedStepCounter', { current: 4, defaultValue: 'Step 4 of 4' })}
                </span>
                <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                  {form.quantity_num} {translateUnit(t, form.unit)} @ ₹{form.price}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {isFarmer
                  ? t('createPost.q4DeliveryFarmer', 'When can you deliver your crop?')
                  : t('createPost.q4DeliveryIndustry', 'When do you need delivery?')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.q4Subtitle', 'Choose when your harvest will be ready for pickup or delivery')}
              </p>

              {/* Visual Delivery Choices: Today / Tomorrow / Choose another date */}
              <div className="mt-6 space-y-3">
                {/* Option 1: Today */}
                <button
                  type="button"
                  onClick={() => handleDeliveryChoice('today')}
                  className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between active:scale-98 min-h-[64px] ${
                    form.delivery_choice === 'today'
                      ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-green-100 text-[#1E5E3A] flex items-center justify-center font-bold">
                      <Clock size={22} />
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 text-base sm:text-lg">
                        {t('createPost.q4Today', 'Today')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('createPost.q4TodayDesc', 'Ready for pickup or delivery immediately')}
                      </p>
                    </div>
                  </div>
                  {form.delivery_choice === 'today' && (
                    <div className="w-6 h-6 rounded-full bg-[#1E5E3A] text-white flex items-center justify-center">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </button>

                {/* Option 2: Tomorrow */}
                <button
                  type="button"
                  onClick={() => handleDeliveryChoice('tomorrow')}
                  className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between active:scale-98 min-h-[64px] ${
                    form.delivery_choice === 'tomorrow'
                      ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-green-100 text-[#1E5E3A] flex items-center justify-center font-bold">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 text-base sm:text-lg">
                        {t('createPost.q4Tomorrow', 'Tomorrow')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('createPost.q4TomorrowDesc', 'Ready next day')}
                      </p>
                    </div>
                  </div>
                  {form.delivery_choice === 'tomorrow' && (
                    <div className="w-6 h-6 rounded-full bg-[#1E5E3A] text-white flex items-center justify-center">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </button>

                {/* Option 3: Choose another date */}
                <button
                  type="button"
                  onClick={() => handleDeliveryChoice('custom')}
                  className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between active:scale-98 min-h-[64px] ${
                    form.delivery_choice === 'custom'
                      ? 'border-[#1E5E3A] bg-green-50 shadow-md ring-2 ring-green-300'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-[#D9822B] flex items-center justify-center font-bold">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 text-base sm:text-lg">
                        {t('createPost.q4Custom', 'Choose another date')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('createPost.q4CustomDesc', 'Specify exact future date')}
                      </p>
                    </div>
                  </div>
                  {form.delivery_choice === 'custom' && (
                    <div className="w-6 h-6 rounded-full bg-[#1E5E3A] text-white flex items-center justify-center">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>

              {/* Date Picker if 'custom' is active */}
              {form.delivery_choice === 'custom' && (
                <div className="mt-4 p-4 rounded-2xl bg-gray-50 border border-gray-200 animate-fade-in space-y-3">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block">
                    {t('createPost.q4DatePickerLabel', 'Select delivery date:')}
                  </label>
                  <input
                    type="date"
                    min={getOffsetDateString(0)}
                    value={form.target_date}
                    onChange={(e) => update('target_date', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-base font-bold text-gray-900 outline-none focus:border-[#1E5E3A]"
                  />

                  {/* Quick Shortcut Pills */}
                  <div className="flex gap-2 pt-1">
                    {[
                      { label: '+3 Days', days: 3 },
                      { label: '+1 Week', days: 7 },
                      { label: '+2 Weeks', days: 14 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => update('target_date', getOffsetDateString(opt.days))}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time of day option (Clean chips) */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-600 block mb-2">
                  {t('createPost.q4TimeOfDayLabel', 'Preferred time of day (optional):')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'anytime', label: t('createPost.q4Anytime', 'Any time') },
                    { id: 'morning', label: t('createPost.q4Morning', 'Morning') },
                    { id: 'afternoon', label: t('createPost.q4Afternoon', 'Afternoon') },
                  ].map((tod) => (
                    <button
                      key={tod.id}
                      type="button"
                      onClick={() => update('time_of_day', tod.id)}
                      className={`text-xs font-bold py-2.5 px-2 rounded-xl border transition-all ${
                        form.time_of_day === tod.id
                          ? 'bg-[#1E5E3A] text-white border-[#1E5E3A]'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {tod.label}
                    </button>
                  ))}
                </div>
              </div>

              {errors.target_date && (
                <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 mt-3">
                  <AlertCircle size={14} /> {errors.target_date}
                </p>
              )}
            </div>

            {/* Back & Next Navigation */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 transition-all min-h-[56px] text-base"
              >
                <ChevronLeft size={20} />
                <span>{t('createPost.q4BackBtn', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => validateAndNext(4)}
                className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md min-h-[56px] text-lg"
              >
                <span>{t('createPost.q4NextBtn', 'Review & Publish →')}</span>
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: FINAL REVIEW & PUBLISHING                            */}
        {/* ============================================================ */}
        {step === 5 && (
          <div className="space-y-4 animate-slide-up">
            {/* Review Heading Card */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                  {t('createPost.guidedFinalReview', 'Final Review')}
                </span>
                <span className="text-xs font-bold text-green-700 flex items-center gap-1">
                  <Check size={14} strokeWidth={3} /> Ready to Post
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                {t('createPost.reviewTitle', 'Review Your Crop Listing')}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('createPost.reviewSubtitle', 'Check your details before posting to verified buyers')}
              </p>
            </div>

            {/* 4 Summary Cards with One-Click Edit Action */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
              {/* Item 1: Crop */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{activeCropObj?.icon || '🌾'}</span>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block">
                      {t('createPost.reviewCrop', 'Crop')}
                    </span>
                    <p className="font-extrabold text-gray-900 text-lg">
                      {translateCropName(t, form.crop_name)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs font-bold text-[#1E5E3A] bg-green-100/80 hover:bg-green-200/80 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Edit2 size={13} />
                  <span>{t('createPost.reviewEdit', 'Edit')}</span>
                </button>
              </div>

              {/* Item 2: Quantity */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block">
                    {t('createPost.reviewQty', 'Quantity')}
                  </span>
                  <p className="font-extrabold text-gray-900 text-lg">
                    {form.quantity_num} {translateUnit(t, form.unit)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1 text-xs font-bold text-[#1E5E3A] bg-green-100/80 hover:bg-green-200/80 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Edit2 size={13} />
                  <span>{t('createPost.reviewEdit', 'Edit')}</span>
                </button>
              </div>

              {/* Item 3: Expected Price */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block">
                    {t('createPost.reviewPrice', 'Expected Price')}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <p className="font-extrabold text-[#D9822B] text-xl">
                      ₹{form.price}
                    </p>
                    <span className="text-xs text-gray-600 font-semibold">
                      per {translateUnit(t, form.price_unit)}
                    </span>
                    {form.is_negotiable && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full ml-1">
                        Negotiable
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1 text-xs font-bold text-[#1E5E3A] bg-green-100/80 hover:bg-green-200/80 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Edit2 size={13} />
                  <span>{t('createPost.reviewEdit', 'Edit')}</span>
                </button>
              </div>

              {/* Item 4: Delivery Time */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block">
                    {t('createPost.reviewDelivery', 'Delivery Time')}
                  </span>
                  <p className="font-extrabold text-gray-900 text-base">
                    {form.delivery_choice === 'today'
                      ? `${t('createPost.q4Today', 'Today')} (${form.target_date})`
                      : form.delivery_choice === 'tomorrow'
                      ? `${t('createPost.q4Tomorrow', 'Tomorrow')} (${form.target_date})`
                      : form.target_date}
                    {form.time_of_day !== 'anytime' && ` · ${form.time_of_day}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex items-center gap-1 text-xs font-bold text-[#1E5E3A] bg-green-100/80 hover:bg-green-200/80 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Edit2 size={13} />
                  <span>{t('createPost.reviewEdit', 'Edit')}</span>
                </button>
              </div>

              {/* Seller & Location (Auto-filled from profile) */}
              <div className="p-3 rounded-2xl bg-green-50/60 border border-green-200/60 flex items-center justify-between text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-[#1E5E3A] shrink-0" />
                  <div>
                    <span className="font-bold text-gray-900">{user?.name}</span>
                    <span className="text-gray-500"> · {form.location || user?.location}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-green-200/70 text-green-900 font-bold px-2 py-0.5 rounded-full">
                  ✓ Verified Mobile
                </span>
              </div>
            </div>

            {/* Optional Collapsed Section (Photos & Notes) */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                className="w-full p-4 flex items-center justify-between text-left text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all min-h-[48px]"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-[#1E5E3A]" />
                  <span>{t('createPost.optionalDetails', 'Add photos or notes (Optional)')}</span>
                </div>
                {showOptionalDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {showOptionalDetails && (
                <div className="p-4 pt-1 border-t border-gray-100 space-y-4 animate-fade-in">
                  <ImagePicker
                    value={form.image}
                    onChange={(url) => update('image', url)}
                    label={t('createPost.optionalPhotos', 'Crop Photos (Optional)')}
                  />

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t('createPost.optionalVariety', 'Crop Variety (Optional)')}
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm"
                      placeholder={t('createPost.optionalVarietyPlaceholder', 'e.g. Sona Masoori, Teja, Bunny...')}
                      value={form.variety}
                      onChange={(e) => update('variety', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      {t('createPost.optionalNotes', 'Additional Notes / Description (Optional)')}
                    </label>
                    <textarea
                      rows={2}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm"
                      placeholder={t('createPost.optionalNotesPlaceholder', 'Describe harvest quality, freshness, packaging...')}
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Post My Crop Primary Action */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handlePublish}
                className="w-full bg-[#1E5E3A] hover:bg-[#16482c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg min-h-[56px] text-lg"
              >
                {submitting ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    <span>{t('createPost.publishing', 'Publishing Listing...')}</span>
                  </>
                ) : (
                  <span>
                    {isFarmer
                      ? t('createPost.postCropBtn', '🌾 Post My Crop')
                      : t('createPost.postReqBtn', '📢 Post Requirement')}
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep(4)}
                className="w-full py-3 text-sm text-gray-600 font-bold hover:bg-gray-200/50 rounded-xl transition-colors min-h-[44px]"
              >
                {t('createPost.reviewBack', '← Back to Delivery')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
