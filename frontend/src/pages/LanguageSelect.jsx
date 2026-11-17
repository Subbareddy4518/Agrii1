import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Languages, ArrowRight, ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { setSelectedLanguage, speak } from '../utils/onboarding.js'
import { SPEECH_LANG_MAP } from '../i18n/index.js'
import { LANGUAGES } from '../i18n/languages.js'
import SpeakerIcon from '../components/SpeakerIcon.jsx'

export default function LanguageSelect() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [selected, setSelected] = useState(i18n.language || 'en')

  function chooseLanguage(code) {
    setSelected(code)
    setSelectedLanguage(code)
    // Pronounce the language name upon tap for illiterate/low-literacy farmers
    const langObj = LANGUAGES.find((l) => l.code === code)
    if (langObj) {
      speak(langObj.native, SPEECH_LANG_MAP[code])
    }
  }

  function handleContinue() {
    navigate('/role')
  }

  function handleBack() {
    navigate('/welcome')
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col justify-center px-6 py-8">
      <div className="max-w-sm mx-auto w-full">
        {/* Back navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={handleBack}
            aria-label={t('common.back', 'Back')}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-forest-200 hover:text-white font-medium text-sm py-1.5 px-3 rounded-xl hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <ArrowLeft size={18} />
            <span>{t('common.back', 'Back')}</span>
          </button>
        </div>

        {/* Screen 2 Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center mb-7"
        >
          <div className="w-16 h-16 rounded-2xl bg-forest-700/80 border border-forest-600/50 flex items-center justify-center shadow-float mb-3.5">
            <Languages size={28} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-white text-2xl sm:text-3xl leading-snug">
            {t('onboarding.language.title', 'Choose your language')}
          </h1>
          <p className="text-forest-200/80 text-sm mt-1 max-w-xs">
            {t('onboarding.language.subtitle', 'You can change this anytime')}
          </p>
        </motion.div>

        {/* Language Selection Cards (min-h 64px, large touch targets) */}
        <div className="space-y-3.5" role="radiogroup" aria-label={t('onboarding.language.ariaLabel', 'Select your preferred language')}>
          {LANGUAGES.map(({ code, label, native }, i) => {
            const isActive = selected === code
            return (
              <motion.button
                key={code}
                type="button"
                role="radio"
                aria-checked={isActive}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                onClick={() => chooseLanguage(code)}
                className={`w-full min-h-[68px] flex items-center justify-between gap-3.5 rounded-2xl p-4 border-2 transition-all active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-forest-500/40 ${
                  isActive
                    ? 'bg-white border-harvest-400 shadow-float ring-2 ring-harvest-400/50'
                    : 'bg-white/[0.08] border-white/15 hover:bg-white/[0.12] hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-display font-bold text-base shadow-xs ${
                      isActive ? 'bg-forest-700 text-white' : 'bg-white/10 text-white'
                    }`}
                  >
                    {native.slice(0, 1)}
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg leading-tight ${isActive ? 'text-forest-950' : 'text-white'}`}>
                      {native}
                    </p>
                    <p className={`text-xs mt-0.5 ${isActive ? 'text-forest-800/70 font-medium' : 'text-forest-200/70'}`}>
                      {label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SpeakerIcon
                    text={native}
                    lang={SPEECH_LANG_MAP[code]}
                    label={t('common.readAloudLabel', { text: label })}
                    className={isActive ? 'text-forest-800 hover:bg-forest-50' : 'text-white hover:bg-white/10'}
                  />
                  {isActive ? (
                    <div className="w-7 h-7 rounded-full bg-forest-700 flex items-center justify-center shrink-0 shadow-xs">
                      <Check size={16} className="text-white" strokeWidth={2.5} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-white/30 shrink-0" />
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Navigation Action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <button
            onClick={handleContinue}
            className="w-full min-h-[52px] bg-forest-700 hover:bg-forest-600 text-white font-semibold text-base py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-float focus:outline-none focus:ring-4 focus:ring-forest-500/40 border border-forest-600/60"
          >
            <span>{t('onboarding.language.continue', 'Continue')}</span>
            <ArrowRight size={18} />
          </button>
        </motion.div>
      </div>
    </div>
  )
}
