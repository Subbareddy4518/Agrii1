import { useEffect, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Eye, Ban, CheckCircle, ShieldCheck, Users as UsersIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTopBar from '../AdminTopBar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Pagination from '../components/Pagination.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Drawer from '../components/Drawer.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { getAdminUsers, setAdminUserStatus, revealAdminUserMobile } from '../../services/api.js'

const PAGE_SIZE = 10

/**
 * fixedRole: 'farmer' | 'industry' | undefined (undefined = all users, with a role filter)
 */
export default function UsersTable({ fixedRole, titleKey }) {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null) // { user, nextStatus }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (fixedRole) params.role = fixedRole
      else if (roleFilter) params.role = roleFilter
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      const res = await getAdminUsers(params)
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error(t('admin.users.loadError'))
    } finally {
      setLoading(false)
    }
  }, [page, roleFilter, statusFilter, search, fixedRole, t])

  useEffect(() => { load() }, [load])

  useEffect(() => { setPage(1) }, [search, roleFilter, statusFilter])

  async function confirmStatusChange() {
    if (!confirmTarget) return
    setBusy(true)
    try {
      await setAdminUserStatus(confirmTarget.user.id, confirmTarget.nextStatus)
      toast.success(
        confirmTarget.nextStatus === 'suspended'
          ? t('admin.users.suspendSuccess')
          : t('admin.users.activateSuccess')
      )
      setConfirmTarget(null)
      load()
    } catch {
      toast.error(t('admin.users.actionError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRevealMobile(userId) {
    try {
      const res = await revealAdminUserMobile(userId)
      const fullMobile = res.data.mobile
      setItems((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, mobile: fullMobile, isUnmasked: true } : u))
      )
      if (selected && selected.id === userId) {
        setSelected((prev) => ({ ...prev, mobile: fullMobile, isUnmasked: true }))
      }
      toast.success(t('admin.users.mobileRevealed', 'Mobile number revealed and logged to audit trail'))
    } catch {
      toast.error(t('admin.users.revealError', 'Failed to reveal mobile number'))
    }
  }

  return (
    <div>
      <AdminTopBar title={t(titleKey)} onMenuClick={openSidebar} />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-cloud-200 shadow-card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-cloud-200 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.users.search')}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none text-sm transition-all"
              />
            </div>
            {!fixedRole && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 text-sm outline-none"
              >
                <option value="">{t('admin.users.allRoles')}</option>
                <option value="farmer">{t('admin.nav.farmers')}</option>
                <option value="industry">{t('admin.nav.industries')}</option>
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 text-sm outline-none"
            >
              <option value="">{t('admin.users.allStatuses')}</option>
              <option value="active">{t('admin.status.active')}</option>
              <option value="suspended">{t('admin.status.suspended')}</option>
            </select>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-cloud-100 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={UsersIcon} title={t('admin.users.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-forest-900/50 border-b border-cloud-200">
                    <th className="px-4 sm:px-5 py-3 font-medium">{t('admin.users.colName')}</th>
                    {!fixedRole && <th className="px-4 py-3 font-medium">{t('admin.users.colRole')}</th>}
                    <th className="px-4 py-3 font-medium">{t('admin.users.colMobile')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.users.colTrust', 'Trust & Verification')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.users.colLocation')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.users.colRegistered')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.users.colStatus')}</th>
                    <th className="px-4 sm:px-5 py-3 font-medium text-right">{t('admin.users.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} className="border-b border-cloud-100 last:border-0 hover:bg-cloud-50/60">
                      <td className="px-4 sm:px-5 py-3 font-medium text-forest-950">{u.name}</td>
                      {!fixedRole && (
                        <td className="px-4 py-3 capitalize text-forest-900/70">{u.role}</td>
                      )}
                      <td className="px-4 py-3 text-forest-900/70 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span>{u.mobile}</span>
                          {!u.isUnmasked && (
                            <button
                              onClick={() => handleRevealMobile(u.id)}
                              title={t('admin.users.revealPhone', 'Reveal full mobile number (logged to audit)')}
                              className="p-1 rounded text-forest-600 hover:bg-forest-50 hover:text-forest-800 transition-colors"
                            >
                              <Eye size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {u.is_verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle size={11} />
                              {t('admin.users.phoneVerified', 'Phone Verified')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cloud-100 text-forest-900/60">
                              {t('admin.users.phoneUnverified', 'Unverified Phone')}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            ★ {u.trust_score || 100}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-forest-900/70">{u.location || t('common.notSet')}</td>
                      <td className="px-4 py-3 text-forest-900/70 whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 sm:px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelected(u)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-forest-700 hover:bg-forest-50"
                            aria-label={t('admin.users.view')}
                          >
                            <Eye size={16} />
                          </button>
                          {u.status === 'active' ? (
                            <button
                              onClick={() => setConfirmTarget({ user: u, nextStatus: 'suspended' })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                              aria-label={t('admin.users.suspend')}
                            >
                              <Ban size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmTarget({ user: u, nextStatus: 'active' })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-forest-700 hover:bg-forest-50"
                              aria-label={t('admin.users.activate')}
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
        </div>
      </div>

      <Drawer open={!!selected} title={t('admin.users.details')} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-700 flex items-center justify-center font-semibold text-lg shrink-0">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-forest-950">{selected.name}</p>
                <p className="text-xs text-forest-900/50 capitalize">{selected.role}</p>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              {selected.contact_person && (
                <Row label={t('admin.industries.colContact')} value={selected.contact_person} />
              )}
              <Row
                label={t('admin.users.colMobile')}
                value={
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>{selected.mobile}</span>
                    {!selected.isUnmasked && (
                      <button
                        onClick={() => handleRevealMobile(selected.id)}
                        title={t('admin.users.revealPhone', 'Reveal full mobile number')}
                        className="p-1 rounded text-forest-600 hover:bg-forest-50"
                      >
                        <Eye size={13} />
                      </button>
                    )}
                  </div>
                }
              />
              <Row
                label={t('admin.users.colTrust', 'Trust & Verification')}
                value={
                  <div className="flex items-center gap-1.5 justify-end">
                    {selected.is_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle size={12} />
                        {t('admin.users.phoneVerified', 'Phone Verified')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cloud-100 text-forest-900/60">
                        {t('admin.users.phoneUnverified', 'Unverified Phone')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      ★ {selected.trust_score || 100}
                    </span>
                  </div>
                }
              />
              <Row label={t('admin.users.colLocation')} value={selected.location || t('common.notSet')} />
              <Row label={t('admin.users.colRegistered')} value={new Date(selected.created_at).toLocaleString()} />
              <Row label={t('admin.posts.colOwnerPosts')} value={selected.posts_count} />
              <Row label={t('admin.users.colStatus')} value={<StatusBadge status={selected.status} />} />
            </dl>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirmTarget}
        title={
          confirmTarget?.nextStatus === 'suspended'
            ? t('admin.users.suspendTitle')
            : t('admin.users.activateTitle')
        }
        message={
          confirmTarget?.nextStatus === 'suspended'
            ? t('admin.users.suspendConfirm', { name: confirmTarget?.user.name })
            : t('admin.users.activateConfirm', { name: confirmTarget?.user.name })
        }
        confirmLabel={
          confirmTarget?.nextStatus === 'suspended' ? t('admin.users.suspend') : t('admin.users.activate')
        }
        danger={confirmTarget?.nextStatus === 'suspended'}
        loading={busy}
        onConfirm={confirmStatusChange}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-forest-900/50">{label}</dt>
      <dd className="text-forest-950 font-medium text-right">{value}</dd>
    </div>
  )
}
