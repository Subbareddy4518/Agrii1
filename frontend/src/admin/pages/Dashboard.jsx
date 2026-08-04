import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Users, Sprout, Building2, FileText, CheckCircle2, Bell,
} from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import AdminTopBar from '../AdminTopBar.jsx'
import StatCard from '../components/StatCard.jsx'
import { getAdminStats, getAdminAnalytics } from '../../services/api.js'

const PIE_COLORS = ['#158055', '#e8992b']

export default function Dashboard() {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [statsRes, analyticsRes] = await Promise.all([getAdminStats(), getAdminAnalytics()])
        if (!active) return
        setStats(statsRes.data)
        setAnalytics(analyticsRes.data)
      } catch {
        toast.error(t('admin.dashboard.loadError'))
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [t])

  return (
    <div>
      <AdminTopBar title={t('admin.dashboard.title')} onMenuClick={openSidebar} />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white border border-cloud-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
              <StatCard icon={Users} label={t('admin.dashboard.totalUsers')} value={stats.total_users} />
              <StatCard icon={Sprout} label={t('admin.dashboard.totalFarmers')} value={stats.total_farmers} />
              <StatCard icon={Building2} label={t('admin.dashboard.totalIndustries')} value={stats.total_industries} />
              <StatCard icon={FileText} label={t('admin.dashboard.totalPosts')} value={stats.total_posts} />
              <StatCard icon={CheckCircle2} label={t('admin.dashboard.activePosts')} value={stats.active_posts} tint="harvest" />
              <StatCard icon={Bell} label={t('admin.dashboard.recentActivity')} value={stats.recent_notifications} tint="slate" />
            </div>

            <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
              <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-4 sm:p-5">
                <h3 className="font-display font-semibold text-forest-950 mb-1">
                  {t('admin.dashboard.chartFarmersVsIndustries')}
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.farmers_vs_industries}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {analytics.farmers_vs_industries.map((entry, i) => (
                          <Cell key={entry.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-4 sm:p-5">
                <h3 className="font-display font-semibold text-forest-950 mb-1">
                  {t('admin.dashboard.chartActiveVsClosed')}
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.active_vs_closed}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e7e3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#158055" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-4 sm:p-5 lg:col-span-2">
                <h3 className="font-display font-semibold text-forest-950 mb-1">
                  {t('admin.dashboard.chartPostsOverTime')}
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.posts_over_time}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e7e3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={1} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#22a06a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-4 sm:p-5 lg:col-span-2">
                <h3 className="font-display font-semibold text-forest-950 mb-1">
                  {t('admin.dashboard.chartCropDistribution')}
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.crop_distribution} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e7e3" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#e8992b" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
