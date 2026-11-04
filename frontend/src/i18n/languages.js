// Single source of truth for the languages this app offers, used by
// both the onboarding language picker (pages/LanguageSelect.jsx) and
// the in-app picker (pages/Settings.jsx). Keeping this in one place
// means adding/removing a language only ever requires editing here
// plus the three locale JSON files — not every screen that lists
// languages.
//
// code   = the i18next language code, persisted to localStorage
//          (en/te/hi only — never the display name).
// native = the language's own name in its own script, always shown
//          regardless of the app's currently active language, so a
//          person can recognize their language before selecting it.
// label  = the English name, shown as a secondary caption on the
//          onboarding picker.
export const LANGUAGES = [
  { code: 'en', native: 'English', label: 'English' },
  { code: 'te', native: 'తెలుగు', label: 'Telugu' },
  { code: 'hi', native: 'हिन्दी', label: 'Hindi' },
]
