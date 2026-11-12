import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sprout, Building2, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { speak } from '../utils/onboarding.js'
import { SPEECH_LANG_MAP } from '../i18n/index.js'
import SpeakerIcon from '../components/SpeakerIcon.jsx'

export default function RoleSelect() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [selectedRole, setSelectedRole] = useState('farmer')

  const currentLang = i18n.language || 'en'
  const speechLang = SPEECH_LANG_MAP[currentLang]

  const farmerTitle = t('onboarding.role.farmerTitle', 'I am a Farmer')
  const farmerSubtitle = t('onboarding.role.farmerSubtitle', 'I want to sell my crops.')
  const buyerTitle = t('onboarding.role.buyerTitle', 'I am a Buyer')
  const buyerSubtitle = t('onboarding.role.buyerSubtitle', 'I want to purchase crops.')

  function handleSelectRole(role) {
    setSelectedRole(role)
    const textToSpeak = role === 'farmer' ? `${farmerTitle}. ${farmerSubtitle}` : `${buyerTitle}. ${buyerSubtitle}`
    speak(textToSpeak, speechLang)
  }

  function handleContinue() {
    navigate(`/register?role=${selectedRole}`)
  }

  function handleBack() {
    navigate('/language')
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

        {/* Screen 3 Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center mb-7"
        >
          <div className="w-16 h-16 rounded-2xl bg-forest-700/80 border border-forest-600/50 flex items-center justify-center shadow-float mb-3.5">
            <Sprout size={28} className="text-white" />
          </div>
          <h1 className="font-display font-bold text-white text-2xl sm:text-3xl leading-snug">
            {t('onboarding.role.title', 'Choose How You Use AgriConnect')}
          </h1>
          <p className="text-forest-200/80 text-sm mt-1 max-w-xs">
            {t('onboarding.role.subtitle', 'Select your role to get started')}
          </p>
        </motion.div>

        {/* Role Cards (min-h 72px, large touch targets) */}
        <div className="space-y-4" role="radiogroup" aria-label={t('onboarding.role.title', 'Choose How You Use AgriConnect')}>
          {/* Farmer Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            onClick={() => handleSelectRole('farmer')}
            className={`w-full min-h-[76px] flex items-center justify-between gap-3.5 rounded-2xl p-4 border-2 transition-all cursor-pointer active:scale-[0.98] focus:outline-none ${
              selectedRole === 'farmer'
                ? 'bg-white border-harvest-400 shadow-float ring-2 ring-harvest-400/50'
                : 'bg-white/[0.08] border-white/15 hover:bg-white/[0.12] hover:border-white/25'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  selectedRole === 'farmer' ? 'bg-forest-100 text-forest-700' : 'bg-forest-800 text-forest-200'
                }`}
              >
                <Sprout size={30} strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className={`font-display font-bold text-lg leading-tight ${selectedRole === 'farmer' ? 'text-forest-950' : 'text-white'}`}>
                  {farmerTitle}
                </p>
                <p className={`text-xs mt-1 ${selectedRole === 'farmer' ? 'text-forest-800/80 font-medium' : 'text-forest-200/70'}`}>
                  {farmerSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SpeakerIcon
                text={`${farmerTitle}. ${farmerSubtitle}`}
                lang={speechLang}
                label={t('common.readAloud', 'Read aloud')}
                className={selectedRole === 'farmer' ? 'text-forest-800 hover:bg-forest-50' : 'text-white hover:bg-white/10'}
              />
              {selectedRole === 'farmer' ? (
                <div className="w-7 h-7 rounded-full bg-forest-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Check size={16} className="text-white" strokeWidth={2.5} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border border-white/30 shrink-0" />
              )}
            </div>
          </motion.div>

          {/* Buyer / Industry Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            onClick={() => handleSelectRole('industry')}
            className={`w-full min-h-[76px] flex items-center justify-between gap-3.5 rounded-2xl p-4 border-2 transition-all cursor-pointer active:scale-[0.98] focus:outline-none ${
              selectedRole === 'industry'
                ? 'bg-white border-harvest-400 shadow-float ring-2 ring-harvest-400/50'
                : 'bg-white/[0.08] border-white/15 hover:bg-white/[0.12] hover:border-white/25'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  selectedRole === 'industry' ? 'bg-amber-100 text-amber-700' : 'bg-amber-900/40 text-harvest-300'
                }`}
              >
                <Building2 size={28} strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className={`font-display font-bold text-lg leading-tight ${selectedRole === 'industry' ? 'text-forest-950' : 'text-white'}`}>
                  {buyerTitle}
                </p>
                <p className={`text-xs mt-1 ${selectedRole === 'industry' ? 'text-forest-800/80 font-medium' : 'text-forest-200/70'}`}>
                  {buyerSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SpeakerIcon
                text={`${buyerTitle}. ${buyerSubtitle}`}
                lang={speechLang}
                label={t('common.readAloud', 'Read aloud')}
                className={selectedRole === 'industry' ? 'text-forest-800 hover:bg-forest-50' : 'text-white hover:bg-white/10'}
              />
              {selectedRole === 'industry' ? (
                <div className="w-7 h-7 rounded-full bg-forest-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Check size={16} className="text-white" strokeWidth={2.5} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border border-white/30 shrink-0" />
              )}
            </div>
          </motion.div>
        </div>

        {/* Action Controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 space-y-4"
        >
          <button
            onClick={handleContinue}
            className="w-full min-h-[52px] bg-forest-700 hover:bg-forest-600 text-white font-semibold text-base py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-float focus:outline-none focus:ring-4 focus:ring-forest-500/40 border border-forest-600/60"
          >
            <span>{t('onboarding.welcome.continue', 'Continue')}</span>
            <ArrowRight size={18} />
          </button>

          <p className="text-center text-forest-200/80 text-sm pt-1">
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
