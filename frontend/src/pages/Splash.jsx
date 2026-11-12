import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isWelcomeSeen, markSplashShown } from '../utils/onboarding.js'

const SPLASH_DURATION_MS = 2400

/**
 * Reusable splash screen. Shown at most once per browser session
 * (see App.jsx onboarding gate + markSplashShown below).
 * After SPLASH_DURATION_MS it hands off to either the Welcome screen
 * (first-ever visit) or straight into the app (returning visitor).
 */
export default function Splash() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    markSplashShown()
    const timer = setTimeout(() => {
      if (isWelcomeSeen()) {
        navigate('/', { replace: true })
      } else {
        navigate('/language', { replace: true })
      }
    }, SPLASH_DURATION_MS)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div
      className="min-h-screen bg-forest-950 flex flex-col items-center justify-center px-6"
      role="status"
      aria-label={t('app.loadingAria')}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <div className="w-20 h-20 rounded-3xl bg-forest-700 flex items-center justify-center shadow-float mb-5">
          <Sprout size={38} className="text-white" />
        </div>
        <h1 className="font-display font-semibold text-white text-3xl tracking-tight">
          {t('app.name')}
        </h1>
        <p className="text-forest-200/70 text-sm mt-2 text-center max-w-xs">
          {t('app.welcomeTagline')}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="absolute bottom-16"
      >
        <div className="w-8 h-8 border-[3px] border-forest-700 border-t-forest-200 rounded-full animate-spin" />
      </motion.div>
    </div>
  )
}
