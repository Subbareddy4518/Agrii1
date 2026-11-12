import { useState, useRef, useEffect } from 'react'
import { X, Mic, Send, Volume2, Sparkles, Sprout, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { aiAdvisor } from '../services/api.js'
import { speak, getSelectedLanguage } from '../utils/onboarding.js'
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '../utils/voiceInput.js'

export default function AiAdvisorModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentLang = getSelectedLanguage()

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognizerRef = useRef(null)
  const scrollRef = useRef(null)

  // Welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeText =
        currentLang === 'te'
          ? `నమస్కారం ${user?.name || 'రైతు'} గారు! నేను మీ అగ్రికనెక్ట్ AI సహాయకుడిని. పంట మార్కెట్ ధరలు, కొనుగోలుదారులు లేదా వ్యాపార సలహాల కోసం అడగండి.`
          : currentLang === 'hi'
          ? `नमस्ते ${user?.name || 'किसान'} जी! मैं आपका एग्रीकनेक्ट AI सलाहकार हूँ। मंडी भाव या फसल बिक्री के बारे में कोई भी प्रश्न पूछें।`
          : `Hello ${user?.name || 'Farmer'}! I am your AgriConnect AI Advisor. Ask me anything about crop prices, matching buyers, or selling tips.`

      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: welcomeText,
          topics: [
            currentLang === 'te' ? '🌾 మార్కెట్ తాజా ధరలు' : currentLang === 'hi' ? '🌾 ताजा मंडी भाव' : '🌾 Current Mandi Benchmark Prices',
            currentLang === 'te' ? '⚡ పంటను త్వరగా అమ్మడం ఎలా?' : currentLang === 'hi' ? '⚡ फसल तेजी से कैसे बेचें?' : '⚡ How to Sell Crops Faster',
            currentLang === 'te' ? '🛡️ సురక్షిత లావాదేవీల చిట్కాలు' : currentLang === 'hi' ? '🛡️ सुरक्षित व्यापार के टिप्स' : '🛡️ Buyer Safety & Verification',
          ],
        },
      ])
    }
  }, [isOpen, currentLang, user, messages.length])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  if (!isOpen) return null

  async function handleSend(textToSend) {
    const query = (textToSend || input).trim()
    if (!query) return

    const userMsg = { id: Date.now(), sender: 'user', text: query }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await aiAdvisor({
        message: query,
        language: currentLang,
        role: user?.role || 'farmer',
      })

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: res.data.reply,
        topics: res.data.suggested_topics,
        actionPrompt: res.data.action_prompt,
      }
      setMessages((prev) => [...prev, aiMsg])

      // Auto read out if desired or user can click speak icon
    } catch {
      toast.error(t('aiAdvisor.error', 'AI Assistant could not respond. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  function toggleVoice() {
    if (isListening) {
      recognizerRef.current?.stop()
      setIsListening(false)
      return
    }

    if (!isSpeechRecognitionSupported()) {
      toast.error(t('aiAdvisor.voiceNotSupported', 'Voice input is not supported in this browser. Please type.'))
      return
    }

    const recognizer = createSpeechRecognizer({
      lang: currentLang,
      onStart: () => setIsListening(true),
      onResult: ({ text }) => {
        setInput(text)
      },
      onError: (err) => {
        setIsListening(false)
        const errType = err?.type || err
        if (errType === 'not-allowed') {
          toast.error(t('createPost.voiceErrors.micDenied', 'Microphone blocked. Allow microphone in browser settings or type.'))
        } else if (errType === 'no-speech') {
          toast.error(t('createPost.voiceErrors.noSpeech', 'No speech detected. Speak close to microphone or type.'))
        } else if (errType === 'network') {
          toast.error(t('createPost.voiceErrors.networkError', 'Connection slow. Check your internet or type.'))
        } else {
          toast.error(t('aiAdvisor.voiceError', 'Could not recognize speech. Please try speaking again or type.'))
        }
      },
      onEnd: () => {
        setIsListening(false)
      },
    })

    if (recognizer) {
      recognizerRef.current = recognizer
      recognizer.start()
    }
  }

  function handleReadAloud(text) {
    speak(text)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-pop-in">
      <div className="bg-white w-full max-w-md h-[85vh] sm:h-[650px] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-float border border-cloud-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-800 to-forest-900 px-4 py-3.5 flex items-center justify-between text-white border-b border-forest-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-harvest-500/20 border border-harvest-400/40 flex items-center justify-center text-harvest-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                {t('aiAdvisor.title', 'AgriConnect AI Advisor')}
                <span className="text-[10px] bg-harvest-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                  AI 2.0
                </span>
              </h3>
              <p className="text-[11px] text-forest-200/80">
                {t('aiAdvisor.subtitle', 'Crop prices, selling tips & market guidance')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-cloud-50/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-forest-700 text-white rounded-br-none'
                    : 'bg-white border border-cloud-200 text-forest-950 rounded-bl-none'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  {m.sender === 'ai' && (
                    <button
                      onClick={() => handleReadAloud(m.text)}
                      className="p-1 rounded-lg text-forest-600 hover:bg-forest-50 shrink-0"
                      title={t('common.readAloud', 'Read aloud')}
                    >
                      <Volume2 size={15} />
                    </button>
                  )}
                </div>

                {m.actionPrompt && (
                  <button
                    onClick={() => {
                      onClose()
                      navigate('/post')
                    }}
                    className="mt-3 w-full bg-harvest-500 hover:bg-harvest-600 text-white font-semibold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <Sprout size={14} /> {m.actionPrompt}
                  </button>
                )}
              </div>

              {/* Suggestion Chips */}
              {m.topics && m.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                  {m.topics.map((t, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(t)}
                      className="text-xs bg-white hover:bg-forest-50 border border-cloud-200 text-forest-800 rounded-full px-3 py-1 font-medium shadow-xs active:scale-95 transition-all text-left"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-forest-800 text-xs bg-white rounded-2xl px-4 py-2.5 w-fit border border-cloud-200 shadow-sm">
              <Loader2 size={14} className="animate-spin text-forest-600" />
              <span>{t('aiAdvisor.thinking', 'AgriConnect AI is analyzing...')}</span>
            </div>
          )}
        </div>

        {/* Listening ripple indicator */}
        {isListening && (
          <div className="bg-harvest-50 border-t border-harvest-200 px-4 py-2 flex items-center justify-between text-xs text-harvest-800 font-semibold animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>{t('createPost.listening', 'Listening... Speak your question now')}</span>
            </div>
            <button
              onClick={() => recognizerRef.current?.stop()}
              className="text-xs underline text-harvest-900 font-bold"
            >
              {t('aiAdvisor.done', 'Done')}
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-cloud-200 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleVoice}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 active:scale-95 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-forest-50 text-forest-700 border border-forest-200 hover:bg-forest-100'
            }`}
            title={t('aiAdvisor.speakQuestion', 'Speak question')}
          >
            <Mic size={18} />
          </button>

          <input
            type="text"
            className="flex-1 px-4 py-2.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 focus:ring-2 focus:ring-forest-100 outline-none text-sm transition-all"
            placeholder={t('aiAdvisor.placeholder', 'Ask about market prices, selling tips...')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
            }}
          />

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-2xl bg-forest-700 hover:bg-forest-800 disabled:opacity-40 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-card"
            title={t('aiAdvisor.send', 'Send')}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
