import { useEffect, useState } from 'react'
import { Bell, Heart, Sprout, Building2, CheckCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api.js'
import { timeAgo } from '../utils/time.js'
import { translateNotificationTitle, translateNotificationMessage } from '../utils/translateNotification.js'

function iconFor(title = '') {
  if (title.toLowerCase().includes('interested')) return Heart
  if (title.toLowerCase().includes('crop')) return Sprout
  return Building2
}

export default function Notifications() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await getNotifications()
      setItems(res.data)
    } catch {
      toast.error(t('notifications.loadError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      toast.error(t('notifications.updateError'))
    }
  }

  async function handleOpen(n) {
    if (n.is_read) return
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)))
    try {
      await markNotificationRead(n.id)
    } catch {
      /* non-critical */
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen pb-28">
      <TopBar
        title={t('notifications.title')}
        subtitle={user?.role === 'farmer' ? t('notifications.subtitleFarmer') : t('notifications.subtitleIndustry')}
        showSearch={false}
      />

      <main className="max-w-md mx-auto px-4 pt-4">
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-xs font-medium text-forest-700 bg-forest-50 rounded-full px-3 py-1.5 mb-4 ml-auto float-right"
          >
            <CheckCheck size={13} /> {t('notifications.markAllRead')}
          </button>
        )}

        {loading ? (
          <div className="space-y-3 clear-both pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('notifications.empty.title')}
            message={t('notifications.empty.message')}
          />
        ) : (
          <div className="space-y-2.5 clear-both pt-2">
            {items.map((n) => {
              const Icon = iconFor(n.title)
              const title = translateNotificationTitle(t, n.title)
              const message = translateNotificationMessage(t, n.message)
              return (
                <button
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={`w-full flex items-start gap-3 text-left rounded-2xl p-3.5 border transition-colors animate-slide-up ${
                    n.is_read ? 'bg-white border-cloud-200' : 'bg-forest-50 border-forest-200'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      n.is_read ? 'bg-cloud-100 text-forest-900/40' : 'bg-forest-700 text-white'
                    }`}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.is_read ? 'font-medium text-forest-900/70' : 'font-semibold text-forest-950'}`}>
                      {title}
                    </p>
                    <p className="text-xs text-forest-900/50 mt-0.5 line-clamp-2">{message}</p>
                    <p className="text-[11px] text-forest-900/35 mt-1">{timeAgo(n.created_at, t)}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-harvest-500 mt-1.5 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
