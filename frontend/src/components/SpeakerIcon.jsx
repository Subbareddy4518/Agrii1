import { Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { speak } from '../utils/onboarding.js'

/**
 * Small reusable "read aloud" button.
 *
 * Usage:
 *   <SpeakerIcon text="Enter the crop quantity here." label="Read quantity help aloud" />
 *
 * Uses only the browser's built-in SpeechSynthesis API — no AI service,
 * no external API, no network call. Pass `lang` (e.g. 'te-IN') to speak
 * `text` in a specific language regardless of the app's current
 * language — used on the language-selection screen so each option can
 * be read aloud in its own language before it's chosen. Omitted, it
 * defaults to the app's current language.
 */
export default function SpeakerIcon({ text, lang, label, size = 15, className = '' }) {
  const { t } = useTranslation()
  if (!text) return null

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    speak(text, lang)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label || t('common.readAloudLabel', { text })}
      title={t('common.readAloud')}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-forest-600 hover:bg-forest-50 focus:outline-none focus:ring-2 focus:ring-forest-200 active:scale-90 transition-all ${className}`}
    >
      <Volume2 size={size} />
    </button>
  )
}
