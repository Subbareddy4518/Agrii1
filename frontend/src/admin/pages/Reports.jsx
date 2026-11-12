import { useEffect, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle, CheckCircle, XCircle, ShieldAlert,
  Eye, RefreshCw, Clock, Sprout, Building2, User
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTopBar from '../AdminTopBar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Drawer from '../components/Drawer.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { getAdminReports, resolveAdminReport } from '../../services/api.js'

export default function Reports() {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedReport, setSelectedReport] = useState(null)
  const [actionNotes, setActionNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAdminReports({ status: statusFilter === 'all' ? undefined : statusFilter })
      setReports(res.data)
    } catch {
      toast.error(t('admin.reports.loadError', 'Failed to load community reports'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, t])

  useEffect(() => {
    load()
  }, [load])

  async function handleResolve(action) {
    if (!selectedReport) return
    setBusy(true)
    try {
      await resolveAdminReport(selectedReport.id, {
        action,
        notes: actionNotes.trim() || undefined,
      })
      toast.success(t(`admin.reports.${action}Success`, 'Moderation decision saved successfully'))
      setSelectedReport(null)
      setActionNotes('')
      load()
    } catch {
      toast.error(t('admin.reports.actionError', 'Failed to record moderation decision'))
    } finally {
      setBusy(false)
    }
  }

  const pendingCount = reports.filter((r) => r.status === 'pending').length
  const quarantinedCount = reports.filter((r) => r.post_status === 'paused').length

  return (
    <div>
      <AdminTopBar
        title={t('admin.reports.title', 'Community Reports & Moderation')}
        onMenuClick={openSidebar}
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-forest-700 bg-white border border-cloud-200 rounded-xl hover:bg-cloud-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh', 'Refresh')}
          </button>
        }
      />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Metric summary banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-cloud-200 shadow-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-xs text-forest-900/50">{t('admin.reports.pendingCount', 'Pending Review')}</p>
              <p className="text-xl font-bold text-forest-950">{pendingCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-cloud-200 shadow-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-xs text-forest-900/50">{t('admin.reports.quarantinedCount', 'Quarantined Posts')}</p>
              <p className="text-xl font-bold text-forest-950">{quarantinedCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-cloud-200 shadow-card flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs text-forest-900/50">{t('admin.reports.totalReports', 'Total Recorded')}</p>
              <p className="text-xl font-bold text-forest-950">{reports.length}</p>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {['all', 'pending', 'resolved', 'dismissed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                  statusFilter === status
                    ? 'bg-forest-600 text-white'
                    : 'bg-cloud-100 text-forest-900/70 hover:bg-cloud-200'
                }`}
              >
                {t(`admin.reports.filter_${status}`, status)}
              </button>
            ))}
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-white rounded-2xl border border-cloud-200 shadow-card overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-cloud-100 animate-pulse" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('admin.reports.empty', 'No reports found matching your criteria')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-forest-900/50 border-b border-cloud-200">
                    <th className="px-4 sm:px-5 py-3 font-medium">{t('admin.reports.colPost', 'Listing')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.reports.colReason', 'Reason')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.reports.colOwner', 'Listing Owner')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.reports.colStatus', 'Status')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.reports.colDate', 'Date')}</th>
                    <th className="px-4 sm:px-5 py-3 font-medium text-right">{t('admin.users.colActions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-cloud-100 last:border-0 hover:bg-cloud-50/60">
                      <td className="px-4 sm:px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {r.post_role === 'industry' ? (
                            <Building2 size={16} className="text-harvest-600 shrink-0" />
                          ) : (
                            <Sprout size={16} className="text-forest-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-forest-950 truncate max-w-xs">{r.post_title || t('common.untitled', 'Untitled')}</p>
                            <p className="text-xs text-forest-900/50">
                              {r.post_crop_name} {r.post_report_count > 1 ? `• ${r.post_report_count} reports` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          {r.reason}
                        </span>
                        {r.details && (
                          <p className="text-xs text-forest-900/60 mt-0.5 truncate max-w-xs">{r.details}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-forest-950">{r.post_owner_name || t('common.unknown', 'Unknown')}</p>
                        <p className="text-xs text-forest-900/50">{r.post_location || t('common.notSet', 'Not set')}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3.5 text-forest-900/70 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedReport(r)
                            setActionNotes(r.resolution_notes || '')
                          }}
                          className="px-3 py-1.5 rounded-xl bg-forest-50 text-forest-700 hover:bg-forest-100 font-medium text-xs inline-flex items-center gap-1.5"
                        >
                          <Eye size={14} />
                          {t('admin.reports.reviewAction', 'Review')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review & Resolution Drawer */}
      <Drawer
        open={!!selectedReport}
        title={t('admin.reports.reviewTitle', 'Report Review & Decision')}
        onClose={() => setSelectedReport(null)}
      >
        {selectedReport && (
          <div className="space-y-5">
            {/* Report summary card */}
            <div className="p-4 rounded-xl bg-red-50/60 border border-red-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
                  {selectedReport.reason}
                </span>
                <span className="text-[11px] text-forest-900/50">
                  {new Date(selectedReport.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-forest-950 font-medium">
                {selectedReport.details || t('admin.reports.noDetails', 'No additional details provided by reporter.')}
              </p>
              <p className="text-xs text-forest-900/60">
                {t('admin.reports.reporter', 'Reported by')}: {selectedReport.reporter_name || `User #${selectedReport.reporter_id}`}
              </p>
            </div>

            {/* Target post details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-900/50">
                {t('admin.reports.targetListing', 'Reported Listing')}
              </h4>
              <div className="p-3.5 rounded-xl bg-cloud-50 border border-cloud-200 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-forest-950">{selectedReport.post_title}</span>
                  <StatusBadge status={selectedReport.post_status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-forest-900/70 pt-1">
                  <div>
                    <span className="text-forest-900/40">{t('admin.posts.colCrop', 'Crop')}: </span>
                    {selectedReport.post_crop_name}
                  </div>
                  <div>
                    <span className="text-forest-900/40">{t('admin.posts.colPrice', 'Price')}: </span>
                    ₹{selectedReport.post_price || 'N/A'}
                  </div>
                  <div>
                    <span className="text-forest-900/40">{t('admin.posts.colQuantity', 'Quantity')}: </span>
                    {selectedReport.post_quantity || 'N/A'}
                  </div>
                  <div>
                    <span className="text-forest-900/40">{t('admin.posts.colLocation', 'Location')}: </span>
                    {selectedReport.post_location || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Seller profile info */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-forest-900/50">
                {t('admin.reports.sellerInfo', 'Listing Author')}
              </h4>
              <div className="p-3 rounded-xl bg-cloud-50 border border-cloud-200 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-forest-600" />
                  <span className="font-medium text-forest-950">{selectedReport.post_owner_name}</span>
                </div>
                <span className="text-xs text-forest-900/50">{selectedReport.post_location}</span>
              </div>
            </div>

            {/* Moderation notes input */}
            <div className="space-y-2 pt-2 border-t border-cloud-200">
              <label className="text-xs font-semibold text-forest-950 block">
                {t('admin.reports.notesLabel', 'Moderation Notes (Logged to Audit Trail)')}
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={t('admin.reports.notesPlaceholder', 'Enter explanation or resolution reasoning...')}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none resize-none transition-all"
              />
            </div>

            {/* Controlled Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleResolve('dismiss')}
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-forest-50 hover:bg-forest-100 text-forest-700 border border-forest-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <CheckCircle size={16} />
                {t('admin.reports.actionDismiss', 'Dismiss False Report & Restore Listing')}
              </button>

              <button
                onClick={() => handleResolve('confirm_quarantine')}
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <AlertTriangle size={16} />
                {t('admin.reports.actionQuarantine', 'Confirm Violation & Keep Quarantined')}
              </button>

              <button
                onClick={() => handleResolve('close_post')}
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                {t('admin.reports.actionClose', 'Close Fraudulent / Inappropriate Listing')}
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
