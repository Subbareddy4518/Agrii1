import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Sprout,
  Building2,
  MapPin,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Eye,
  RefreshCw,
  Loader2,
  Calendar,
  Layers,
  Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createPost, getCropsCatalog, getPriceGuidance, cropAssist } from '../services/api.js'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../utils/voiceInput.js'
import { translateCropName, translateUnit, translateAgriCategory } from '../utils/i18nHelpers.js'
import { getSelectedLanguage, speak } from '../utils/onboarding.js'

const CATEGORIES = ['All', 'Cereals', 'Vegetables', 'Spices', 'Cash Crops', 'Pulses', 'Fruits']
const STANDARD_UNITS = ['Kg', 'Quintal', 'Ton', 'Bags (50kg)', 'Boxes']
const QUALITY_GRADES = ['Grade A / Premium', 'Standard / Grade B', 'Organic']

export default function CreatePost() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isFarmer = user?.role === 'farmer'
  const currentLang = getSelectedLanguage()

  // Step state: 1, 2, or 3
  const [step, setStep] = useState(1)

  // Master Crops Catalog
  const [catalog, setCatalog] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [cropSearch, setCropSearch] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)

  // Form State (Preserved across all 3 steps)
  const [form, setForm] = useState({
    crop_name: '',
    category: '',
    variety: '',
    quality_grade: 'Grade A / Premium',
    quantity_num: '',
    unit: 'Quintal',
    price: '',
    is_negotiable: false,
    location: user?.location || '',
    target_date: '',
    title: '',
    description: '',
    image: null,
  })

  // Voice & AI State
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiProcessing, setAiProcessing] = useState(false)
  const recognizerRef = useRef(null)

  // Mandi Price Guidance
  const [priceGuidance, setPriceGuidance] = useState(null)
  const [loadingGuidance, setLoadingGuidance] = useState(false)

  // Submission State
  const [submitting, setSubmitting] = useState(false)
  const [publishedPost, setPublishedPost] = useState(null)

  // Load Crops Catalog
  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true)
      try {
        const res = await getCropsCatalog()
        setCatalog(res.data)
      } catch {
        // Fallback static list
      } finally {
        setLoadingCatalog(false)
      }
    }
    loadCatalog()
  }, [])

  // When crop_name changes, fetch price guidance and default unit
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
  }

  // Select crop from card
  function handleSelectCrop(crop) {
    setForm((prev) => ({
      ...prev,
      crop_name: crop.name,
      category: crop.category,
      unit: crop.default_unit || prev.unit,
      price: prev.price || (crop.min_price ? String(crop.min_price) : prev.price),
      title: prev.title || `${isFarmer ? 'Fresh Harvest' : 'Need'} ${crop.name}`,
    }))
  }

  // Voice Input Handler (Speech-to-Text)
  function toggleVoiceInput() {
    if (isListening) {
      recognizerRef.current?.stop()
      setIsListening(false)
      return
    }

    if (!isSpeechRecognitionSupported()) {
      toast.error(t('createPost.voiceNotSupported', 'Voice recognition is not supported in this browser. Please type or select a crop.'))
      return
    }

    const recognizer = createSpeechRecognizer({
      lang: currentLang,
      onStart: () => {
        setIsListening(true)
        setVoiceTranscript('')
      },
      onResult: ({ text }) => {
        setVoiceTranscript(text)
      },
      onError: (msg) => {
        setIsListening(false)
        toast.error(msg)
      },
      onEnd: () => {
        setIsListening(false)
        if (voiceTranscript) {
          processAiVoice(voiceTranscript)
        }
      },
    })

    if (recognizer) {
      recognizerRef.current = recognizer
      recognizer.start()
    }
  }

  // Call AI Assistant on Spoken / Typed sentence
  async function processAiVoice(transcript) {
    if (!transcript.trim()) return
    setAiProcessing(true)
    try {
      const res = await cropAssist({
        text: transcript,
        language: currentLang,
        role: user?.role || 'farmer',
      })
      setAiSuggestions(res.data)
      toast.success(t('createPost.aiExtractedToast', 'AI analyzed your speech! Review suggestions below.'))
    } catch {
      toast.error(t('createPost.aiErrorToast', 'Could not parse speech with AI. You can enter details manually.'))
    } finally {
      setAiProcessing(false)
    }
  }

  // Apply AI suggestions to form
  function applyAiSuggestions() {
    if (!aiSuggestions) return
    setForm((prev) => {
      const updated = { ...prev }
      if (aiSuggestions.detected_crop) updated.crop_name = aiSuggestions.detected_crop
      if (aiSuggestions.category) updated.category = aiSuggestions.category
      if (aiSuggestions.variety) updated.variety = aiSuggestions.variety
      if (aiSuggestions.unit) updated.unit = aiSuggestions.unit
      if (aiSuggestions.price) updated.price = String(aiSuggestions.price)
      if (aiSuggestions.is_negotiable !== undefined) updated.is_negotiable = aiSuggestions.is_negotiable
      if (aiSuggestions.location) updated.location = aiSuggestions.location
      if (aiSuggestions.quality_grade) updated.quality_grade = aiSuggestions.quality_grade
      if (aiSuggestions.suggested_title) updated.title = aiSuggestions.suggested_title
      if (aiSuggestions.suggested_description) updated.description = aiSuggestions.suggested_description
      if (aiSuggestions.quantity_amount) {
        const numPart = aiSuggestions.quantity_amount.split(' ')[0]
        if (!isNaN(parseFloat(numPart))) updated.quantity_num = numPart
      }
      return updated
    })
    setAiSuggestions(null)
    toast.success(t('createPost.appliedAi', 'Applied AI details to your listing!'))
  }

  // AI Description Generator
  function handleGenerateAiDescription() {
    const crop = form.crop_name || 'crop'
    const qty = form.quantity_num ? `${form.quantity_num} ${form.unit}` : ''
    const grade = form.quality_grade || 'Grade A'
    const loc = form.location || 'farm'
    const variety = form.variety ? `(${form.variety})` : ''

    let desc = ''
    if (isFarmer) {
      if (currentLang === 'te') {
        desc = `తాజా ${grade} రకం ${crop} ${variety} పంట నేరుగా మా పొలం నుండి అందుబాటులో ఉంది. పరిమాణం: ${qty || 'తగినంత'}. మంచి నాణ్యతతో క్రమబద్ధీకరించబడింది. లొకేషన్: ${loc}. ఆసక్తిగల కొనుగోలుదారులు సంప్రదించవచ్చు.`
      } else if (currentLang === 'hi') {
        desc = `ताजा ${grade} गुणवत्ता वाली ${crop} ${variety} सीधे खेत से बिक्री के लिए उपलब्ध है। मात्रा: ${qty || 'उपलब्ध'}. अच्छी तरह से छंटाई की गई फसल। स्थान: ${loc}. इच्छुक खरीदार कॉल या व्हाट्सएप करें।`
      } else {
        desc = `Freshly harvested ${grade} ${crop} ${variety} available directly from farm. Quantity: ${qty || 'in stock'}. Cleaned and sorted for high quality. Available at ${loc}. Direct buyers welcome.`
      }
    } else {
      if (currentLang === 'te') {
        desc = `మా పరిశ్రమకు మంచి నాణ్యత గల ${crop} ${variety} తక్షణమే అవసరం. పరిమాణం: ${qty || 'అవసరమైనంత'}. లొకేషన్: ${loc}. సత్వర చెల్లింపు హామీ.`
      } else if (currentLang === 'hi') {
        desc = `हमारे उद्योग के लिए उच्च गुणवत्ता वाली ${crop} ${variety} की आवश्यकता है। मात्रा: ${qty || 'आवश्यकतानुसार'}. स्थान: ${loc}. त्वरित भुगतान.`
      } else {
        desc = `Urgent industrial requirement for high quality ${crop} ${variety}. Quantity needed: ${qty || 'Open'}. Delivery to: ${loc}. Prompt and transparent payment terms.`
      }
    }

    update('description', desc)
    toast.success(t('createPost.descGenerated', 'Generated description with AI!'))
  }

  // Pre-fill Recommended Mandi Price
  function handleUseMandiPrice(price) {
    update('price', String(price))
    toast.success(t('createPost.priceApplied', 'Mandi benchmark price applied!'))
  }

  // Validation before advancing
  function canProceedToStep2() {
    return Boolean(form.crop_name.trim())
  }

  function canProceedToStep3() {
    return Boolean(form.crop_name.trim() && (form.title.trim() || form.crop_name.trim()))
  }

  // Submit Listing
  async function handlePublish() {
    if (!form.crop_name.trim()) {
      setStep(1)
      toast.error(t('createPost.errors.cropFarmer', 'Please select a crop'))
      return
    }

    const titleToUse =
      form.title.trim() ||
      `${isFarmer ? 'Fresh' : 'Requirement:'} ${form.crop_name} ${form.variety ? `(${form.variety})` : ''} ${form.quantity_num ? `- ${form.quantity_num} ${form.unit}` : ''}`.trim()

    const quantityFormatted = form.quantity_num ? `${form.quantity_num} ${form.unit}` : null

    setSubmitting(true)
    try {
      const res = await createPost({
        title: titleToUse,
        crop_name: form.crop_name.trim(),
        category: form.category || null,
        variety: form.variety.trim() || null,
        quality_grade: form.quality_grade || null,
        quantity: quantityFormatted,
        price: form.price ? parseFloat(form.price) : null,
        is_negotiable: form.is_negotiable,
        location: form.location.trim() || null,
        target_date: form.target_date || null,
        description: form.description.trim() || null,
        image: form.image,
      })

      setPublishedPost(res.data)
      toast.success(isFarmer ? t('createPost.successToastFarmer') : t('createPost.successToastIndustry'))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('createPost.errors.generic', 'Failed to publish. Try again.'))
    } finally {
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
      crop.telugu.toLowerCase().includes(cropSearch.toLowerCase()) ||
      crop.hindi.toLowerCase().includes(cropSearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Selected crop object if any
  const activeCropObj = catalog.find(
    (c) => c.name.toLowerCase() === form.crop_name.toLowerCase()
  )

  // SUCCESS CELEBRATION MODAL
  if (publishedPost) {
    return (
      <div className="min-h-screen bg-cloud-50 flex flex-col justify-center items-center px-4 py-8">
        <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-float border border-cloud-200 text-center animate-pop-in">
          <div className="w-20 h-20 bg-forest-100 border-2 border-forest-300 rounded-full flex items-center justify-center mx-auto mb-4 text-forest-700 shadow-card">
            <Check size={40} strokeWidth={3} />
          </div>

          <span className="text-xs bg-harvest-100 text-harvest-800 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {isFarmer ? t('createPost.successBadgeFarmer', 'Crop Listed Live!') : t('createPost.successBadgeIndustry', 'Requirement Live!')}
          </span>

          <h2 className="font-display font-bold text-forest-950 text-2xl mt-3">
            {publishedPost.title}
          </h2>

          <p className="text-xs text-forest-900/60 mt-1">
            {isFarmer
              ? t('createPost.successFarmerHelp', 'Your crop is now visible to verified industries in the marketplace.')
              : t('createPost.successIndustryHelp', 'Your requirement is now visible to verified farmers in the marketplace.')}
          </p>

          <div className="bg-forest-50/70 rounded-2xl p-4 my-5 text-left border border-forest-100 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-forest-900/60">{t('postCard.crop', 'Crop')}:</span>
              <span className="font-bold text-forest-950">{publishedPost.crop_name}</span>
            </div>
            {publishedPost.quantity && (
              <div className="flex justify-between">
                <span className="text-forest-900/60">{t('postCard.qty', 'Quantity')}:</span>
                <span className="font-semibold text-forest-950">{publishedPost.quantity}</span>
              </div>
            )}
            {publishedPost.price && (
              <div className="flex justify-between">
                <span className="text-forest-900/60">{t('postCard.price', 'Price')}:</span>
                <span className="font-bold text-harvest-700">₹{publishedPost.price}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-forest-900/60">{t('postCard.location', 'Location')}:</span>
              <span className="font-semibold text-forest-950">{publishedPost.location || user?.location}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => navigate('/matches')}
              className="w-full bg-harvest-500 hover:bg-harvest-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-card"
            >
              <Sparkles size={18} />
              {isFarmer ? t('createPost.seeBuyersBtn', 'See Matching Buyers Now') : t('createPost.seeCropsBtn', 'See Matching Crops Now')}
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Eye size={18} />
              {t('createPost.viewMarketplace', 'View Marketplace Feed')}
            </button>

            <button
              onClick={() => {
                setPublishedPost(null)
                setStep(1)
                setForm({
                  crop_name: '',
                  category: '',
                  variety: '',
                  quality_grade: 'Grade A / Premium',
                  quantity_num: '',
                  unit: 'Quintal',
                  price: '',
                  is_negotiable: false,
                  location: user?.location || '',
                  target_date: '',
                  title: '',
                  description: '',
                  image: null,
                })
              }}
              className="w-full py-2.5 text-xs text-forest-800 font-semibold hover:bg-cloud-100 rounded-xl transition-colors"
            >
              + {isFarmer ? t('createPost.postAnotherFarmer', 'Post Another Crop') : t('createPost.postAnotherIndustry', 'Post Another Requirement')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32 bg-cloud-50">
      <TopBar
        title={isFarmer ? t('createPost.titleFarmer', 'Post Your Crop') : t('createPost.titleIndustry', 'Post Requirement')}
        subtitle={t('createPost.stepCounter', { current: step, total: 3, defaultValue: `Step ${step} of 3` })}
        showSearch={false}
      />

      {/* Progress Bar (Step 1 of 3, Step 2 of 3, Step 3 of 3) */}
      <div className="max-w-md mx-auto px-4 pt-3">
        <div className="bg-white rounded-2xl p-3 border border-cloud-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2 text-xs font-bold text-forest-900">
            <span className={step >= 1 ? 'text-forest-800 flex items-center gap-1' : 'text-forest-900/40'}>
              {step > 1 ? <Check size={14} className="text-forest-600" /> : '1.'} {t('createPost.steps.step1', 'Select Crop')}
            </span>
            <span className={step >= 2 ? 'text-forest-800 flex items-center gap-1' : 'text-forest-900/40'}>
              {step > 2 ? <Check size={14} className="text-forest-600" /> : '2.'} {t('createPost.steps.step2', 'Crop Details')}
            </span>
            <span className={step === 3 ? 'text-harvest-700 font-bold' : 'text-forest-900/40'}>
              3. {t('createPost.steps.step3', 'Review & Publish')}
            </span>
          </div>
          <div className="w-full h-2 bg-cloud-200 rounded-full overflow-hidden flex">
            <div
              className="bg-forest-700 h-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4">
        {/* ============================================================ */}
        {/* STEP 1: WHAT ARE YOU SELLING?                               */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            {/* Voice Input Prompt Banner */}
            <div className="bg-gradient-to-r from-forest-800 to-forest-900 rounded-3xl p-4 text-white shadow-card relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-harvest-500 text-white font-bold px-2 py-0.5 rounded-full uppercase">
                      AI Voice Assistant
                    </span>
                  </div>
                  <h2 className="font-semibold text-white text-base mt-1">
                    {t('createPost.speakPrompt', 'Speak your crop details in Telugu, Hindi or English')}
                  </h2>
                  <p className="text-xs text-forest-200/80 mt-1">
                    {t('createPost.speakExample', 'e.g. "I have 50 quintals Sona Masoori paddy in Miryalaguda"')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-label="Toggle voice input"
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-float active:scale-95 ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-harvest-500 hover:bg-harvest-600 text-white'
                  }`}
                >
                  {isListening ? <MicOff size={26} /> : <Mic size={26} />}
                </button>
              </div>

              {/* Listening Ripple & Transcript */}
              {isListening && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping shrink-0" />
                  <p className="text-xs text-harvest-300 font-medium italic truncate">
                    {voiceTranscript || t('createPost.listeningStatus', 'Listening... speak clearly into microphone')}
                  </p>
                </div>
              )}
            </div>

            {/* AI Assistant Extraction Results Banner */}
            {aiProcessing && (
              <div className="bg-white rounded-2xl p-4 border border-cloud-200 flex items-center gap-3 shadow-sm">
                <Loader2 size={18} className="animate-spin text-forest-600" />
                <span className="text-xs text-forest-900 font-medium">
                  {t('createPost.aiExtracting', 'AgriConnect AI is analyzing crop, quantity, and price...')}
                </span>
              </div>
            )}

            {aiSuggestions && (
              <div className="bg-forest-50 border border-forest-300 rounded-3xl p-4 shadow-card animate-pop-in">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-forest-900 font-bold text-xs">
                    <Sparkles size={14} className="text-forest-700" />
                    <span>{t('createPost.aiSuggestionsFound', 'AI Extracted Details')}</span>
                  </div>
                  <span className="text-[10px] bg-forest-200 text-forest-900 px-2 py-0.5 rounded-full font-semibold">
                    {Math.round((aiSuggestions.confidence_score || 0.9) * 100)}% Match
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-forest-900/80 mb-3">
                  {aiSuggestions.detected_crop && (
                    <p>
                      <strong>{t('postCard.crop', 'Crop')}:</strong> {aiSuggestions.detected_crop}{' '}
                      {aiSuggestions.variety ? `(${aiSuggestions.variety})` : ''}
                    </p>
                  )}
                  {aiSuggestions.quantity_amount && (
                    <p>
                      <strong>{t('postCard.qty', 'Quantity')}:</strong> {aiSuggestions.quantity_amount}
                    </p>
                  )}
                  {aiSuggestions.price && (
                    <p>
                      <strong>{t('postCard.price', 'Price')}:</strong> ₹{aiSuggestions.price}
                    </p>
                  )}
                  {aiSuggestions.location && (
                    <p>
                      <strong>{t('postCard.location', 'Location')}:</strong> {aiSuggestions.location}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyAiSuggestions}
                    className="flex-1 bg-forest-700 hover:bg-forest-800 text-white font-bold text-xs py-2.5 rounded-2xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <Check size={14} /> {t('createPost.applyAiBtn', 'Apply AI Suggestions')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiSuggestions(null)}
                    className="px-3 py-2.5 bg-white border border-forest-200 text-forest-800 rounded-2xl text-xs font-semibold"
                  >
                    {t('common.cancel', 'Dismiss')}
                  </button>
                </div>
              </div>
            )}

            {/* Selected Crop Confirmation Badge */}
            {form.crop_name && (
              <div className="bg-white rounded-2xl p-3 border-2 border-forest-600 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-forest-100 flex items-center justify-center text-xl shrink-0">
                    {activeCropObj?.icon || '🌾'}
                  </div>
                  <div>
                    <span className="text-[10px] text-forest-600 font-bold uppercase tracking-wider">
                      {t('createPost.selectedCropBadge', 'Selected Crop')}
                    </span>
                    <p className="font-bold text-forest-950 text-base leading-tight">
                      {translateCropName(t, form.crop_name)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('crop_name', '')}
                  className="text-xs font-bold text-forest-700 hover:text-forest-900 bg-forest-50 px-2.5 py-1.5 rounded-xl border border-forest-200"
                >
                  {t('common.change', 'Change')}
                </button>
              </div>
            )}

            {/* Search Crop Input */}
            <div>
              <label className="text-xs font-bold text-forest-950 block mb-1.5 uppercase tracking-wide">
                {isFarmer ? t('createPost.chooseCropHeader', 'Or Select Your Crop Below') : t('createPost.chooseReqHeader', 'Select Crop Requirement')}
              </label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-white focus:border-forest-500 focus:ring-4 focus:ring-forest-100 outline-none text-sm transition-all"
                placeholder={t('createPost.searchCropPlaceholder', 'Search crop name (వరి, धान, Cotton, Tomato...)')}
                value={cropSearch}
                onChange={(e) => setCropSearch(e.target.value)}
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold shrink-0 transition-all active:scale-95 ${
                    selectedCategory === cat
                      ? 'bg-forest-700 text-white shadow-xs'
                      : 'bg-white border border-cloud-200 text-forest-900/70 hover:bg-cloud-100'
                  }`}
                >
                  {translateAgriCategory(t, cat)}
                </button>
              ))}
            </div>

            {/* Large Visual Crop Selection Cards */}
            {loadingCatalog ? (
              <div className="grid grid-cols-2 gap-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl skeleton" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredCatalog.map((crop) => {
                  const isSelected = form.crop_name.toLowerCase() === crop.name.toLowerCase()
                  return (
                    <button
                      key={crop.name}
                      type="button"
                      onClick={() => handleSelectCrop(crop)}
                      className={`p-3 rounded-2xl text-left border-2 transition-all flex flex-col justify-between min-h-[96px] active:scale-95 ${
                        isSelected
                          ? 'border-forest-600 bg-forest-50/80 shadow-card ring-2 ring-forest-400'
                          : 'border-cloud-200 bg-white hover:border-forest-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-2xl">{crop.icon}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-forest-700 text-white flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="font-bold text-forest-950 text-sm leading-tight">
                          {translateCropName(t, crop.name)}
                        </p>
                        <p className="text-[11px] text-forest-900/50 truncate mt-0.5">
                          {currentLang === 'te' ? crop.telugu.split('(')[0] : currentLang === 'hi' ? crop.hindi.split('(')[0] : crop.category}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Continue to Step 2 Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={!canProceedToStep2()}
                onClick={() => setStep(2)}
                className="w-full bg-forest-700 hover:bg-forest-800 disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-card min-h-[48px]"
              >
                <span>{t('createPost.continueToDetails', 'Continue to Crop Details')}</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: CROP DETAILS                                         */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            {/* Top Crop summary badge */}
            <div className="bg-forest-50 border border-forest-200 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeCropObj?.icon || '🌾'}</span>
                <div>
                  <p className="font-bold text-forest-950 text-sm">{translateCropName(t, form.crop_name)}</p>
                  <p className="text-[11px] text-forest-900/50">{form.category || 'Agricultural Crop'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-forest-700 underline"
              >
                {t('common.change', 'Change Crop')}
              </button>
            </div>

            {/* MANDI BENCHMARK PRICE GUIDANCE BADGE */}
            {priceGuidance && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <IndianRupee size={14} className="text-amber-700" />
                    <span>{t('createPost.mandiBenchmarkTitle', 'Mandi Market Guidance')}</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 font-semibold px-2 py-0.5 rounded-full">
                    {priceGuidance.market_name}
                  </span>
                </div>
                <p className="text-xs text-amber-950/80 mb-2 leading-relaxed">
                  {t('createPost.typicalRange', {
                    crop: form.crop_name,
                    min: priceGuidance.min_price,
                    max: priceGuidance.max_price,
                    unit: priceGuidance.unit,
                    defaultValue: `Typical market range: ₹${priceGuidance.min_price} – ₹${priceGuidance.max_price} per ${priceGuidance.unit}`,
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => handleUseMandiPrice(priceGuidance.modal_price)}
                  className="bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 font-bold text-xs py-1.5 px-3 rounded-xl flex items-center gap-1 active:scale-95 transition-all"
                >
                  💡 {t('createPost.useSuggestedPrice', { price: priceGuidance.modal_price, defaultValue: `Use Recommended Price: ₹${priceGuidance.modal_price}` })}
                </button>
              </div>
            )}

            {/* Quantity & Unit Selection */}
            <div className="bg-white rounded-3xl p-4 border border-cloud-200 shadow-xs space-y-3">
              <label className="text-xs font-bold text-forest-950 uppercase tracking-wide block">
                {isFarmer ? t('createPost.quantityLabel', 'Available Quantity') : t('createPost.quantityRequiredLabel', 'Required Quantity')} *
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-500 outline-none text-sm font-semibold"
                    placeholder="e.g. 50"
                    value={form.quantity_num}
                    onChange={(e) => update('quantity_num', e.target.value)}
                  />
                </div>
                <div>
                  <select
                    className="w-full px-3 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-500 outline-none text-sm font-semibold"
                    value={form.unit}
                    onChange={(e) => update('unit', e.target.value)}
                  >
                    {STANDARD_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {translateUnit(t, u)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Quantity Presets */}
              <div className="flex gap-1.5 pt-1">
                {['10', '50', '100', '500'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update('quantity_num', val)}
                    className="text-xs px-2.5 py-1 rounded-xl bg-cloud-100 hover:bg-forest-100 text-forest-900 font-medium active:scale-95 transition-all"
                  >
                    {val} {translateUnit(t, form.unit)}
                  </button>
                ))}
              </div>
            </div>

            {/* Expected Price & Negotiable Toggle */}
            <div className="bg-white rounded-3xl p-4 border border-cloud-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-forest-950 uppercase tracking-wide">
                  {isFarmer ? t('createPost.priceLabelFarmer', 'Expected Price (₹)') : t('createPost.priceLabelIndustry', 'Budget Offer (₹)')}
                </label>
                <span className="text-[11px] text-forest-900/50">per {translateUnit(t, form.unit)}</span>
              </div>

              <div className="relative">
                <span className="absolute left-4 top-3.5 text-forest-900/40 font-bold">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full pl-8 pr-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-500 outline-none text-sm font-bold text-harvest-700"
                  placeholder="e.g. 2300"
                  value={form.price}
                  onChange={(e) => update('price', e.target.value)}
                />
              </div>

              {/* Negotiable Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.is_negotiable}
                  onChange={(e) => update('is_negotiable', e.target.checked)}
                  className="w-4 h-4 rounded text-forest-700 accent-forest-700"
                />
                <span className="text-xs font-semibold text-forest-900">
                  {t('createPost.priceNegotiableLabel', 'Price is negotiable upon discussion')}
                </span>
              </label>
            </div>

            {/* Variety & Quality Grade */}
            <div className="bg-white rounded-3xl p-4 border border-cloud-200 shadow-xs space-y-3">
              <div>
                <label className="text-xs font-bold text-forest-950 uppercase tracking-wide block mb-1.5">
                  {t('createPost.varietyLabel', 'Crop Variety')}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-500 outline-none text-sm"
                  placeholder="e.g. Sona Masoori, Teja, Bunny..."
                  value={form.variety}
                  onChange={(e) => update('variety', e.target.value)}
                />

                {/* Quick variety suggestions for this crop */}
                {activeCropObj?.varieties && activeCropObj.varieties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {activeCropObj.varieties.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => update('variety', v)}
                        className={`text-[11px] px-2.5 py-1 rounded-xl transition-all ${
                          form.variety === v
                            ? 'bg-forest-700 text-white font-bold'
                            : 'bg-cloud-100 hover:bg-forest-50 text-forest-900 font-medium'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-forest-950 uppercase tracking-wide block mb-1.5">
                  {t('createPost.qualityLabel', 'Quality Grade')}
                </label>
                <div className="flex gap-2">
                  {QUALITY_GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => update('quality_grade', g)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                        form.quality_grade === g
                          ? 'bg-forest-700 text-white shadow-xs'
                          : 'bg-cloud-100 text-forest-900/70 hover:bg-cloud-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Location & Harvest Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-forest-950 uppercase tracking-wide block mb-1">
                  {t('createPost.locationLabel', 'Location')}
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 rounded-2xl border border-cloud-200 bg-white focus:border-forest-500 outline-none text-xs"
                  placeholder="Village / District"
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-forest-950 uppercase tracking-wide block mb-1">
                  {isFarmer ? t('createPost.harvestDateLabel', 'Harvest Date') : t('createPost.requiredBeforeLabel', 'Required By')}
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 rounded-2xl border border-cloud-200 bg-white focus:border-forest-500 outline-none text-xs"
                  value={form.target_date}
                  onChange={(e) => update('target_date', e.target.value)}
                />
              </div>
            </div>

            {/* Photo Upload */}
            <ImagePicker
              value={form.image}
              onChange={(url) => update('image', url)}
              label={isFarmer ? t('createPost.photoLabelFarmer', 'Add Crop Photos (Recommended)') : t('createPost.photoLabelIndustry', 'Add Photo / Specification (Optional)')}
            />

            {/* Title & AI Description Generator */}
            <div className="bg-white rounded-3xl p-4 border border-cloud-200 shadow-xs space-y-3">
              <div>
                <label className="text-xs font-bold text-forest-950 uppercase tracking-wide block mb-1">
                  {isFarmer ? t('createPost.postTitleLabel', 'Listing Title') : t('createPost.requirementTitleLabel', 'Requirement Title')}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-500 outline-none text-sm font-semibold"
                  placeholder={
                    isFarmer
                      ? `Fresh Harvest ${form.crop_name || 'Crop'} (${form.quantity_num || ''} ${form.unit})`
                      : `Need ${form.crop_name || 'Crop'} ${form.quantity_num || ''} ${form.unit}`
                  }
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-forest-950 uppercase tracking-wide">
                    {t('createPost.descriptionLabel', 'Description')}
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAiDescription}
                    className="flex items-center gap-1 text-xs text-forest-700 bg-forest-50 hover:bg-forest-100 px-2.5 py-1 rounded-full font-bold border border-forest-200 active:scale-95 transition-all"
                  >
                    <Wand2 size={13} /> {t('createPost.aiGenerateDesc', 'AI Write Description')}
                  </button>
                </div>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-500 outline-none text-xs leading-relaxed"
                  placeholder={t('createPost.descPlaceholderFarmer', 'Describe your harvest quality, freshness, and packaging details...')}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3.5 rounded-2xl border border-cloud-200 text-forest-900 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all min-h-[48px]"
              >
                <ChevronLeft size={16} />
                {t('common.back', 'Back')}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-[2] bg-forest-700 hover:bg-forest-800 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-card min-h-[48px]"
              >
                <span>{t('createPost.reviewBtn', 'Review & Publish')}</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: REVIEW AND PUBLISH                                   */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-forest-950 text-lg">
                {t('createPost.previewHeader', 'Review Your Listing')}
              </h2>
              <span className="text-xs bg-forest-100 text-forest-800 font-bold px-2.5 py-1 rounded-full">
                {isFarmer ? t('createPost.previewBadgeFarmer', 'Farmer Listing Preview') : t('createPost.previewBadgeIndustry', 'Industry Requirement Preview')}
              </span>
            </div>

            {/* LIVE BUYER PREVIEW CARD */}
            <div className="bg-white rounded-3xl shadow-float border-2 border-forest-600/30 overflow-hidden">
              <div className="bg-forest-700 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold">
                <span>{t('createPost.howBuyersSeeIt', 'How buyers will see your listing')}</span>
                <span className="text-harvest-300 font-bold">✓ Ready to Post</span>
              </div>

              {/* Photo preview */}
              {form.image ? (
                <div className="w-full aspect-[16/9] bg-cloud-100 overflow-hidden">
                  <img src={form.image} alt={form.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full py-8 bg-forest-50/50 flex flex-col items-center justify-center text-forest-800/60">
                  <span className="text-4xl mb-1">{activeCropObj?.icon || '🌾'}</span>
                  <span className="text-xs">{t('createPost.noPhotoAdded', 'Listing with no photo (Using crop icon)')}</span>
                </div>
              )}

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-forest-950 text-base leading-snug">
                      {form.title.trim() || `${isFarmer ? 'Fresh' : 'Requirement:'} ${form.crop_name}`}
                    </h3>
                    <p className="text-xs text-forest-900/60 flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> {form.location || user?.location || 'Location Not Specified'}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-forest-100 text-forest-800 shrink-0">
                    {translateCropName(t, form.crop_name)}
                  </span>
                </div>

                {form.description && (
                  <p className="text-xs text-forest-900/80 leading-relaxed bg-cloud-50 p-2.5 rounded-2xl border border-cloud-200/80">
                    {form.description}
                  </p>
                )}

                {/* Details Pills */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-cloud-100/80 rounded-2xl p-2.5 text-xs">
                    <span className="text-forest-900/50 block text-[10px] uppercase font-bold">{t('postCard.qty', 'Quantity')}</span>
                    <span className="font-bold text-forest-950">
                      {form.quantity_num ? `${form.quantity_num} ${translateUnit(t, form.unit)}` : 'Open'}
                    </span>
                  </div>

                  <div className="bg-harvest-50 rounded-2xl p-2.5 text-xs border border-harvest-200/60">
                    <span className="text-harvest-800/70 block text-[10px] uppercase font-bold">{t('postCard.price', 'Price')}</span>
                    <span className="font-bold text-harvest-700 text-sm">
                      {form.price ? `₹${form.price} / ${translateUnit(t, form.unit)}` : 'Negotiable'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.variety && (
                    <span className="text-[11px] font-semibold bg-forest-50 text-forest-800 px-2.5 py-1 rounded-xl border border-forest-200">
                      Variety: {form.variety}
                    </span>
                  )}
                  {form.quality_grade && (
                    <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-xl border border-emerald-200">
                      Grade: {form.quality_grade}
                    </span>
                  )}
                  {form.is_negotiable && (
                    <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-xl border border-amber-200">
                      Price Negotiable
                    </span>
                  )}
                </div>

                {/* Seller Preview Footer */}
                <div className="pt-3 border-t border-cloud-100 flex items-center justify-between text-xs text-forest-900/60">
                  <span className="font-semibold text-forest-950">{user?.name} (You)</span>
                  <span className="text-[11px] bg-forest-100 text-forest-800 px-2 py-0.5 rounded-full font-bold">
                    ✓ Verified Mobile Contact
                  </span>
                </div>
              </div>
            </div>

            {/* Checklist & Quick Edit Jumps */}
            <div className="bg-white rounded-3xl p-4 border border-cloud-200 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-cloud-100">
                <span className="text-forest-900/70">{t('createPost.checkCrop', 'Crop & Category')}:</span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="font-bold text-forest-700 hover:underline flex items-center gap-1"
                >
                  {form.crop_name} <span className="text-[10px] bg-cloud-100 px-1.5 py-0.5 rounded">Edit</span>
                </button>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-cloud-100">
                <span className="text-forest-900/70">{t('createPost.checkQty', 'Quantity & Price')}:</span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="font-bold text-forest-700 hover:underline flex items-center gap-1"
                >
                  {form.quantity_num || 'Not set'} {form.unit} &middot; ₹{form.price || 'Negotiable'}{' '}
                  <span className="text-[10px] bg-cloud-100 px-1.5 py-0.5 rounded">Edit</span>
                </button>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-forest-900/70">{t('createPost.checkLocation', 'Location & Contact')}:</span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="font-bold text-forest-700 hover:underline flex items-center gap-1"
                >
                  {form.location || 'Default'} <span className="text-[10px] bg-cloud-100 px-1.5 py-0.5 rounded">Edit</span>
                </button>
              </div>
            </div>

            {/* Navigation & Big Action Button */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handlePublish}
                className="w-full bg-forest-700 hover:bg-forest-800 text-white font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-float min-h-[48px]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>{t('createPost.publishing', 'Publishing Listing...')}</span>
                  </>
                ) : (
                  <>
                    <Sprout size={20} />
                    <span>
                      {isFarmer
                        ? t('createPost.publishCropBtn', '🌾 Publish Crop Now')
                        : t('createPost.publishReqBtn', '📢 Publish Requirement Now')}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-2xl border border-cloud-200 text-forest-900/80 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-cloud-100 active:scale-95 transition-all min-h-[44px]"
              >
                <ChevronLeft size={16} />
                {t('createPost.backToDetails', 'Back to Crop Details')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
