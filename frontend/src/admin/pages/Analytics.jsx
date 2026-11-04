import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'
import AdminTopBar from '../AdminTopBar.jsx'
import StatCard from '../components/StatCard.jsx'
import { getAdminStats, getAdminAnalytics } from '../../services/api.js'
import { Users, FileText, Heart, Bell } from 'lucide-react'

export default function Analytics() {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [s, a] = await Promise.all([getAdminStats(), getAdminAnalytics()])
        if (!active) return
        setStats(s.data)
        setAnalytics(a.data)
      } catch {
        toast.error(t('admin.analytics.loadError'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [t])

  return (
    <div>
      <AdminTopBar title={t('admin.analytics.title')} onMenuClick={openSidebar} />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white border border-cloud-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <StatCard icon={Users} label={t('admin.analytics.totalUsers')} value={stats.total_users} />
              <StatCard icon={FileText} label={t('admin.analytics.totalPosts')} value={stats.total_posts} />
              <StatCard icon={Heart} label={t('admin.analytics.interestedActions')} value={analytics.interested_actions_total} tint="harvest" />
              <StatCard icon={Bell} label={t('admin.analytics.notificationsTotal')} value={analytics.notifications_total} tint="slate" />
            </div>

            <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-4 sm:p-5">
              <h3 className="font-display font-semibold text-forest-950 mb-1">
                {t('admin.analytics.userGrowth')}
              </h3>
              <p className="text-xs text-forest-900/50 mb-4">{t('admin.analytics.userGrowthSubtitle')}</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.user_growth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e7e3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#0f6647" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
