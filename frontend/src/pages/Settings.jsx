import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Info,
  Languages,
  LogOut,
  ShieldCheck,
  Volume2,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  isVoiceEnabled,
  setSelectedLanguage,
  setVoiceEnabled,
} from '../utils/onboarding.js'
import { LANGUAGES } from '../i18n/languages.js'

function SectionCard({ children }) {
  return (
    <div className="bg-white rounded-3xl shadow-card border border-cloud-200/70 divide-y divide-cloud-100 overflow-hidden">
      {children}
    </div>
  )
}

function Row({ icon: Icon, label, onClick, right, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-cloud-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-forest-300 ${
        danger ? 'text-red-500' : 'text-forest-950'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          danger ? 'bg-red-50' : 'bg-forest-50'
        }`}
      >
        <Icon size={16} className={danger ? 'text-red-500' : 'text-forest-700'} />
      </div>
      <span className="flex-1 font-medium text-[15px]">{label}</span>
      {right}
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { t, i18n } = useTranslation()
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [voiceOn, setVoiceOn] = useState(isVoiceEnabled())

  // i18n.language is the single source of truth for the active
  // language, so this screen always reflects it — including if it was
  // changed elsewhere (e.g. during onboarding) — with no local copy to
  // fall out of sync.
  const language = i18n.language

  function chooseLanguage(code) {
    setSelectedLanguage(code) // instant, app-wide — no refresh needed
    setShowLanguagePicker(false)
  }

  function toggleVoice() {
    const next = !voiceOn
    setVoiceOn(next)
    setVoiceEnabled(next)
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-cloud-50 pb-28">
      <TopBar title={t('settings.title')} showSearch={false} />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-5">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-forest-700 font-medium text-sm mb-1"
        >
          <ArrowLeft size={16} /> {t('settings.back')}
        </motion.button>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="text-xs font-semibold text-forest-900/40 uppercase tracking-wide mb-2 px-1">{t('settings.preferences')}</p>
          <SectionCard>
            <Row
              icon={Languages}
              label={t('settings.language')}
              onClick={() => setShowLanguagePicker(true)}
              right={
                <span className="flex items-center gap-1 text-sm text-forest-900/50">
                  {LANGUAGES.find((l) => l.code === language)?.native || language}
                  <ChevronRight size={16} />
                </span>
              }
            />
            <Row
              icon={Volume2}
              label={t('settings.voiceGuidance')}
              onClick={toggleVoice}
              right={
                <span
                  role="switch"
                  aria-checked={voiceOn}
                  aria-label={t('settings.toggleVoiceAria')}
                  className={`w-11 h-6 rounded-full relative transition-colors ${
                    voiceOn ? 'bg-forest-700' : 'bg-cloud-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      voiceOn ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              }
            />
          </SectionCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <p className="text-xs font-semibold text-forest-900/40 uppercase tracking-wide mb-2 px-1">{t('settings.about')}</p>
          <SectionCard>
            <Row icon={Info} label={t('settings.aboutApp')} onClick={() => setShowAbout(true)} right={<ChevronRight size={16} className="text-forest-900/30" />} />
            <Row icon={ShieldCheck} label={t('settings.privacyPolicy')} onClick={() => setShowPrivacy(true)} right={<ChevronRight size={16} className="text-forest-900/30" />} />
          </SectionCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <SectionCard>
            <Row icon={LogOut} label={t('settings.logout')} onClick={handleLogout} danger />
          </SectionCard>
        </motion.div>
      </main>

      {showLanguagePicker && (
        <Modal onClose={() => setShowLanguagePicker(false)} title={t('settings.chooseLanguage')} closeLabel={t('settings.closeAria')}>
          <div className="space-y-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => chooseLanguage(l.code)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${
                  language === l.code ? 'border-forest-400 bg-forest-50' : 'border-cloud-200'
                }`}
              >
                <span className="font-medium text-forest-950">{l.native}</span>
                {language === l.code && <Check size={16} className="text-forest-700" />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showAbout && (
        <Modal onClose={() => setShowAbout(false)} title={t('settings.aboutApp')} closeLabel={t('settings.closeAria')}>
          <p className="text-sm text-forest-900/70 leading-relaxed">{t('settings.aboutText')}</p>
        </Modal>
      )}

      {showPrivacy && (
        <Modal onClose={() => setShowPrivacy(false)} title={t('settings.privacyPolicy')} closeLabel={t('settings.closeAria')}>
          <p className="text-sm text-forest-900/70 leading-relaxed">{t('settings.privacyText')}</p>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose, closeLabel }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-float"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-forest-950 text-lg">{title}</h2>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="w-8 h-8 rounded-xl bg-cloud-50 flex items-center justify-center text-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-200"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}
