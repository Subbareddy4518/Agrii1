import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Resources are bundled statically (three small JSON files — a few KB
// total) rather than fetched over HTTP. This keeps voice guidance and
// language switching instant with no network round-trip, and avoids
// adding an http backend + Suspense boundaries to a codebase that
// doesn't already use them. i18next still only initializes the
// translation instance once, and `useTranslation()` re-renders
// components on language change automatically — no manual wiring
// needed in the pages that consume it.
import en from '../locales/en/common.json'
import te from '../locales/te/common.json'
import hi from '../locales/hi/common.json'

export const SUPPORTED_LANGUAGES = ['en', 'te', 'hi']
export const DEFAULT_LANGUAGE = 'en'

const STORAGE_KEY = 'selectedLanguage'

// Speech-synthesis locale for each supported app language. Used by
// utils/onboarding.js `speak()` so voice guidance is read out in the
// correct accent/voice when available on the device.
export const SPEECH_LANG_MAP = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
}

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    te: { common: te },
    hi: { common: hi },
  },
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false, // React already escapes output
  },
  returnNull: false,
  react: {
    // Resources are provided synchronously above (no HTTP backend), so
    // there's never an async load to suspend for. Set explicitly rather
    // than relying on that being true forever — if an async backend is
    // ever introduced later, this should be revisited alongside adding
    // Suspense boundaries, not silently start throwing.
    useSuspense: false,
  },
})

function syncDocumentLanguage(lng) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lng
  }
}

// Keep localStorage (only 'en' | 'te' | 'hi' — never the display name),
// the <html lang> attribute (WCAG 3.1.1 — screen readers, spellcheck,
// and Telugu/Hindi font shaping all key off this), and the
// SpeechSynthesis language in sync with whatever changed i18n.language,
// regardless of which screen triggered the change.
i18n.on('languageChanged', (lng) => {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* localStorage unavailable (private mode / disabled) - non-critical */
  }
  syncDocumentLanguage(lng)
})

// Set it once up front too, so the very first paint (before any
// language change ever fires) already reflects the persisted language
// instead of the static "en" in index.html.
syncDocumentLanguage(i18n.language)

export default i18n
