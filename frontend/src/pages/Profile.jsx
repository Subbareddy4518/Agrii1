import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone,
  MapPin,
  Sprout,
  Building2,
  LogOut,
  Pencil,
  Loader2,
  Trash2,
  X,
  Check,
  Settings as SettingsIcon,
  Pause,
  Play,
  CheckCircle,
  RefreshCw,
  Archive,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getMyPosts, updateMe, deletePost, updatePostStatus } from '../services/api.js'
import { timeAgo } from '../utils/time.js'
import { translateCropName } from '../utils/i18nHelpers.js'

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isFarmer = user?.role === 'farmer'

  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    contact_person: user?.contact_person || '',
    location: user?.location || '',
    profile_image: user?.profile_image || null,
  })

  // Controlled Lifecycle State Management
  const [soldModalPost, setSoldModalPost] = useState(null)
  const [archiveModalPost, setArchiveModalPost] = useState(null)
  const [soldForm, setSoldForm] = useState({ sold_price: '', sold_quantity: '', notes: '' })
  const [statusUpdating, setStatusUpdating] = useState(false)

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPosts() {
    setLoadingPosts(true)
    try {
      const res = await getMyPosts()
      setPosts(res.data)
    } catch {
      toast.error(t('profile.toasts.loadError'))
    } finally {
      setLoadingPosts(false)
    }
  }

  function startEdit() {
    setForm({
      name: user?.name || '',
      contact_person: user?.contact_person || '',
      location: user?.location || '',
      profile_image: user?.profile_image || null,
    })
    setEditing(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error(t('profile.toasts.nameEmpty'))
    setSaving(true)
    try {
      await updateMe({
        name: form.name.trim(),
        contact_person: isFarmer ? null : form.contact_person.trim(),
        location: form.location.trim() || null,
        profile_image: form.profile_image,
      })
      await refreshUser()
      toast.success(t('profile.toasts.updated'))
      setEditing(false)
    } catch {
      toast.error(t('profile.toasts.updateError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePost(id) {
    if (!window.confirm(t('profile.confirmDelete'))) return
    try {
      await deletePost(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
      toast.success(t('profile.toasts.deleted'))
    } catch {
      toast.error(t('profile.toasts.deleteError'))
    }
  }

  async function handleStatusChange(postId, targetStatus, extraPayload = {}) {
    setStatusUpdating(true)
    try {
      const payload = { status: targetStatus, ...extraPayload }
      if (extraPayload.sold_price) {
        payload.sold_price = parseFloat(extraPayload.sold_price)
      }
      const res = await updatePostStatus(postId, payload)
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.data : p)))
      toast.success(
        t('listing.actions.statusChangeSuccess', {
          status: t(`listing.status.${targetStatus}`, targetStatus),
        })
      )
      setSoldModalPost(null)
      setSoldForm({ sold_price: '', sold_quantity: '', notes: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || t('listing.actions.statusChangeError'))
    } finally {
      setStatusUpdating(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen pb-28">
      <TopBar title={t('profile.title')} showSearch={false} />

      <main className="max-w-md mx-auto px-4 pt-4">
        {editing ? (
          <div className="bg-white rounded-3xl p-5 shadow-card border border-cloud-200/70 space-y-4 animate-pop-in">
            <div className="flex justify-center">
              <ImagePicker
                circular
                value={form.profile_image}
                onChange={(url) => setForm((f) => ({ ...f, profile_image: url }))}
                label={t('profile.changePhoto')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-forest-950 mb-1.5 block">
                {isFarmer ? t('profile.fullNameLabel') : t('profile.companyNameLabel')}
              </label>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            {!isFarmer && (
              <div>
                <label className="text-sm font-medium text-forest-950 mb-1.5 block">
                  {t('profile.contactPersonLabel')}
                </label>
                <input
                  className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-forest-950 mb-1.5 block">
                {isFarmer ? t('profile.villageDistrictLabel') : t('profile.locationLabel')}
              </label>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-3.5 rounded-2xl border border-cloud-200 text-forest-900/70 font-semibold active:scale-95 transition-all"
              >
                <X size={16} /> {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-forest-700 text-white font-semibold disabled:opacity-70 active:scale-95 transition-all shadow-sm"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {t('common.save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-5 shadow-card border border-cloud-200/70 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center overflow-hidden shrink-0">
                {user?.profile_image ? (
                  <img src={user.profile_image} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-forest-700 font-semibold text-lg">{initials(user?.name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-display font-semibold text-forest-950 text-lg truncate">{user?.name}</p>
                  {isFarmer ? (
                    <Sprout size={15} className="text-forest-600 shrink-0" />
                  ) : (
                    <Building2 size={15} className="text-forest-600 shrink-0" />
                  )}
                  {/* Trust Verification Badge - Strictly conditional on actual database state */}
                  {user?.is_verified ? (
                    <span className="text-[10px] bg-forest-100 text-forest-800 font-bold px-2 py-0.5 rounded-full border border-forest-200">
                      ✓ {isFarmer ? t('postCard.verifiedFarmer', 'Verified Farmer') : t('postCard.verifiedIndustry', 'Verified Industry')}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-cloud-100 text-forest-900/60 font-medium px-2 py-0.5 rounded-full border border-cloud-200">
                      {t('profile.unverified', 'Verification Pending')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs font-medium text-forest-900/40 uppercase tracking-wide">
                    {isFarmer ? t('profile.farmerRole') : t('profile.industryRole')}
                  </p>
                  {/* Genuine Trust Score from Backend */}
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                    🛡️ {t('profile.trustScore', 'Trust Score')}: {user?.trust_score ?? 100}%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate('/settings')}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-cloud-50 border border-cloud-200 flex items-center justify-center text-forest-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-forest-200"
                  aria-label={t('profile.settingsAria')}
                >
                  <SettingsIcon size={16} />
                </button>
                <button
                  onClick={startEdit}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-2xl bg-cloud-50 border border-cloud-200 flex items-center justify-center text-forest-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-forest-200"
                  aria-label={t('profile.editAria')}
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-cloud-100">
              <div className="flex items-center gap-2 text-sm text-forest-900/70">
                <Phone size={15} className="text-forest-500 shrink-0" />
                <span className="truncate">{user?.mobile}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-forest-900/70">
                <MapPin size={15} className="text-forest-500 shrink-0" />
                <span className="truncate">{user?.location || t('common.notSet')}</span>
              </div>
            </div>

            {!isFarmer && user?.contact_person && (
              <p className="text-sm text-forest-900/50 mt-3">{t('profile.contactPrefix', { name: user.contact_person })}</p>
            )}

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-cloud-100">
              <p className="text-sm text-forest-900/50">
                {t('profile.postsCount', { count: posts.length })}
              </p>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                <LogOut size={15} /> {t('profile.logout')}
              </button>
            </div>
          </div>
        )}

        <h2 className="font-display font-semibold text-forest-950 mt-7 mb-3">{t('profile.yourPosts')}</h2>

        {loadingPosts ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl skeleton" />
            <div className="h-20 rounded-2xl skeleton" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={isFarmer ? Sprout : Building2}
            title={t('profile.emptyPosts.title')}
            message={isFarmer ? t('profile.emptyPosts.farmerMessage') : t('profile.emptyPosts.industryMessage')}
          />
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const postStatus = (post.status || 'active').toLowerCase()
              const isSold = postStatus === 'sold'
              const isPaused = postStatus === 'paused'
              const isDraft = postStatus === 'draft'
              const isArchived = postStatus === 'archived'

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-2xl p-3.5 border border-cloud-200/70 shadow-card space-y-2.5 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-cloud-100 overflow-hidden shrink-0 border border-cloud-200">
                      {post.image ? (
                        <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-forest-700 text-lg">🌾</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-forest-950 text-sm truncate">{post.title}</p>
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isSold
                              ? 'bg-cloud-200 text-forest-900/70'
                              : isPaused
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isDraft
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : isArchived
                              ? 'bg-stone-200 text-stone-700 border border-stone-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {t(`listing.status.${postStatus}`, postStatus)}
                        </span>
                        {/* Negotiation Status Badge if active */}
                        {post.negotiation_status && post.negotiation_status !== 'none' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            🤝 {t(`listing.negotiation.${post.negotiation_status}`, post.negotiation_status)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-forest-900/60 mt-0.5">
                        {translateCropName(t, post.crop_name)} &middot; {timeAgo(post.created_at, t)}
                        {post.price != null && <span className="font-semibold text-forest-900"> &middot; ₹{post.price}</span>}
                        {post.quantity && <span> &middot; {post.quantity}</span>}
                      </p>
                      {post.sold_price != null && (
                        <p className="text-[11px] font-semibold text-harvest-700 mt-0.5">
                          ✓ Sold for ₹{post.sold_price} {post.sold_quantity ? `(${post.sold_quantity})` : ''}
                        </p>
                      )}
                      <p className="text-xs text-forest-900/40 mt-0.5">
                        {t('profile.interestedCount', { count: post.likes_count })}
                      </p>
                    </div>
                  </div>

                  {/* Lifecycle Controls Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-cloud-100 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Active -> Mark Sold or Pause */}
                      {postStatus === 'active' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSoldModalPost(post)
                              setSoldForm({
                                sold_price: post.price ? String(post.price) : '',
                                sold_quantity: post.quantity || '',
                                notes: '',
                              })
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all"
                          >
                            <CheckCircle size={13} /> {t('listing.actions.markSold', 'Mark Sold')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(post.id, 'paused')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all"
                          >
                            <Pause size={12} /> {t('listing.actions.pause', 'Pause')}
                          </button>
                        </>
                      )}

                      {/* Paused -> Resume or Mark Sold */}
                      {isPaused && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(post.id, 'active')}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all"
                          >
                            <Play size={12} /> {t('listing.actions.resume', 'Resume')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSoldModalPost(post)
                              setSoldForm({
                                sold_price: post.price ? String(post.price) : '',
                                sold_quantity: post.quantity || '',
                                notes: '',
                              })
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cloud-100 text-forest-800 font-semibold text-xs hover:bg-cloud-200 active:scale-95 transition-all min-h-[38px]"
                          >
                            <CheckCircle size={14} /> {t('listing.actions.markSold', 'Mark Sold')}
                          </button>
                        </>
                      )}

                      {/* Sold -> Option to Relist if deal fell through */}
                      {isSold && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(post.id, 'active')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cloud-100 text-forest-800 font-semibold text-xs hover:bg-cloud-200 active:scale-95 transition-all min-h-[38px]"
                        >
                          <RefreshCw size={13} /> {t('listing.actions.relist', 'Re-list')}
                        </button>
                      )}

                      {/* Archived -> Restore to Active */}
                      {isArchived && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(post.id, 'active', { notes: 'Restored from archive' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-700 text-white font-semibold text-xs hover:bg-forest-800 active:scale-95 transition-all min-h-[38px]"
                        >
                          <RotateCcw size={13} /> {t('listing.actions.restore', 'Restore to Active')}
                        </button>
                      )}

                      {/* Draft -> Publish */}
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(post.id, 'active')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-700 text-white font-semibold text-xs hover:bg-forest-800 active:scale-95 transition-all min-h-[38px]"
                        >
                          <Play size={13} /> {t('listing.actions.publish', 'Publish')}
                        </button>
                      )}
                    </div>

                    {/* Safe Archive for farmers; Admin-only hard delete */}
                    {!isArchived ? (
                      <button
                        type="button"
                        onClick={() => setArchiveModalPost(post)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 font-semibold text-xs active:scale-95 transition-all min-h-[38px]"
                        aria-label={t('listing.actions.archive', 'Archive')}
                      >
                        <Archive size={14} /> {t('listing.actions.archive', 'Archive')}
                      </button>
                    ) : user?.role === 'admin' ? (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors"
                        aria-label={t('profile.deleteAria')}
                        title={t('common.delete', 'Delete')}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Safe Archiving Confirmation Modal */}
      {archiveModalPost && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-float border border-cloud-200 space-y-4 animate-pop-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                  <Archive size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-forest-950 text-base">
                    {t('listing.archiveModal.title', 'Archive Crop Listing')}
                  </h3>
                  <p className="text-xs text-forest-900/60 font-medium">
                    {archiveModalPost.crop_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setArchiveModalPost(null)}
                className="text-forest-900/40 hover:text-forest-900 p-1"
                aria-label={t('common.close', 'Close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 text-xs text-stone-800 space-y-2">
              <p className="font-semibold text-forest-950">
                {t('listing.archiveModal.subtitle', 'Safe archiving protects your records while hiding the listing from active buyers.')}
              </p>
              <p className="text-forest-900/70 leading-relaxed">
                {t('listing.archiveModal.description', 'This listing will be hidden from buyer search and AI matching, but all details and transaction history remain safely saved. You can restore it to active anytime.')}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setArchiveModalPost(null)}
                className="flex-1 min-h-[44px] py-3 rounded-xl border border-cloud-200 text-forest-900/70 text-xs font-semibold hover:bg-cloud-100 active:scale-95 transition-all"
              >
                {t('listing.archiveModal.cancel', 'Keep Active')}
              </button>
              <button
                type="button"
                disabled={statusUpdating}
                onClick={async () => {
                  const targetId = archiveModalPost.id
                  setArchiveModalPost(null)
                  await handleStatusChange(targetId, 'archived', { notes: 'Archived by owner via profile' })
                }}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {statusUpdating ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                {t('listing.archiveModal.confirm', 'Archive Listing')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Sold Modal */}
      {soldModalPost && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-float border border-cloud-200 space-y-4 animate-pop-in">
            <div>
              <h3 className="font-display font-bold text-forest-950 text-lg">
                {t('listing.markSoldModal.title', 'Mark Crop as Sold')}
              </h3>
              <p className="text-xs text-forest-900/60 mt-1">
                {t('listing.markSoldModal.subtitle', 'Record the final deal terms to update your marketplace inventory.')}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-forest-900 block mb-1">
                  {t('listing.markSoldModal.soldPrice', 'Final Selling Price (₹ per unit)')}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={soldForm.sold_price}
                  onChange={(e) => setSoldForm((f) => ({ ...f, sold_price: e.target.value }))}
                  placeholder={t('listing.markSoldModal.soldPricePlaceholder', 'e.g. 2350')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-forest-900 block mb-1">
                  {t('listing.markSoldModal.soldQuantity', 'Sold Quantity')}
                </label>
                <input
                  type="text"
                  value={soldForm.sold_quantity}
                  onChange={(e) => setSoldForm((f) => ({ ...f, sold_quantity: e.target.value }))}
                  placeholder={t('listing.markSoldModal.soldQuantityPlaceholder', 'e.g. 50 Quintals')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-forest-900 block mb-1">
                  {t('listing.markSoldModal.notes', 'Transaction Notes (Optional)')}
                </label>
                <textarea
                  rows={2}
                  value={soldForm.notes}
                  onChange={(e) => setSoldForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('listing.markSoldModal.notesPlaceholder', 'e.g. Sold to local mill')}
                  className="w-full px-3.5 py-2 rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSoldModalPost(null)}
                className="flex-1 min-h-[44px] py-3 rounded-xl border border-cloud-200 text-forest-900/70 text-xs font-semibold hover:bg-cloud-100 active:scale-95 transition-all"
              >
                {t('listing.markSoldModal.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => handleStatusChange(soldModalPost.id, 'sold', soldForm)}
                className="flex-1 min-h-[44px] py-3 rounded-xl bg-forest-700 text-white text-xs font-bold hover:bg-forest-800 disabled:opacity-70 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                {statusUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {t('listing.markSoldModal.confirm', 'Confirm Sold Out')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
