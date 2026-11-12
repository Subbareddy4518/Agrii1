import { NavLink } from 'react-router-dom'
import { Home, Sparkles, PlusCircle, Bell, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const items = [
  { to: '/', labelKey: 'nav.home', icon: Home },
  { to: '/matches', labelKey: 'nav.matches', icon: Sparkles },
  { to: '/post', labelKey: 'nav.post', icon: PlusCircle, isPrimary: true },
  { to: '/notifications', labelKey: 'nav.alerts', icon: Bell },
  { to: '/profile', labelKey: 'nav.profile', icon: User },
]

export default function BottomNav({ unreadCount = 0 }) {
  const { t } = useTranslation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-between gap-1 bg-white/95 backdrop-blur-md border border-cloud-200/90 shadow-float rounded-3xl px-1.5 py-1.5 w-full max-w-md">
        {items.map(({ to, labelKey, icon: Icon, isPrimary }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              isPrimary
                ? `relative flex-1 min-h-[48px] flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 ${
                    isActive
                      ? 'bg-harvest-500 text-white shadow-card'
                      : 'bg-forest-700 hover:bg-forest-800 text-white shadow-card'
                  }`
                : `relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 py-1.5 px-0.5 rounded-2xl text-[10px] sm:text-[11px] font-medium transition-all active:scale-95 ${
                    isActive
                      ? 'bg-forest-100 text-forest-900 font-bold'
                      : 'text-forest-900/60 hover:bg-forest-50'
                  }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon
                    size={isPrimary ? 24 : 20}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={isPrimary ? 'text-white' : ''}
                  />
                  {to === '/notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-harvest-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`line-clamp-1 text-center w-full px-0.5 ${isPrimary ? 'text-white font-bold' : ''}`}>
                  {t(labelKey, labelKey.split('.')[1])}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
