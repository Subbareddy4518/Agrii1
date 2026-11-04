import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function AdminTopBar({ title, onMenuClick, actions }) {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-cloud-200">
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-forest-900 hover:bg-cloud-100 shrink-0"
            aria-label={t('admin.topbar.menu')}
          >
            <Menu size={20} />
          </button>
          <h1 className="font-display font-semibold text-forest-950 text-lg sm:text-xl truncate">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
