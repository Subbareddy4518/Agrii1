import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sprout } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import SpeakerIcon from '../components/SpeakerIcon.jsx'
import { SPEECH_LANG_MAP } from '../i18n/index.js'

export default function Welcome() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const welcomeTitle = t('onboarding.welcome.title', 'Welcome to AgriConnect')
  const welcomeTagline = t('onboarding.welcome.tagline', 'Connect farmers and buyers directly.')
  const speechText = `${welcomeTitle}. ${welcomeTagline}`

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col justify-between px-6 py-10">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center">
        {/* Audio helper button in top right */}
        <div className="flex justify-end mb-4">
          <SpeakerIcon
            text={speechText}
            lang={SPEECH_LANG_MAP[i18n.language || 'en']}
            label={t('common.readAloud', 'Read aloud')}
            className="text-forest-200 hover:text-white bg-white/10 hover:bg-white/20"
          />
        </div>

        {/* Screen 1 Visual & Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center text-center"
        >
          {/* Simple warm agricultural visual */}
          <div
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-forest-600 via-forest-700 to-forest-900 border-2 border-forest-500/40 shadow-float flex items-center justify-center mb-6 relative overflow-hidden"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.6) 0, transparent 40%), radial-gradient(circle at 80% 80%, rgba(217,130,43,0.5) 0, transparent 50%)',
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-forest-800/80 flex items-center justify-center shadow-inner">
              <Sprout size={44} className="text-forest-100" strokeWidth={1.75} />
            </div>
          </div>

          <h1 className="font-display font-bold text-white text-3xl sm:text-4xl tracking-tight leading-tight">
            {welcomeTitle}
          </h1>

          <p className="text-forest-100/90 text-base sm:text-lg mt-3 max-w-xs font-medium leading-relaxed">
            {welcomeTagline}
          </p>
        </motion.div>

        {/* Screen 1 Actions: Continue button & Sign In link */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-12 space-y-4"
        >
          <button
            onClick={() => navigate('/language')}
            aria-label={t('onboarding.welcome.continue', 'Continue')}
            className="w-full min-h-[54px] bg-forest-700 hover:bg-forest-600 text-white font-semibold text-base py-4 px-6 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-float focus:outline-none focus:ring-4 focus:ring-forest-500/40 border border-forest-600/60"
          >
            <span>{t('onboarding.welcome.continue', 'Continue')}</span>
            <ArrowRight size={20} />
          </button>

          <p className="text-center text-forest-200/80 text-sm pt-2">
            {t('onboarding.welcome.signInPrompt', 'Already have an account?')}{' '}
            <Link
              to="/login"
              className="text-white font-semibold underline underline-offset-4 hover:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-white/40 rounded px-1"
            >
              {t('onboarding.welcome.signIn', 'Sign In')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
