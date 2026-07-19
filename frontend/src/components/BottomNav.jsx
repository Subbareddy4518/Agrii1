import { NavLink } from 'react-router-dom'
import { Home, PlusCircle, Bell, User } from 'lucide-react'

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/post', label: 'Post', icon: PlusCircle },
  { to: '/notifications', label: 'Alerts', icon: Bell },
  { to: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav({ unreadCount = 0 }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur border border-cloud-200 shadow-float rounded-3xl px-2 py-2 w-full max-w-md">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl text-xs font-medium transition-colors ${
                isActive ? 'bg-forest-700 text-white' : 'text-forest-900/60 hover:bg-forest-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  {to === '/notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-harvest-500 text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
