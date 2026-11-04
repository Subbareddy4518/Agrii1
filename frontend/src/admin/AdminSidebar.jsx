import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Users, Sprout, Building2, FileText,
  BarChart3, Bell, Settings, LogOut, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const NAV_ITEMS = [
  { to: '/admin', end: true, icon: LayoutDashboard, labelKey: 'admin.nav.dashboard' },
  { to: '/admin/users', icon: Users, labelKey: 'admin.nav.users' },
  { to: '/admin/farmers', icon: Sprout, labelKey: 'admin.nav.farmers' },
  { to: '/admin/industries', icon: Building2, labelKey: 'admin.nav.industries' },
  { to: '/admin/posts', icon: FileText, labelKey: 'admin.nav.posts' },
  { to: '/admin/analytics', icon: BarChart3, labelKey: 'admin.nav.analytics' },
  { to: '/admin/notifications', icon: Bell, labelKey: 'admin.nav.notifications' },
  { to: '/admin/settings', icon: Settings, labelKey: 'admin.nav.settings' },
]

export default function AdminSidebar({ open, onClose }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 shrink-0 bg-forest-950 text-white flex flex-col z-50 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-forest-600 flex items-center justify-center shrink-0">
              <Sprout size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-sm leading-tight truncate">AgriConnect</p>
              <p className="text-[11px] text-forest-200/60 leading-tight">{t('admin.sidebar.tag')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-forest-200/70 hover:bg-white/10"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, end, icon: Icon, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-forest-600 text-white'
                    : 'text-forest-200/75 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-forest-600 flex items-center justify-center text-sm font-semibold shrink-0">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-[11px] text-forest-200/60 truncate">{t('admin.sidebar.role')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-200/75 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            {t('admin.nav.logout')}
          </button>
        </div>
      </aside>
    </>
  )
}
