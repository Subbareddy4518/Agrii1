import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Volume2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { markWelcomeSeen, setVoiceEnabled } from '../utils/onboarding.js'

export default function VoiceAssist() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  function finish(enabled) {
    setVoiceEnabled(enabled)
    markWelcomeSeen()
    navigate('/register', { replace: true })
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col justify-center px-6 py-10">
      <div className="max-w-sm mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-3xl bg-forest-700 flex items-center justify-center shadow-float mb-5">
            <Volume2 size={28} className="text-white" />
          </div>
          <h1 className="font-display font-semibold text-white text-xl leading-snug">
            {t('onboarding.voice.title')}
          </h1>
          <p className="text-forest-200/70 text-sm mt-3 max-w-xs leading-relaxed">
            {t('onboarding.voice.subtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-10 space-y-3"
        >
          <button
            type="button"
            onClick={() => finish(true)}
            aria-label={t('onboarding.voice.enableAria')}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-float focus:outline-none focus:ring-4 focus:ring-forest-600/40"
          >
            <Volume2 size={18} /> {t('onboarding.voice.enable')}
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            aria-label={t('onboarding.voice.skipAria')}
            className="w-full bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-forest-100 font-medium py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all focus:outline-none focus:ring-4 focus:ring-white/10"
          >
            <X size={18} /> {t('onboarding.voice.skip')}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
