import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, Shield, KeyRound, Loader2, RefreshCw, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTopBar from '../AdminTopBar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { changeAdminPassword, getAdminAuditLogs } from '../../services/api.js'

export default function Settings() {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()
  const { user } = useAuth()

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  async function loadAuditLogs() {
    setLoadingLogs(true)
    try {
      const res = await getAdminAuditLogs({ limit: 50 })
      setAuditLogs(res.data)
    } catch {
      // Non-blocking error for audit logs
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    loadAuditLogs()
  }, [])

  async function handlePasswordChange(e) {
    e.preventDefault()
    if (!currentPassword) {
      toast.error(t('admin.settings.errCurrentRequired', 'Current password is required'))
      return
    }
    if (newPassword.length < 8) {
      toast.error(t('admin.settings.errPassLength', 'New password must be at least 8 characters long'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('admin.settings.errPassMismatch', 'New passwords do not match'))
      return
    }

    setChangingPass(true)
    try {
      await changeAdminPassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      })
      toast.success(t('admin.settings.passSuccess', 'Password updated successfully'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      loadAuditLogs() // Refresh audit logs to show password change event
    } catch (err) {
      const msg = err.response?.data?.detail || t('admin.settings.passError', 'Failed to update password')
      toast.error(msg)
    } finally {
      setChangingPass(false)
    }
  }

  return (
    <div>
      <AdminTopBar title={t('admin.settings.title', 'Admin Settings & Security')} onMenuClick={openSidebar} />
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Profile Card */}
          <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center font-bold">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-forest-950 text-base">
                    {t('admin.settings.accountTitle', 'Administrator Account')}
                  </h3>
                  <p className="text-xs text-forest-900/50">
                    {t('admin.settings.accountSubtitle', 'Current active administrative session')}
                  </p>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 py-1 border-b border-cloud-100">
                  <dt className="text-forest-900/50">{t('admin.users.colName', 'Name')}</dt>
                  <dd className="text-forest-950 font-medium">{user?.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-1 border-b border-cloud-100">
                  <dt className="text-forest-900/50">{t('admin.users.colMobile', 'Mobile')}</dt>
                  <dd className="text-forest-950 font-medium font-mono text-xs">{user?.mobile}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-1 border-b border-cloud-100">
                  <dt className="text-forest-900/50">{t('admin.sidebar.role', 'Role')}</dt>
                  <dd className="text-forest-950 font-medium capitalize">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-forest-100 text-forest-800">
                      {user?.role}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <p className="text-xs text-forest-900/40 mt-5 pt-3 border-t border-cloud-100">
              {t('admin.settings.securityNotice', 'All administrative modifications and data views are recorded in the immutable audit log.')}
            </p>
          </div>

          {/* Secure Password Change Card */}
          <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-forest-950 text-base">
                  {t('admin.settings.changePassTitle', 'Change Admin Password')}
                </h3>
                <p className="text-xs text-forest-900/50">
                  {t('admin.settings.changePassSubtitle', 'Securely update your administrator credentials')}
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-forest-900/70 block mb-1">
                  {t('admin.settings.currentPassword', 'Current Password')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-forest-900/70 block mb-1">
                  {t('admin.settings.newPassword', 'New Password (min 8 characters)')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-forest-900/70 block mb-1">
                  {t('admin.settings.confirmNewPassword', 'Confirm New Password')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={changingPass || !currentPassword || !newPassword || !confirmPassword}
                className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-forest-700 hover:bg-forest-800 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {changingPass ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('admin.settings.updating', 'Updating...')}
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    {t('admin.settings.submitPassword', 'Update Password')}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Administrative Audit Trail */}
        <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cloud-100 text-forest-800 flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-forest-950 text-base">
                  {t('admin.settings.auditTitle', 'Administrative Audit Log')}
                </h3>
                <p className="text-xs text-forest-900/50">
                  {t('admin.settings.auditSubtitle', 'Immutable record of recent administrative interventions & privacy accesses')}
                </p>
              </div>
            </div>

            <button
              onClick={loadAuditLogs}
              disabled={loadingLogs}
              className="p-2 rounded-xl text-forest-600 hover:bg-cloud-100"
              title={t('common.refresh', 'Refresh')}
            >
              <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingLogs ? (
            <div className="space-y-2 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-cloud-100 animate-pulse" />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-forest-900/50 py-4 text-center">
              {t('admin.settings.noAuditLogs', 'No audit logs recorded yet')}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-forest-900/50 border-b border-cloud-200 sticky top-0 bg-white">
                    <th className="py-2.5 px-3 font-semibold">{t('admin.settings.colTime', 'Timestamp')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.settings.colAction', 'Action')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.settings.colTarget', 'Target')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.settings.colDetails', 'Details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-cloud-100 last:border-0 hover:bg-cloud-50/70">
                      <td className="py-2.5 px-3 text-forest-900/60 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-cloud-100 text-forest-900">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-forest-900/80 whitespace-nowrap">
                        {log.target_type} {log.target_id ? `(#${log.target_id})` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-forest-900/70 max-w-sm truncate" title={log.details}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
