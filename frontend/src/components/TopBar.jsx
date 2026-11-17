import { useState } from 'react'
import { Search, Sprout, Globe } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n/languages.js'
import { setSelectedLanguage, getSelectedLanguage } from '../utils/onboarding.js'

export default function TopBar({ title, subtitle, showSearch = true, onLogoClick }) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [showLangMenu, setShowLangMenu] = useState(false)
  const currentLang = getSelectedLanguage()

  const currentObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0]

  function handleSelectLang(code) {
    setSelectedLanguage(code)
    setShowLangMenu(false)
  }

  return (
    <header className="sticky top-0 z-30 bg-cloud-50/95 backdrop-blur-md border-b border-cloud-200/80">
      <div className="max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-2">
        <div
          onClick={onLogoClick || (() => navigate('/'))}
          className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-forest-700 to-forest-900 flex items-center justify-center shadow-card shrink-0 border border-forest-600/30">
            <Sprout size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-forest-950 leading-tight text-lg truncate">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-forest-900/60 -mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative">
          {/* Language Switcher Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu((s) => !s)}
              aria-label={t('common.changeLanguage', 'Change language')}
              className="min-h-[44px] h-11 px-3 rounded-2xl bg-white border border-cloud-200/80 shadow-card flex items-center gap-1.5 text-xs font-semibold text-forest-800 active:scale-95 transition-all min-w-[44px]"
            >
              <Globe size={16} className="text-forest-600 shrink-0" />
              <span>{currentObj.native}</span>
            </button>

            {showLangMenu && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/10 backdrop-blur-none"
                  onClick={() => setShowLangMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-float border border-cloud-200 overflow-hidden z-50 py-1 animate-pop-in">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleSelectLang(lang.code)}
                      className={`w-full text-left px-4 py-3 text-xs sm:text-sm flex items-center justify-between min-h-[44px] transition-colors ${
                        currentLang === lang.code
                          ? 'bg-forest-50 text-forest-800 font-bold'
                          : 'text-forest-950/80 hover:bg-cloud-50'
                      }`}
                    >
                      <span className="font-semibold">{lang.native}</span>
                      <span className="text-[11px] text-forest-900/50">{lang.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {showSearch && (
            <button
              onClick={() => navigate('/search')}
              aria-label={t('common.search')}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-white border border-cloud-200/80 shadow-card flex items-center justify-center text-forest-800 active:scale-95 transition-transform"
            >
              <Search size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
