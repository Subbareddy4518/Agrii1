import { NavLink } from 'react-router-dom'
import { Home, Sparkles, PlusCircle, Bell, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'

export default function BottomNav({ unreadCount = 0 }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isFarmer = user?.role === 'farmer'

  const items = [
    {
      to: '/',
      labelKey: 'nav.home',
      icon: Home,
      iconColor: '#1E5E3A',
      activeBg: 'bg-[#1E5E3A]',
      inactiveBg: 'bg-[#E8EFE8]',
      textColor: 'text-[#1E5E3A]',
    },
    {
      to: '/matches',
      labelKey: 'nav.matches',
      icon: Sparkles,
      iconColor: '#D9822B',
      activeBg: 'bg-[#D9822B]',
      inactiveBg: 'bg-[#FEF3C7]',
      textColor: 'text-[#D9822B]',
    },
    {
      to: '/post',
      labelKey: isFarmer ? 'nav.post' : 'nav.postRequirement',
      icon: PlusCircle,
      isPrimary: true,
    },
    {
      to: '/notifications',
      labelKey: 'nav.alerts',
      icon: Bell,
      iconColor: '#EA580C',
      activeBg: 'bg-[#EA580C]',
      inactiveBg: 'bg-[#FFEDD5]',
      textColor: 'text-[#EA580C]',
    },
    {
      to: '/profile',
      labelKey: 'nav.profile',
      icon: User,
      iconColor: '#0D9488',
      activeBg: 'bg-[#0D9488]',
      inactiveBg: 'bg-[#CCFBF1]',
      textColor: 'text-[#0D9488]',
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 pointer-events-none"
      aria-label={t('nav.home', 'Navigation')}
    >
      <div className="pointer-events-auto flex items-center justify-between gap-1 bg-white/95 backdrop-blur-md border border-[#C8D9CE] shadow-float rounded-3xl px-2 py-1.5 w-full max-w-md">
        {items.map(({ to, labelKey, icon: Icon, isPrimary, activeBg, inactiveBg, textColor }) => {
          const label = t(labelKey, labelKey.split('.')[1])

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                isPrimary
                  ? `relative flex-1 min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 shadow-md ${
                      isActive
                        ? 'bg-gradient-to-tr from-[#D9822B] to-[#C47120] text-white border-2 border-white'
                        : 'bg-gradient-to-tr from-[#16472C] to-[#1E5E3A] hover:from-[#1E5E3A] hover:to-[#16472C] text-white border-2 border-white'
                    }`
                  : `relative flex-1 min-h-[48px] min-w-[48px] flex flex-col items-center justify-center gap-1 py-1 px-0.5 rounded-2xl text-[11px] transition-all active:scale-95 ${
                      isActive
                        ? 'bg-[#E8EFE8] font-extrabold text-[#16472C]'
                        : 'text-gray-600 font-bold hover:bg-gray-50'
                    }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex items-center justify-center">
                    {isPrimary ? (
                      <Icon
                        size={24}
                        strokeWidth={2.5}
                        className="text-white drop-shadow-xs"
                        aria-hidden="true"
                      />
                    ) : (
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform ${
                          isActive
                            ? `${activeBg} text-white shadow-xs scale-105`
                            : `${inactiveBg} ${textColor}`
                        }`}
                      >
                        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                      </div>
                    )}

                    {to === '/notifications' && unreadCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2 bg-[#D9822B] text-white text-[10px] font-black leading-none rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-white shadow-xs"
                        aria-label={`${unreadCount} unread notifications`}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>

                  <span
                    className={`line-clamp-1 text-center w-full px-0.5 text-[10px] sm:text-[11px] leading-tight ${
                      isPrimary
                        ? 'text-white font-black'
                        : isActive
                        ? 'text-[#16472C] font-black'
                        : 'text-gray-600 font-bold'
                    }`}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
