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
  Volume2,
  VolumeX,
  Plus,
  Minus,
  RotateCcw,
  Layers,
  ArrowRightLeft,
  HelpCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createPost, getCropsCatalog, getPriceGuidance } from '../services/api.js'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../utils/voiceInput.js'
import { translateCropName, translateUnit, translateAgriCategory } from '../utils/i18nHelpers.js'
import { getSelectedLanguage, speak, stopSpeaking } from '../utils/onboarding.js'
import {
  parseTeluguCrop,
  parseTeluguQuantity,
  parseTeluguPrice,
  parseTeluguDelivery,
  parseTeluguConfirmation,
  TELUGU_VOICE_CONVERSATION,
} from '../utils/teluguSpeechHelper.js'

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

  // POSTING MODE:
  // null = Entry screen (Choose between Voice Assistant or Visual Posting)
  // 'voice' = Mode 1: AI Voice Assistant (Talk to Post)
  // 'visual' = Mode 2: Visual Crop Posting (Select and Post)
  const [postingMode, setPostingMode] = useState(null)

  // Step state within the active mode:
  // 1: Crop
  // 2: Quantity
  // 3: Price
  // 4: Delivery
  // 5: Final Review & Publishing
  const [step, setStep] = useState(1)

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

  // Mode 1: Voice Assistant State
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [aiAssistantMessage, setAiAssistantMessage] = useState('')
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
            if (parsed.postingMode) {
              setPostingMode(parsed.postingMode)
            }
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
      version: 3,
      timestamp: Date.now(),
      postingMode,
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
  }, [form, step, postingMode, draftKey])

  function handleDiscardDraft() {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey)
      } catch {}
    }
    stopSpeaking()
    if (recognizerRef.current) {
      try { recognizerRef.current.stop() } catch {}
    }
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
    setPostingMode(null)
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
  function handleSelectCrop(crop, playVoice = true) {
    setForm((prev) => ({
      ...prev,
      crop_name: crop.name,
      category: crop.category,
      unit: crop.default_unit || prev.unit,
      price_unit: crop.default_unit || prev.price_unit,
    }))
    setErrors((prev) => ({ ...prev, crop_name: null }))

    if (playVoice) {
      // In Telugu, announce crop name
      const voiceText = currentLang === 'te'
        ? (crop.telugu ? crop.telugu.split('(')[0].trim() : crop.name)
        : currentLang === 'hi'
        ? (crop.hindi ? crop.hindi.split('(')[0].trim() : crop.name)
        : crop.name
      speak(voiceText, currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-US')
    }
  }

  // ============================================================
  // CONVERSATIONAL VOICE ASSISTANT ENGINE (MODE 1)
  // ============================================================

  // Speak AI message and trigger speech recognition on end
  function speakAndListen(textPrompt, autoListen = true) {
    stopSpeaking()
    setAiAssistantMessage(textPrompt)
    setIsSpeaking(true)

    speak(textPrompt, {
      lang: 'te-IN',
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false)
        if (autoListen) {
          startVoiceRecognition()
        }
      },
    })
  }

  // Start speech recognition
  function startVoiceRecognition() {
    if (isListening) return

    if (!isSpeechRecognitionSupported()) {
      toast.error('ఈ బ్రౌజర్‌లో వాయిస్ రికగ్నిషన్ సపోర్ట్ లేదు. దయచేసి టచ్ ద్వారా పోస్ట్ చేయండి.')
      return
    }

    transcriptRef.current = ''
    setVoiceTranscript('')

    const recognizer = createSpeechRecognizer({
      lang: 'te-IN',
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
        if (errType === 'no-speech') {
          // Re-prompt politely in Telugu
          speakAndListen('మీరు మాట్లాడింది వినపడలేదు. దయచేసి మైక్రోఫోన్ నొక్కి మళ్లీ చెప్పండి.', false)
        } else if (errType === 'not-allowed') {
          toast.error('దయచేసి మైక్రోఫోన్ అనుమతిని ఇవ్వండి.')
        }
      },
      onEnd: () => {
        setIsListening(false)
        const captured = transcriptRef.current.trim()
        if (captured) {
          processVoiceStepResponse(captured)
        }
      },
    })

    if (recognizer) {
      recognizerRef.current = recognizer
      try {
        recognizer.start()
      } catch {}
    }
  }

  // Stop voice recognition
  function stopVoiceRecognition() {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop()
      } catch {}
    }
    setIsListening(false)
  }

  // Mode 1 conversational turn engine
  function processVoiceStepResponse(capturedText) {
    if (step === 1) {
      // Step 1: Recognize Crop
      const cropName = parseTeluguCrop(capturedText)
      if (cropName) {
        const matched = catalog.find((c) => c.name.toLowerCase() === cropName.toLowerCase()) || { name: cropName, category: 'Cereals' }
        handleSelectCrop(matched, false)
        const teluguCrop = matched.telugu ? matched.telugu.split('(')[0].trim() : cropName
        const confirmMsg = TELUGU_VOICE_CONVERSATION.q1Confirm(teluguCrop)
        toast.success(`గుర్తించబడిన పంట: ${teluguCrop}`)
        
        // Move to Step 2
        setStep(2)
        setTimeout(() => {
          speakAndListen(`${confirmMsg} ఇక, ${TELUGU_VOICE_CONVERSATION.q2Qty(teluguCrop)}`)
        }, 500)
      } else {
        speakAndListen(TELUGU_VOICE_CONVERSATION.q1Retry)
      }
    } else if (step === 2) {
      // Step 2: Recognize Quantity
      const parsedQty = parseTeluguQuantity(capturedText)
      if (parsedQty && parsedQty.quantity) {
        update('quantity_num', parsedQty.quantity)
        update('unit', parsedQty.unit)
        update('price_unit', parsedQty.unit)
        const unitName = parsedQty.unit === 'Quintal' ? 'క్వింటాళ్లు' : parsedQty.unit === 'Ton' ? 'టన్నులు' : 'కిలోలు'
        const confirmMsg = TELUGU_VOICE_CONVERSATION.q2Confirm(parsedQty.quantity, unitName)
        toast.success(`పరిమాణం: ${parsedQty.quantity} ${unitName}`)

        // Move to Step 3
        setStep(3)
        setTimeout(() => {
          speakAndListen(`${confirmMsg} ఇక, ${TELUGU_VOICE_CONVERSATION.q3Price(parsedQty.unit === 'Quintal' ? 'క్వింటాల్' : parsedQty.unit === 'Ton' ? 'టన్ను' : 'కిలో')}`)
        }, 500)
      } else {
        speakAndListen(TELUGU_VOICE_CONVERSATION.q2Retry)
      }
    } else if (step === 3) {
      // Step 3: Recognize Price
      const parsedPrice = parseTeluguPrice(capturedText)
      if (parsedPrice && parsedPrice.price) {
        update('price', parsedPrice.price)
        if (parsedPrice.price_unit) {
          update('price_unit', parsedPrice.price_unit)
        }
        const unitName = form.price_unit === 'Quintal' ? 'క్వింటాల్' : form.price_unit === 'Ton' ? 'టన్ను' : 'కిలో'
        const confirmMsg = TELUGU_VOICE_CONVERSATION.q3Confirm(parsedPrice.price, unitName)
        toast.success(`ధర: ₹${parsedPrice.price} (${unitName}కు)`)

        // Move to Step 4
        setStep(4)
        setTimeout(() => {
          speakAndListen(`${confirmMsg} ఇక, ${TELUGU_VOICE_CONVERSATION.q4Delivery}`)
        }, 500)
      } else {
        speakAndListen(TELUGU_VOICE_CONVERSATION.q3Retry)
      }
    } else if (step === 4) {
      // Step 4: Recognize Delivery
      const parsedDelivery = parseTeluguDelivery(capturedText)
      if (parsedDelivery) {
        update('delivery_choice', parsedDelivery.choice)
        update('target_date', parsedDelivery.target_date)
        const confirmMsg = TELUGU_VOICE_CONVERSATION.q4Confirm(parsedDelivery.label)
        toast.success(`డెలివరీ: ${parsedDelivery.label}`)

        // Move to Step 5 (Final Review)
        setStep(5)
        setTimeout(() => {
          const summaryPrompt = TELUGU_VOICE_CONVERSATION.finalReview({
            crop: translateCropName(t, form.crop_name),
            qty: form.quantity_num,
            unit: translateUnit(t, form.unit),
            price: form.price,
            price_unit: translateUnit(t, form.price_unit),
            delivery: parsedDelivery.label,
          })
          speakAndListen(summaryPrompt)
        }, 500)
      } else {
        speakAndListen(TELUGU_VOICE_CONVERSATION.q4Retry)
      }
    } else if (step === 5) {
      // Step 5: Final Confirmation
      const decision = parseTeluguConfirmation(capturedText)
      if (decision === 'confirm') {
        toast.success('ధృవీకరించబడింది! పంట పోస్ట్ అవుతోంది...')
        handlePublish()
      } else if (decision === 'reject') {
        speakAndListen('సరే! ఏ సమాధానం మార్చాలో చెప్పండి లేదా స్క్రీన్ పై మార్చు బటన్ నొక్కండి.', false)
      } else {
        speakAndListen('మీరు పోస్ట్ చేయాలనుకుంటే "అవును" లేదా "పోస్ట్ చేయండి" అని చెప్పండి.')
      }
    }
  }

  // When Mode 1 starts or step changes in Mode 1
  useEffect(() => {
    if (postingMode !== 'voice') return

    if (step === 1 && !form.crop_name) {
      speakAndListen(TELUGU_VOICE_CONVERSATION.q1Crop)
    } else if (step === 2 && !form.quantity_num) {
      speakAndListen(TELUGU_VOICE_CONVERSATION.q2Qty(translateCropName(t, form.crop_name)))
    } else if (step === 3 && !form.price) {
      speakAndListen(TELUGU_VOICE_CONVERSATION.q3Price(translateUnit(t, form.price_unit)))
    } else if (step === 4) {
      speakAndListen(TELUGU_VOICE_CONVERSATION.q4Delivery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, postingMode])

  // ============================================================
  // MODE 2: VISUAL CROP POSTING (SELECT AND POST)
  // ============================================================

  // Plus / Minus adjustments for Quantity in Mode 2
  function adjustQuantity(delta) {
    const current = parseFloat(form.quantity_num) || 0
    const nextVal = Math.max(1, current + delta)
    update('quantity_num', String(nextVal))
    // Announce aloud in Telugu
    speak(`${nextVal} ${form.unit === 'Quintal' ? 'క్వింటాళ్లు' : form.unit === 'Ton' ? 'టన్నులు' : 'కిలోలు'}`, 'te-IN')
  }

  // Plus / Minus adjustments for Price in Mode 2
  function adjustPrice(delta) {
    const current = parseFloat(form.price) || 0
    const nextVal = Math.max(10, current + delta)
    update('price', String(nextVal))
    // Announce aloud in Telugu
    speak(`ధర ${nextVal} రూపాయలు`, 'te-IN')
  }

  // On-screen numeric keypad input for Mode 2
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

  // Step Validation & Progression
  function validateAndNext(currentStep) {
    stopSpeaking()
    stopVoiceRecognition()

    if (currentStep === 1) {
      if (!form.crop_name.trim()) {
        setErrors((prev) => ({ ...prev, crop_name: t('createPost.q1Error', 'Please select a crop to continue') }))
        toast.error(t('createPost.q1Error', 'Please select a crop to continue'))
        return
      }
      setErrors({})
      setStep(2)
      if (postingMode === 'visual') {
        speak('రెండవ దశ: పరిమాణాన్ని ఎంచుకోండి', 'te-IN')
      }
    } else if (currentStep === 2) {
      const q = parseFloat(form.quantity_num)
      if (isNaN(q) || q <= 0) {
        setErrors((prev) => ({ ...prev, quantity_num: t('createPost.q2Error', 'Please enter a valid quantity greater than 0') }))
        toast.error(t('createPost.q2Error', 'Please enter a valid quantity greater than 0'))
        return
      }
      setErrors({})
      setStep(3)
      if (postingMode === 'visual') {
        speak('మూడవ దశ: ఆశించే ధరను ఎంచుకోండి', 'te-IN')
      }
    } else if (currentStep === 3) {
      const p = parseFloat(form.price)
      if (isNaN(p) || p <= 0) {
        setErrors((prev) => ({ ...prev, price: t('createPost.q3Error', 'Please enter an expected price greater than 0') }))
        toast.error(t('createPost.q3Error', 'Please enter an expected price greater than 0'))
        return
      }
      setErrors({})
      setStep(4)
      if (postingMode === 'visual') {
        speak('నాల్గవ దశ: డెలివరీ సమయాన్ని ఎంచుకోండి', 'te-IN')
      }
    } else if (currentStep === 4) {
      if (!form.target_date) {
        setErrors((prev) => ({ ...prev, target_date: t('createPost.q4Error', 'Please select a delivery date') }))
        toast.error(t('createPost.q4Error', 'Please select a delivery date'))
        return
      }
      setErrors({})
      setStep(5) // Review
      if (postingMode === 'visual') {
        readSummaryAloud()
      }
    }
  }

  // Read full visual summary aloud in Telugu
  function readSummaryAloud() {
    const summaryText = `పంట వివరాల సారాంశం: పంట ${translateCropName(t, form.crop_name)}, పరిమాణం ${form.quantity_num} ${translateUnit(t, form.unit)}, ఆశించే ధర ${form.price} రూపాయలు, డెలివరీ ${form.delivery_choice === 'today' ? 'ఈరోజే' : form.delivery_choice === 'tomorrow' ? 'రేపు' : form.target_date}. మార్కెట్లో పోస్ట్ చేయడానికి కింద ఉన్న ఆకుపచ్చ బటన్ నొక్కండి.`
    speak(summaryText, 'te-IN')
  }

  // Delivery Choice handler
  function handleDeliveryChoice(choice) {
    update('delivery_choice', choice)
    if (choice === 'today') {
      update('target_date', getOffsetDateString(0))
      speak('ఈరోజే డెలివరీ', 'te-IN')
    } else if (choice === 'tomorrow') {
      update('target_date', getOffsetDateString(1))
      speak('రేపు డెలివరీ', 'te-IN')
    } else {
      speak('వేరే తేదీని ఎంచుకోండి', 'te-IN')
    }
  }

  // Submit Listing (From Step 5 Review)
  async function handlePublish() {
    if (isPublishingRef.current || submitting) return

    stopSpeaking()
    stopVoiceRecognition()

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
      speak(TELUGU_VOICE_CONVERSATION.publishedSuccess, 'te-IN')
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

  // Clean cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking()
      stopVoiceRecognition()
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
                setPostingMode(null)
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
  // ENTRY SCREEN: CHOOSE POSTING MODE
  // ============================================================
  if (postingMode === null) {
    return (
      <div className="min-h-screen pb-24 bg-[#F9FAF7]">
        <TopBar
          title={isFarmer ? t('createPost.titleFarmer', 'Post Your Crop') : t('createPost.titleIndustry', 'Post Requirement')}
          subtitle={t('createPost.dualModeTitle', 'Select Crop Posting Mode')}
          showSearch={false}
        />

        <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
          <div className="text-center">
            <span className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-2">
              రైతు సౌకర్యార్థం (Farmer-First)
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              {t('createPost.dualModeTitle', 'పంట పోస్టింగ్ విధానాన్ని ఎంచుకోండి')}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {t('createPost.chooseModeSubtitle', 'మీకు సులభమైన పద్ధతిలో పంటను పోస్ట్ చేయండి')}
            </p>
          </div>

          {/* Restored Draft Banner */}
          {draftRestored && (
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
          )}

          {/* CHOICE 1: AI VOICE ASSISTANT — TALK TO POST */}
          <button
            type="button"
            onClick={() => {
              setPostingMode('voice')
              setStep(1)
              speak('నమస్కారం! మాట్లాడి పంటను పోస్ట్ చేద్దాం. మైక్రోఫోన్ నొక్కి మాట్లాడండి.', 'te-IN')
            }}
            className="w-full text-left bg-gradient-to-br from-green-900 via-[#1E5E3A] to-green-800 text-white p-6 rounded-3xl shadow-lg border-2 border-green-600/50 hover:border-green-400 active:scale-98 transition-all relative overflow-hidden group"
          >
            <div className="absolute right-3 -bottom-2 text-white/10 group-hover:text-white/20 transition-all">
              <Mic size={120} />
            </div>

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs bg-[#D9822B] text-white font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                  {t('createPost.modeVoiceBadge', 'మాట్లాడి పోస్ట్ చేయండి (Talk to Post)')}
                </span>
                <span className="text-xs bg-white/20 text-white font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Volume2 size={13} /> వాయిస్
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <span>🎙️</span>
                  <span>{t('createPost.modeVoiceTitle', 'AI వాయిస్ సహాయకుడు')}</span>
                </h2>
                <p className="text-sm text-green-100/90 font-medium mt-1 leading-relaxed">
                  {t('createPost.modeVoiceSub', 'మీరు కేవలం మాట్లాడితే చాలు! చదవడం, టైపింగ్ చేయడం ఏమాత్రం అవసరం లేదు.')}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-bold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  తెలుగు సంభాషణ సిద్ధంగా ఉంది
                </span>
                <span className="bg-white text-[#1E5E3A] px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-sm font-extrabold text-sm">
                  ప్రారంభించండి →
                </span>
              </div>
            </div>
          </button>

          {/* CHOICE 2: VISUAL CROP POSTING — SELECT AND POST */}
          <button
            type="button"
            onClick={() => {
              setPostingMode('visual')
              setStep(1)
              speak('చిత్రాలు చూసి సులభంగా ఎంచుకోండి. మొదటి దశ: పంట ఎంపిక.', 'te-IN')
            }}
            className="w-full text-left bg-white text-gray-900 p-6 rounded-3xl shadow-md border-2 border-gray-200 hover:border-[#1E5E3A] active:scale-98 transition-all relative overflow-hidden group"
          >
            <div className="absolute right-4 bottom-2 text-gray-100 group-hover:text-green-50 transition-all">
              <Layers size={110} />
            </div>

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs bg-green-100 text-[#1E5E3A] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  {t('createPost.modeVisualBadge', 'చూసి ఎంచుకోండి (Select & Post)')}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                  టచ్ కంట్రోల్స్
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  <span>🌾</span>
                  <span>{t('createPost.modeVisualTitle', 'విజువల్ క్రాప్ పోస్టింగ్')}</span>
                </h2>
                <p className="text-sm text-gray-600 font-medium mt-1 leading-relaxed">
                  {t('createPost.modeVisualSub', 'చిత్రాలను చూసి, పెద్ద ప్లస్ (+) మరియు మైనస్ (-) బటన్లతో తాకి సులభంగా పోస్ట్ చేయండి.')}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-bold text-gray-500">
                <span>0 టైపింగ్ · చిత్రాలు & పెద్ద బటన్లు</span>
                <span className="bg-[#1E5E3A] text-white px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-sm font-extrabold text-sm">
                  ప్రారంభించండి →
                </span>
              </div>
            </div>
          </button>

          {/* Audio read-aloud prompt helper */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                speak('నమస్కారం! మాట్లాడి పంటను పోస్ట్ చేయడానికి మొదటి ఆప్షన్ నొక్కండి. చిత్రాలు చూసి పోస్ట్ చేయడానికి రెండవ ఆప్షన్ నొక్కండి.', 'te-IN')
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2.5 rounded-full shadow-xs active:scale-95"
            >
              <Volume2 size={16} className="text-[#1E5E3A]" />
              <span>ఆప్షన్లను బిగ్గరగా వినండి (Listen Options Aloud)</span>
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ============================================================
  // SHARED HEADER & MODE SWITCHER
  // ============================================================
  return (
    <div className="min-h-screen pb-32 bg-[#F9FAF7]">
      <TopBar
        title={
          postingMode === 'voice'
            ? '🎙️ AI వాయిస్ సహాయకుడు'
            : isFarmer
            ? t('createPost.titleFarmer', 'Post Your Crop')
            : t('createPost.titleIndustry', 'Post Requirement')
        }
        subtitle={
          step <= 4
            ? t('createPost.guidedStepCounter', { current: step, defaultValue: `Step ${step} of 4` })
            : t('createPost.guidedFinalReview', 'Final Review')
        }
        showSearch={false}
      />

      {/* Top Banner with Mode Switcher Button */}
      <div className="max-w-md mx-auto px-4 pt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1E5E3A]">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
          <span>{postingMode === 'voice' ? 'వాయిస్ మోడ్ (Voice Mode)' : 'విజువల్ మోడ్ (Visual Mode)'}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            stopSpeaking()
            stopVoiceRecognition()
            setPostingMode(postingMode === 'voice' ? 'visual' : 'voice')
            toast.success(postingMode === 'voice' ? 'విజువల్ మోడ్‌కు మారారు' : 'వాయిస్ మోడ్‌కు మారారు')
          }}
          className="text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <ArrowRightLeft size={13} className="text-[#1E5E3A]" />
          <span>{t('createPost.switchMode', 'మోడ్ మార్చండి')}</span>
        </button>
      </div>

      {/* 4-Segment Progress Bar */}
      <div className="max-w-md mx-auto px-4 pt-2">
        <div className="bg-white rounded-2xl p-3 border border-gray-200/80 shadow-xs">
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
        {/* MODE 1: AI VOICE ASSISTANT — TALK TO POST                   */}
        {/* ============================================================ */}
        {postingMode === 'voice' && (
          <div className="space-y-4 animate-slide-up">
            {/* AI Assistant Avatar & Speaking Pulse Card */}
            <div className="bg-gradient-to-br from-[#1E5E3A] to-green-950 text-white rounded-3xl p-6 text-center shadow-lg relative overflow-hidden">
              <div className="w-24 h-24 mx-auto rounded-full bg-white/10 border-4 border-white/30 flex items-center justify-center relative mb-3">
                {isSpeaking && (
                  <span className="absolute inset-0 rounded-full border-4 border-amber-400 animate-ping opacity-60" />
                )}
                {isListening && (
                  <span className="absolute inset-0 rounded-full border-4 border-red-500 animate-pulse" />
                )}
                <span className="text-4xl">{isSpeaking ? '🗣️' : isListening ? '👂' : '🤖'}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-300 bg-black/20 px-3 py-1 rounded-full inline-block">
                  {isSpeaking ? 'సహాయకుడు మాట్లాడుతున్నారు...' : isListening ? 'మీ మాటలను వింటోంది...' : 'AI వాయిస్ సహాయకుడు'}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white px-2 mt-2 leading-tight">
                  {aiAssistantMessage || TELUGU_VOICE_CONVERSATION.q1Crop}
                </h2>
              </div>

              {/* Live Listening Transcript */}
              {isListening && (
                <div className="mt-4 p-3 rounded-2xl bg-black/30 border border-white/20 animate-pulse">
                  <p className="text-xs text-amber-200 font-bold italic">
                    {voiceTranscript || 'వింటోంది... మైక్రోఫోన్‌లో స్పష్టంగా మాట్లాడండి'}
                  </p>
                </div>
              )}

              {/* Large Central Mic / Replay Controls */}
              <div className="mt-5 flex items-center justify-center gap-4">
                {/* Replay Question Button */}
                <button
                  type="button"
                  onClick={() => {
                    const prompt = step === 1
                      ? TELUGU_VOICE_CONVERSATION.q1Crop
                      : step === 2
                      ? TELUGU_VOICE_CONVERSATION.q2Qty(translateCropName(t, form.crop_name))
                      : step === 3
                      ? TELUGU_VOICE_CONVERSATION.q3Price(translateUnit(t, form.price_unit))
                      : step === 4
                      ? TELUGU_VOICE_CONVERSATION.q4Delivery
                      : TELUGU_VOICE_CONVERSATION.finalReview({
                          crop: translateCropName(t, form.crop_name),
                          qty: form.quantity_num,
                          unit: translateUnit(t, form.unit),
                          price: form.price,
                          price_unit: translateUnit(t, form.price_unit),
                          delivery: form.delivery_choice === 'today' ? 'ఈరోజే' : 'రేపు',
                        })
                    speakAndListen(prompt)
                  }}
                  className="w-14 h-14 rounded-2xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-sm shadow-md active:scale-95"
                  title="ప్రశ్న మళ్లీ వినండి"
                >
                  <RotateCcw size={22} />
                </button>

                {/* Main Mic Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isListening) {
                      stopVoiceRecognition()
                    } else {
                      stopSpeaking()
                      startVoiceRecognition()
                    }
                  }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 ${
                    isListening
                      ? 'bg-red-500 text-white ring-8 ring-red-400/50 animate-pulse'
                      : 'bg-amber-400 hover:bg-amber-300 text-gray-950 ring-4 ring-amber-300/40'
                  }`}
                  title="మాట్లాడటానికి నొక్కండి"
                >
                  {isListening ? <MicOff size={36} /> : <Mic size={36} />}
                </button>

                {/* Stop Speech Audio */}
                <button
                  type="button"
                  onClick={() => stopSpeaking()}
                  className="w-14 h-14 rounded-2xl bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-sm shadow-md active:scale-95"
                  title="ఆపండి"
                >
                  <VolumeX size={22} />
                </button>
              </div>
            </div>

            {/* Answer Display Card for Active Step */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide block">
                గుర్తించబడిన వివరాలు (Recognized Answer)
              </span>

              {step === 1 && (
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activeCropObj?.icon || '🌾'}</span>
                    <div>
                      <p className="font-extrabold text-gray-900 text-lg">
                        {form.crop_name ? translateCropName(t, form.crop_name) : 'పంట పేరు ఇంకా నమోదు కాలేదు'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {form.crop_name ? '✓ సరైన పంటగా గుర్తించబడింది' : 'మైక్రోఫోన్ నొక్కి పంట పేరు చెప్పండి (ఉదా: వరి, పత్తి)'}
                      </p>
                    </div>
                  </div>
                  {form.crop_name && (
                    <button
                      type="button"
                      onClick={() => {
                        update('crop_name', '')
                        speakAndListen(TELUGU_VOICE_CONVERSATION.q1Crop)
                      }}
                      className="text-xs font-bold text-red-700 bg-white px-3 py-1.5 rounded-xl border border-red-200"
                    >
                      మార్చు
                    </button>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-gray-900 text-2xl">
                      {form.quantity_num} {translateUnit(t, form.unit)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {translateCropName(t, form.crop_name)} పంట పరిమాణం
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakAndListen(TELUGU_VOICE_CONVERSATION.q2Qty(translateCropName(t, form.crop_name)))}
                    className="text-xs font-bold text-[#1E5E3A] bg-white px-3 py-1.5 rounded-xl border border-green-200"
                  >
                    మళ్లీ చెప్పండి
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-[#D9822B] text-2xl">
                      ₹{form.price} <span className="text-sm text-gray-600 font-semibold">/ {translateUnit(t, form.price_unit)}</span>
                    </p>
                    <p className="text-xs text-gray-500">ఆశించే ధర</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakAndListen(TELUGU_VOICE_CONVERSATION.q3Price(translateUnit(t, form.price_unit)))}
                    className="text-xs font-bold text-[#1E5E3A] bg-white px-3 py-1.5 rounded-xl border border-green-200"
                  >
                    మళ్లీ చెప్పండి
                  </button>
                </div>
              )}

              {step === 4 && (
                <div className="p-4 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-between">
                  <div>
                    <p className="font-extrabold text-gray-900 text-lg">
                      {form.delivery_choice === 'today' ? 'ఈరోజే' : form.delivery_choice === 'tomorrow' ? 'రేపు' : form.target_date}
                    </p>
                    <p className="text-xs text-gray-500">డెలివరీ సమయం</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakAndListen(TELUGU_VOICE_CONVERSATION.q4Delivery)}
                    className="text-xs font-bold text-[#1E5E3A] bg-white px-3 py-1.5 rounded-xl border border-green-200"
                  >
                    మళ్లీ చెప్పండి
                  </button>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded-2xl">
                    <div>
                      <span className="text-xs text-gray-500 block">పంట:</span>
                      <strong className="text-gray-900">{translateCropName(t, form.crop_name)}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">పరిమాణం:</span>
                      <strong className="text-gray-900">{form.quantity_num} {translateUnit(t, form.unit)}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">ధర:</span>
                      <strong className="text-[#D9822B]">₹{form.price} / {translateUnit(t, form.price_unit)}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">డెలివరీ:</span>
                      <strong className="text-gray-900">{form.delivery_choice === 'today' ? 'ఈరోజే' : 'రేపు'}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePublish}
                    className="w-full bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg min-h-[56px] text-lg"
                  >
                    {submitting ? <Loader2 size={22} className="animate-spin" /> : <span>🌾 అవును, మార్కెట్లో పోస్ట్ చేయండి</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Manual Quick Selection Touch Buttons (Assistance without typing) */}
            {step === 1 && !form.crop_name && (
              <div className="bg-white rounded-3xl p-4 border border-gray-200">
                <span className="text-xs font-bold text-gray-600 block mb-2">లేదా ఇక్కడ పంటను తాకండి:</span>
                <div className="grid grid-cols-3 gap-2">
                  {catalog.slice(0, 6).map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        handleSelectCrop(c, true)
                        setStep(2)
                        speakAndListen(`${c.telugu.split('(')[0]} ఎంచుకోబడింది. ${TELUGU_VOICE_CONVERSATION.q2Qty(c.telugu.split('(')[0])}`)
                      }}
                      className="p-2.5 rounded-2xl border text-center font-bold text-xs bg-gray-50 hover:bg-green-50 active:scale-95"
                    >
                      <span className="text-2xl block">{c.icon}</span>
                      <span className="truncate block mt-1">{c.telugu ? c.telugu.split('(')[0] : c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step < 5 && (
              <div className="flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="w-1/3 bg-gray-200 text-gray-800 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-1 active:scale-95 min-h-[52px]"
                  >
                    <ChevronLeft size={18} /> వెనుకకు
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => validateAndNext(step)}
                  className="flex-1 bg-[#1E5E3A] text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 min-h-[52px] shadow-md"
                >
                  తర్వాత ప్రశ్నకు వెళ్ళండి <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* MODE 2: VISUAL CROP POSTING (SELECT AND POST)               */}
        {/* ============================================================ */}
        {postingMode === 'visual' && (
          <div className="space-y-4 animate-slide-up">
            {/* Step 1: Crop Selection with Picture Touch & Voice Output */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                      దశ 1 / 4 (Step 1)
                    </span>
                    <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                      <Volume2 size={14} className="text-[#1E5E3A]" /> తాకినప్పుడు వినిపిస్తుంది
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                    మీ పంట చిత్రాన్ని తాకండి
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    మీ వద్ద ఉన్న పంటను కింద ఉన్న బొమ్మలలో చూసి ఎంచుకోండి
                  </p>
                </div>

                {/* Selected Crop Banner */}
                {form.crop_name && (
                  <div className="bg-green-100/90 border-2 border-[#1E5E3A] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{activeCropObj?.icon || '🌾'}</span>
                      <div>
                        <span className="text-[10px] text-[#1E5E3A] font-extrabold uppercase tracking-wide block">
                          ఎంచుకున్న పంట (Selected)
                        </span>
                        <p className="font-extrabold text-gray-900 text-lg">
                          {translateCropName(t, form.crop_name)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => update('crop_name', '')}
                      className="text-xs font-bold text-red-700 bg-white px-3 py-1.5 rounded-xl border border-red-200"
                    >
                      మార్చు
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
                        onClick={() => handleSelectCrop(crop, true)}
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
                    <span>తర్వాత: పరిమాణం ఎంచుకోండి →</span>
                    <ChevronRight size={22} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Quantity with Large Plus / Minus Controls */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm text-center">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                      దశ 2 / 4
                    </span>
                    <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                      {activeCropObj?.icon} {translateCropName(t, form.crop_name)}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                    ఎంత పరిమాణం ఉంది?
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    + మరియు - బటన్లతో పంట పరిమాణాన్ని మార్చండి (టైపింగ్ అవసరం లేదు)
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
                            speak(u === 'Quintal' ? 'క్వింటాల్ ఎంచుకోబడింది' : u === 'Ton' ? 'టన్ను ఎంచుకోబడింది' : 'కిలో ఎంచుకోబడింది', 'te-IN')
                          }}
                          className={`py-3.5 px-2 rounded-2xl font-bold text-sm sm:text-base border-2 transition-all min-h-[50px] flex items-center justify-center gap-1.5 active:scale-95 ${
                            isSelected
                              ? 'bg-[#1E5E3A] text-white border-[#1E5E3A] shadow-md'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {isSelected && <Check size={16} strokeWidth={3} />}
                          <span>{u === 'Quintal' ? 'క్వింటాల్' : u === 'Ton' ? 'టన్ను' : 'కిలో'}</span>
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
                    <ChevronLeft size={20} /> వెనుకకు
                  </button>

                  <button
                    type="button"
                    onClick={() => validateAndNext(2)}
                    className="flex-1 bg-[#1E5E3A] hover:bg-[#16482c] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg"
                  >
                    <span>తర్వాత: ధర నిర్ణయించండి →</span>
                    <ChevronRight size={22} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Price with Large Rupee Controls & Keypad */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm text-center">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full">
                      దశ 3 / 4
                    </span>
                    <span className="text-xs font-bold text-gray-600">
                      {form.quantity_num} {form.unit === 'Quintal' ? 'క్వింటాళ్లు' : form.unit}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                    మీరు ఆశించే ధర ఎంత?
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    + మరియు - బటన్లతో ధరను నిర్ణయించండి
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
                        మండీ మార్కెట్ ధర: ₹{priceGuidance.min_price} – ₹{priceGuidance.max_price} ({priceGuidance.market_name})
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          update('price', String(priceGuidance.modal_price))
                          speak(`మండీ సిఫార్సు ధర ${priceGuidance.modal_price} రూపాయలు ఎంచుకోబడింది`, 'te-IN')
                        }}
                        className="mt-2 bg-white hover:bg-amber-100 text-amber-950 font-bold text-xs py-1.5 px-3 rounded-xl border border-amber-300 shadow-xs"
                      >
                        💡 సిఫార్సు ధరను వాడండి: ₹{priceGuidance.modal_price}
                      </button>
                    </div>
                  )}

                  {/* On-Screen Numeric Keypad (No mobile keyboard needed!) */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-500 block mb-2">ఖచ్చితమైన సంఖ్యను నొక్కండి:</span>
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
                    <ChevronLeft size={20} /> వెనుకకు
                  </button>

                  <button
                    type="button"
                    onClick={() => validateAndNext(3)}
                    className="flex-1 bg-[#1E5E3A] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg"
                  >
                    <span>తర్వాత: డెలివరీ సమయం →</span>
                    <ChevronRight size={22} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Delivery Choice with Picture Touch */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E5E3A] bg-green-100 px-3 py-1 rounded-full mb-2 inline-block">
                    దశ 4 / 4
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
                    మీ పంటను ఎప్పుడు అందించగలరు?
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    మీ పంట ఎప్పుడు సిద్ధంగా ఉంటుందో కింద తాకండి
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
                          <p className="font-extrabold text-gray-900 text-lg">ఈరోజే</p>
                          <p className="text-xs text-gray-500">వెంటనే పికప్ లేదా డెలివరీకి సిద్ధం</p>
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
                          <p className="font-extrabold text-gray-900 text-lg">రేపు</p>
                          <p className="text-xs text-gray-500">మరుసటి రోజు డెలివరీకి సిద్ధం</p>
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
                          <p className="font-extrabold text-gray-900 text-lg">వేరే తేదీని ఎంచుకోండి</p>
                          <p className="text-xs text-gray-500">నిర్దిష్ట భవిష్యత్ తేదీ</p>
                        </div>
                      </div>
                      {form.delivery_choice === 'custom' && <Check size={18} className="text-[#1E5E3A]" />}
                    </button>
                  </div>
                </div>

                {/* Back & Next Navigation */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-1/3 bg-gray-200 text-gray-800 font-bold py-4 rounded-2xl flex items-center justify-center gap-1 active:scale-98 min-h-[56px]"
                  >
                    <ChevronLeft size={20} /> వెనుకకు
                  </button>

                  <button
                    type="button"
                    onClick={() => validateAndNext(4)}
                    className="flex-1 bg-[#1E5E3A] text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 shadow-md min-h-[56px] text-lg"
                  >
                    <span>సమీక్షించండి →</span>
                    <ChevronRight size={22} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Final Review & Publishing with Read Aloud Button */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">మీ పంట వివరాల సమీక్ష</h1>
                    <p className="text-xs text-gray-500 mt-0.5">వివరాలు సరిచూసుకుని పోస్ట్ చేయండి</p>
                  </div>
                  <button
                    type="button"
                    onClick={readSummaryAloud}
                    className="bg-green-100 hover:bg-green-200 text-[#1E5E3A] font-extrabold px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs shadow-xs active:scale-95"
                  >
                    <Volume2 size={16} /> వినండి
                  </button>
                </div>

                {/* 4 Clean Summary Cards */}
                <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
                  {/* Crop */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{activeCropObj?.icon || '🌾'}</span>
                      <div>
                        <span className="text-xs font-bold text-gray-400 block">పంట</span>
                        <p className="font-extrabold text-gray-900 text-lg">{translateCropName(t, form.crop_name)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl"
                    >
                      మార్చు
                    </button>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                    <div>
                      <span className="text-xs font-bold text-gray-400 block">పరిమాణం</span>
                      <p className="font-extrabold text-gray-900 text-lg">{form.quantity_num} {translateUnit(t, form.unit)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl"
                    >
                      మార్చు
                    </button>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                    <div>
                      <span className="text-xs font-bold text-gray-400 block">ఆశించే ధర</span>
                      <p className="font-extrabold text-[#D9822B] text-xl">₹{form.price} / {translateUnit(t, form.price_unit)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl"
                    >
                      మార్చు
                    </button>
                  </div>

                  {/* Delivery */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50">
                    <div>
                      <span className="text-xs font-bold text-gray-400 block">డెలివరీ సమయం</span>
                      <p className="font-extrabold text-gray-900 text-base">
                        {form.delivery_choice === 'today' ? 'ఈరోజే' : form.delivery_choice === 'tomorrow' ? 'రేపు' : form.target_date}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="text-xs font-bold text-[#1E5E3A] bg-green-100 px-3 py-1.5 rounded-xl"
                    >
                      మార్చు
                    </button>
                  </div>
                </div>

                {/* Publish Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePublish}
                    className="w-full bg-[#1E5E3A] hover:bg-[#16482c] disabled:opacity-50 text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg min-h-[56px] text-lg"
                  >
                    {submitting ? (
                      <Loader2 size={22} className="animate-spin" />
                    ) : (
                      <span>🌾 నా పంటను పోస్ట్ చేయండి (Publish Crop)</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
