import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Languages, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { setSelectedLanguage } from '../utils/onboarding.js'
import { SPEECH_LANG_MAP } from '../i18n/index.js'
import { LANGUAGES } from '../i18n/languages.js'
import SpeakerIcon from '../components/SpeakerIcon.jsx'

export default function LanguageSelect() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [selected, setSelected] = useState(i18n.language || 'en')

  // Selecting a tile switches the whole app's language immediately —
  // no refresh, no waiting for "Continue" — so the person can see this
  // very screen (and everything behind it) render in their choice
  // before committing to it.
  function chooseLanguage(code) {
    setSelected(code)
    setSelectedLanguage(code)
  }

  function handleContinue() {
    navigate('/welcome')
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col justify-center px-6 py-10">
      <div className="max-w-sm mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center mb-8"
        >
          <div className="w-14 h-14 rounded-2xl bg-forest-700 flex items-center justify-center shadow-float mb-4">
            <Languages size={24} className="text-white" />
          </div>
          <h1 className="font-display font-semibold text-white text-xl">
            {t('onboarding.language.title')}
          </h1>
          <p className="text-forest-200/70 text-sm mt-1">{t('onboarding.language.subtitle')}</p>
        </motion.div>

        <div className="space-y-3" role="radiogroup" aria-label={t('onboarding.language.ariaLabel')}>
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
                className={`w-full flex items-center justify-between gap-3 rounded-2xl p-4 border transition-all active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-forest-600/30 ${
                  isActive
                    ? 'bg-white border-white shadow-float'
                    : 'bg-white/[0.06] border-white/10 hover:bg-white/[0.1]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-display font-semibold text-sm ${
                      isActive ? 'bg-forest-100 text-forest-700' : 'bg-white/10 text-white'
                    }`}
                  >
                    {native.slice(0, 1)}
                  </div>
                  <div className="text-left">
                    <p className={`font-medium text-[15px] ${isActive ? 'text-forest-950' : 'text-white'}`}>
                      {native}
                    </p>
                    <p className={`text-xs ${isActive ? 'text-forest-900/50' : 'text-forest-200/60'}`}>
                      {label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <SpeakerIcon
                    text={native}
                    lang={SPEECH_LANG_MAP[code]}
                    label={t('common.readAloudLabel', { text: label })}
                    className={isActive ? 'text-forest-700 hover:bg-forest-50' : 'text-white hover:bg-white/10'}
                  />
                  {isActive && (
                    <div className="w-6 h-6 rounded-full bg-forest-700 flex items-center justify-center shrink-0">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={handleContinue}
          className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all mt-8 focus:outline-none focus:ring-4 focus:ring-forest-600/40"
        >
          {t('onboarding.language.continue')} <ArrowRight size={18} />
        </motion.button>
      </div>
    </div>
  )
}
