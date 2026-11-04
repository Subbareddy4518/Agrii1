import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, Loader2, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTopBar from '../AdminTopBar.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { getAdminRecentNotifications, broadcastAdminNotification } from '../../services/api.js'

export default function Notifications() {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()

  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [audience, setAudience] = useState('all_farmers')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function loadRecent() {
    setLoading(true)
    try {
      const res = await getAdminRecentNotifications({ limit: 50 })
      setRecent(res.data)
    } catch {
      toast.error(t('admin.notifications.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRecent() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend(e) {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    setSending(true)
    try {
      const res = await broadcastAdminNotification({ audience, title: title.trim(), message: message.trim() })
      toast.success(t('admin.notifications.sendSuccess', { count: res.data.sent_count }))
      setTitle('')
      setMessage('')
      loadRecent()
    } catch {
      toast.error(t('admin.notifications.sendError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <AdminTopBar title={t('admin.notifications.title')} onMenuClick={openSidebar} />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto grid lg:grid-cols-5 gap-5">
        <form
          onSubmit={handleSend}
          className="lg:col-span-2 bg-white rounded-2xl border border-cloud-200 shadow-card p-5 h-fit"
        >
          <h3 className="font-display font-semibold text-forest-950 mb-4">
            {t('admin.notifications.broadcastTitle')}
          </h3>

          <label className="text-sm font-medium text-forest-950 mb-1.5 block">
            {t('admin.notifications.audience')}
          </label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full mb-4 px-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 text-sm outline-none"
          >
            <option value="all_farmers">{t('admin.notifications.allFarmers')}</option>
            <option value="all_industries">{t('admin.notifications.allIndustries')}</option>
          </select>

          <label className="text-sm font-medium text-forest-950 mb-1.5 block">
            {t('admin.notifications.notificationTitle')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('admin.notifications.titlePlaceholder')}
            className="w-full mb-4 px-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none text-sm transition-all"
          />

          <label className="text-sm font-medium text-forest-950 mb-1.5 block">
            {t('admin.notifications.message')}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('admin.notifications.messagePlaceholder')}
            rows={4}
            className="w-full mb-4 px-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none text-sm transition-all resize-none"
          />

          <button
            type="submit"
            disabled={sending || !title.trim() || !message.trim()}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
            {t('admin.notifications.send')}
          </button>
        </form>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-cloud-200 shadow-card overflow-hidden">
          <div className="p-5 border-b border-cloud-200">
            <h3 className="font-display font-semibold text-forest-950">
              {t('admin.notifications.recentActivity')}
            </h3>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-cloud-100 animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState icon={Bell} title={t('admin.notifications.empty')} />
          ) : (
            <div className="divide-y divide-cloud-100 max-h-[520px] overflow-y-auto">
              {recent.map((n) => (
                <div key={n.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-forest-950 text-sm">{n.title}</p>
                    <span className="text-xs text-forest-900/40 shrink-0">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-forest-900/60 mt-0.5">{n.message}</p>
                  {n.receiver_name && (
                    <p className="text-xs text-forest-900/40 mt-1">
                      {t('admin.notifications.to')}: {n.receiver_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
