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
  stopSpeaking()
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

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel()
    } catch {}
  }
}

/**
 * Speak a phrase using the browser's built-in SpeechSynthesis API.
 * Supports both string lang and options object { lang, onEnd, onStart, rate, pitch }.
 */
export function speak(text, optionsOrLang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel() // avoid overlapping utterances
    const utterance = new SpeechSynthesisUtterance(text)
    
    let lang = null
    let onEnd = null
    let onStart = null
    let rate = 0.95
    let pitch = 1

    if (typeof optionsOrLang === 'string') {
      lang = optionsOrLang
    } else if (optionsOrLang && typeof optionsOrLang === 'object') {
      lang = optionsOrLang.lang
      onEnd = optionsOrLang.onEnd
      onStart = optionsOrLang.onStart
      if (optionsOrLang.rate) rate = optionsOrLang.rate
      if (optionsOrLang.pitch) pitch = optionsOrLang.pitch
    }

    utterance.lang = lang || SPEECH_LANG_MAP[getSelectedLanguage()] || SPEECH_LANG_MAP[DEFAULT_LANGUAGE]
    utterance.rate = rate
    utterance.pitch = pitch

    if (onStart) utterance.onstart = onStart
    if (onEnd) {
      utterance.onend = onEnd
      utterance.onerror = (e) => onEnd(e)
    }

    window.speechSynthesis.speak(utterance)
  } catch {
    /* speech synthesis not available - fail silently */
  }
}
