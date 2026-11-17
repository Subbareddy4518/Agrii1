import { useEffect, useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Eye, XCircle, RotateCcw, Trash2, FileText, Sprout, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminTopBar from '../AdminTopBar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Pagination from '../components/Pagination.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Drawer from '../components/Drawer.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { getAdminPosts, setAdminPostStatus, deleteAdminPost } from '../../services/api.js'

const PAGE_SIZE = 10

export default function Posts() {
  const { openSidebar } = useOutletContext()
  const { t } = useTranslation()

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { post, action: 'close'|'reopen'|'delete' }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (typeFilter) params.type = typeFilter
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      const res = await getAdminPosts(params)
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      toast.error(t('admin.posts.loadError'))
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, statusFilter, search, t])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, typeFilter, statusFilter])

  async function runConfirmedAction() {
    if (!confirmAction) return
    setBusy(true)
    try {
      if (confirmAction.action === 'delete') {
        await deleteAdminPost(confirmAction.post.id, false)
        toast.success(t('admin.posts.archiveSuccess', 'Listing safely archived (recoverable)'))
      } else if (confirmAction.action === 'close') {
        await setAdminPostStatus(confirmAction.post.id, 'closed')
        toast.success(t('admin.posts.closeSuccess'))
      } else {
        await setAdminPostStatus(confirmAction.post.id, 'active')
        toast.success(t('admin.posts.reopenSuccess'))
      }
      setConfirmAction(null)
      load()
    } catch {
      toast.error(t('admin.posts.actionError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <AdminTopBar title={t('admin.posts.title')} onMenuClick={openSidebar} />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-cloud-200 shadow-card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-cloud-200 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.posts.search')}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none text-sm transition-all"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 text-sm outline-none"
            >
              <option value="">{t('admin.posts.allTypes')}</option>
              <option value="farmer">{t('admin.posts.cropPost')}</option>
              <option value="industry">{t('admin.posts.requirementPost')}</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 text-sm outline-none"
            >
              <option value="">{t('admin.posts.allStatuses', 'All Statuses')}</option>
              <option value="active">{t('admin.status.active')}</option>
              <option value="paused">{t('admin.status.paused', 'Paused (Quarantined)')}</option>
              <option value="sold">{t('admin.status.sold', 'Sold')}</option>
              <option value="archived">{t('admin.status.archived', 'Archived')}</option>
              <option value="closed">{t('admin.status.closed')}</option>
            </select>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-cloud-100 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={FileText} title={t('admin.posts.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-forest-900/50 border-b border-cloud-200">
                    <th className="px-4 sm:px-5 py-3 font-medium">{t('admin.posts.colType')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.posts.colTitle')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.posts.colCrop')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.posts.colOwner')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.posts.colDate')}</th>
                    <th className="px-4 py-3 font-medium">{t('admin.users.colStatus')}</th>
                    <th className="px-4 sm:px-5 py-3 font-medium text-right">{t('admin.users.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b border-cloud-100 last:border-0 hover:bg-cloud-50/60">
                      <td className="px-4 sm:px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-900/70">
                          {p.role === 'farmer' ? <Sprout size={14} /> : <Building2 size={14} />}
                          {p.role === 'farmer' ? t('admin.posts.cropPost') : t('admin.posts.requirementPost')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-forest-950 max-w-[180px] truncate">{p.title}</td>
                      <td className="px-4 py-3 text-forest-900/70">{p.crop_name}</td>
                      <td className="px-4 py-3 text-forest-900/70">{p.owner?.name}</td>
                      <td className="px-4 py-3 text-forest-900/70">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 sm:px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelected(p)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-forest-700 hover:bg-forest-50"
                            aria-label={t('admin.users.view')}
                          >
                            <Eye size={16} />
                          </button>
                          {p.status === 'active' ? (
                            <button
                              onClick={() => setConfirmAction({ post: p, action: 'close' })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-harvest-600 hover:bg-harvest-400/10"
                              aria-label={t('admin.posts.close')}
                            >
                              <XCircle size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmAction({ post: p, action: 'reopen' })}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-forest-700 hover:bg-forest-50"
                              aria-label={t('admin.posts.reopen')}
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ post: p, action: 'delete' })}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                            aria-label={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
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

      <Drawer open={!!selected} title={t('admin.posts.details')} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            {selected.image && (
              <img src={selected.image} alt="" className="w-full h-40 object-cover rounded-xl" />
            )}
            <div>
              <p className="font-semibold text-forest-950">{selected.title}</p>
              <p className="text-xs text-forest-900/50">
                {selected.role === 'farmer' ? t('admin.posts.cropPost') : t('admin.posts.requirementPost')}
              </p>
            </div>
            {selected.description && (
              <p className="text-sm text-forest-900/70">{selected.description}</p>
            )}
            <dl className="space-y-3 text-sm">
              <Row label={t('admin.posts.colCrop')} value={selected.crop_name} />
              <Row label={t('admin.posts.colQuantity')} value={selected.quantity || t('common.notSet')} />
              <Row label={t('admin.posts.colPrice')} value={selected.price ?? t('common.notSet')} />
              <Row label={t('admin.users.colLocation')} value={selected.location || t('common.notSet')} />
              <Row label={t('admin.posts.colOwner')} value={selected.owner?.name} />
              <Row label={t('admin.posts.colDate')} value={new Date(selected.created_at).toLocaleString()} />
              <Row label={t('admin.users.colStatus')} value={<StatusBadge status={selected.status} />} />
            </dl>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction?.action === 'delete'
            ? t('admin.posts.archiveTitle', 'Safely Archive Listing')
            : confirmAction?.action === 'close'
              ? t('admin.posts.closeTitle')
              : t('admin.posts.reopenTitle')
        }
        message={
          confirmAction?.action === 'delete'
            ? t('admin.posts.archiveConfirm', 'Are you sure you want to archive this listing? It will be safely preserved and can be restored anytime by reopening.', { title: confirmAction?.post.title })
            : confirmAction?.action === 'close'
              ? t('admin.posts.closeConfirm', { title: confirmAction?.post.title })
              : t('admin.posts.reopenConfirm', { title: confirmAction?.post.title })
        }
        confirmLabel={
          confirmAction?.action === 'delete'
            ? t('admin.posts.archiveButton', 'Archive Listing')
            : confirmAction?.action === 'close'
              ? t('admin.posts.close')
              : t('admin.posts.reopen')
        }
        danger={confirmAction?.action !== 'reopen'}
        loading={busy}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
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
