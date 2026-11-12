import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, HandCoins, MessagesSquare, ShieldCheck, Sprout } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const FEATURES = [
  { icon: HandCoins, key: 'fairPrices' },
  { icon: MessagesSquare, key: 'directCommunication' },
  { icon: ShieldCheck, key: 'trustedBuyers' },
  { icon: Sprout, key: 'easySelling' },
]

export default function Welcome() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col px-6 py-10">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center text-center mt-4"
        >
          <div
            className="w-full aspect-[4/3] max-h-56 rounded-3xl bg-gradient-to-br from-forest-700 to-forest-900 border border-forest-700/60 shadow-float flex items-center justify-center mb-8 overflow-hidden relative"
            aria-hidden="true"
          >
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.5) 0, transparent 35%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.35) 0, transparent 40%)'
            }} />
            <Sprout size={72} className="text-forest-200" strokeWidth={1.3} />
          </div>

          <h1 className="font-display font-semibold text-white text-2xl leading-snug">
            {t('onboarding.welcome.title')}
          </h1>
          <p className="text-forest-200/70 text-sm mt-2 max-w-xs">
            {t('onboarding.welcome.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 mt-8">
          {FEATURES.map(({ icon: Icon, key }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
              className="bg-white/[0.06] border border-white/10 rounded-2xl p-4 backdrop-blur-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-forest-700/60 flex items-center justify-center mb-2.5">
                <Icon size={18} className="text-forest-100" />
              </div>
              <p className="text-white font-medium text-sm">{t(`onboarding.welcome.features.${key}.title`)}</p>
              <p className="text-forest-200/60 text-xs mt-0.5 leading-snug">{t(`onboarding.welcome.features.${key}.desc`)}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex-1" />

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          onClick={() => navigate('/voice')}
          aria-label={t('onboarding.welcome.getStartedAria')}
          className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all mt-8 shadow-float focus:outline-none focus:ring-4 focus:ring-forest-600/40"
        >
          {t('onboarding.welcome.getStarted')} <ArrowRight size={18} />
        </motion.button>
      </div>
    </div>
  )
}
