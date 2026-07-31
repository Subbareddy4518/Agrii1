// Lightweight helpers around localStorage / sessionStorage for the
// onboarding flow (splash → welcome → language → voice) and for the
// browser SpeechSynthesis API used by <SpeakerIcon />.
//
// Nothing here touches the backend, AuthContext, or services/api.js —
// it is purely local device state as required by the spec.

import i18n, { SPEECH_LANG_MAP, DEFAULT_LANGUAGE } from '../i18n/index.js'

const KEYS = {
  WELCOME_SEEN: 'welcomeSeen',
  VOICE_ENABLED: 'voiceEnabled',
}

const SESSION_KEYS = {
  SPLASH_SHOWN: 'splashShown',
}

export function isWelcomeSeen() {
  return localStorage.getItem(KEYS.WELCOME_SEEN) === 'true'
}

export function markWelcomeSeen() {
  localStorage.setItem(KEYS.WELCOME_SEEN, 'true')
}

/**
 * Returns the active app language code: 'en' | 'te' | 'hi'.
 * Only these codes are ever persisted (never the display names
 * "English" / "Telugu" / "Hindi") — see src/i18n/index.js, which owns
 * the 'selectedLanguage' localStorage key and keeps it in sync with
 * i18next automatically.
 */
export function getSelectedLanguage() {
  return i18n.language || DEFAULT_LANGUAGE
}

/**
 * Switches the app language instantly (no refresh needed) and persists
 * the code via i18next's languageChanged listener.
 */
export function setSelectedLanguage(lang) {
  i18n.changeLanguage(lang)
}

export function isVoiceEnabled() {
  return localStorage.getItem(KEYS.VOICE_ENABLED) === 'true'
}

export function setVoiceEnabled(enabled) {
  localStorage.setItem(KEYS.VOICE_ENABLED, enabled ? 'true' : 'false')
}

export function hasSplashShownThisSession() {
  return sessionStorage.getItem(SESSION_KEYS.SPLASH_SHOWN) === 'true'
}

export function markSplashShown() {
  sessionStorage.setItem(SESSION_KEYS.SPLASH_SHOWN, 'true')
}

/**
 * Speak a short phrase using the browser's built-in SpeechSynthesis API.
 * No external AI service or network call is involved.
 *
 * The utterance language always follows the current app language
 * (English → en-US, Telugu → te-IN, Hindi → hi-IN) so the voice/accent
 * the browser picks matches whatever script is on screen. Pass an
 * explicit `lang` (e.g. when reading a language *option* aloud before
 * it has been selected) to override that default for a single call.
 */
export function speak(text, lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel() // avoid overlapping utterances
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang || SPEECH_LANG_MAP[getSelectedLanguage()] || SPEECH_LANG_MAP[DEFAULT_LANGUAGE]
    utterance.rate = 0.95
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  } catch {
    /* speech synthesis not available - fail silently */
  }
}
