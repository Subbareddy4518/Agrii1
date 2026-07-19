import { Search, Sprout } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TopBar({ title, subtitle, showSearch = true }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 bg-cloud-50/90 backdrop-blur border-b border-cloud-200">
      <div className="max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-forest-700 flex items-center justify-center shadow-card shrink-0">
            <Sprout size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-forest-950 leading-tight text-lg">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-forest-900/50 -mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {showSearch && (
          <button
            onClick={() => navigate('/search')}
            aria-label="Search"
            className="w-10 h-10 rounded-2xl bg-white border border-cloud-200 shadow-card flex items-center justify-center text-forest-800 active:scale-95 transition-transform"
          >
            <Search size={19} />
          </button>
        )}
      </div>
    </header>
  )
}
