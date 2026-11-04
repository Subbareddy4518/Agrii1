import { useState } from 'react'
import { Phone, MessageCircle, Heart, Share2, MapPin, Sprout, Building2, ShieldAlert, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { timeAgo } from '../utils/time.js'
import { likePost } from '../services/api.js'
import { translateCropName, translateUnit } from '../utils/i18nHelpers.js'
import { speak } from '../utils/onboarding.js'
import ReportModal from './ReportModal.jsx'

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export default function PostCard({ post, onChange }) {
  const { t } = useTranslation()
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const [busy, setBusy] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const isIndustryPost = post.role === 'industry'
  const cropName = translateCropName(t, post.crop_name)

  async function handleLike() {
    if (busy) return
    setBusy(true)
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((c) => c + (nextLiked ? 1 : -1))
    try {
      const res = await likePost(post.id)
      setLiked(res.data.liked_by_me)
      setLikeCount(res.data.likes_count)
      onChange?.(res.data)
    } catch {
      setLiked(!nextLiked)
      setLikeCount((c) => c + (nextLiked ? -1 : 1))
      toast.error(t('postCard.likeError'))
    } finally {
      setBusy(false)
    }
  }

  function handleCall() {
    window.location.href = `tel:${post.owner.mobile}`
  }

  function handleWhatsApp() {
    const label = isIndustryPost ? t('postCard.requirementWord') : t('postCard.cropWord')
    const text = encodeURIComponent(
      t('postCard.whatsappMessage', { name: post.owner.name, label, crop: cropName })
    )
    window.open(`https://wa.me/91${post.owner.mobile.replace(/\D/g, '').slice(-10)}?text=${text}`, '_blank')
  }

  async function handleShare() {
    const shareData = {
      title: post.title,
      text: `${cropName} - ${post.title} on AgriConnect`,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(`${shareData.title}: ${shareData.text}`)
      toast.success(t('postCard.shareCopied'))
    }
  }

  function handleReadAloud() {
    const summary = `${post.title}. ${cropName}. ${post.quantity || ''}. ${post.price ? `Price ${post.price} rupees` : ''}. Location: ${post.location || ''}.`
    speak(summary)
  }

  return (
    <>
      <article className="bg-white rounded-3xl shadow-card border border-cloud-200/90 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          <div className="w-11 h-11 rounded-full bg-forest-100 border border-forest-200/80 flex items-center justify-center shrink-0 overflow-hidden">
            {post.owner.profile_image ? (
              <img src={post.owner.profile_image} alt={post.owner.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-forest-700 font-semibold text-sm">{initials(post.owner.name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-forest-950 truncate text-sm">{post.owner.name}</p>
              {isIndustryPost ? (
                <Building2 size={13} className="text-forest-600 shrink-0" />
              ) : (
                <Sprout size={13} className="text-forest-600 shrink-0" />
              )}
              {/* Trust Verification Badge */}
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-forest-100 text-forest-800 border border-forest-200 shrink-0">
                ✓ {isIndustryPost ? t('postCard.verifiedIndustry', 'Verified Industry') : t('postCard.verifiedFarmer', 'Verified Farmer')}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-forest-900/50 mt-0.5">
              {post.location && (
                <>
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{post.location}</span>
                  <span>&middot;</span>
                </>
              )}
              <span>{timeAgo(post.created_at, t)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleReadAloud}
              title={t('common.readAloud', 'Read aloud')}
              className="w-7 h-7 rounded-full text-forest-900/40 hover:text-forest-700 flex items-center justify-center hover:bg-forest-50"
            >
              <Volume2 size={14} />
            </button>
            <button
              onClick={() => setShowReport(true)}
              title={t('report.buttonTitle', 'Report listing')}
              className="w-7 h-7 rounded-full text-forest-900/40 hover:text-red-500 flex items-center justify-center hover:bg-red-50"
            >
              <ShieldAlert size={14} />
            </button>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isIndustryPost ? 'bg-harvest-400/20 text-harvest-700' : 'bg-forest-100 text-forest-800'
              }`}
            >
              {isIndustryPost ? t('postCard.requirementBadge') : t('postCard.cropBadge')}
            </span>
          </div>
        </div>

        {/* Image */}
        {post.image && (
          <div className="w-full aspect-[4/3] bg-cloud-100 border-y border-cloud-100 overflow-hidden">
            <img src={post.image} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}

        {/* Body */}
        <div className="px-4 pt-3 pb-2">
          <h2 className="font-display font-semibold text-forest-950 text-base leading-snug">{post.title}</h2>
          {post.description && (
            <p className="text-xs text-forest-900/70 mt-1 leading-relaxed line-clamp-3">{post.description}</p>
          )}

          {/* Quality & Variety Pills */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.variety && (
              <span className="text-[11px] font-medium bg-forest-50 text-forest-800 px-2 py-0.5 rounded-lg border border-forest-200/60">
                🌾 {post.variety}
              </span>
            )}
            {post.quality_grade && (
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                ⭐ {post.quality_grade}
              </span>
            )}
            {post.is_negotiable && (
              <span className="text-[11px] font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200/60">
                🤝 {t('postCard.negotiable', 'Negotiable')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-2.5 border-t border-cloud-100 text-xs">
            <div>
              <span className="text-forest-900/50">{t('postCard.crop')} </span>
              <span className="font-bold text-forest-950">{cropName}</span>
            </div>
            {post.quantity && (
              <div>
                <span className="text-forest-900/50">{t('postCard.qty')} </span>
                <span className="font-semibold text-forest-950">{translateUnit(t, post.quantity)}</span>
              </div>
            )}
            {post.price != null && (
              <div>
                <span className="text-forest-900/50">{isIndustryPost ? t('postCard.offer') : t('postCard.price')} </span>
                <span className="font-bold text-harvest-600 text-sm">{t('postCard.perUnit', { price: post.price })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 pb-3.5 pt-1.5">
          <button
            onClick={handleCall}
            className="flex-1 flex items-center justify-center gap-1.5 bg-forest-700 hover:bg-forest-800 text-white font-semibold text-xs py-3 rounded-2xl active:scale-95 transition-all shadow-sm"
          >
            <Phone size={15} /> {t('postCard.call')}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:brightness-95 text-white font-semibold text-xs py-3 rounded-2xl active:scale-95 transition-all shadow-sm"
          >
            <MessageCircle size={15} /> {t('postCard.whatsapp')}
          </button>
          <button
            onClick={handleLike}
            aria-label={t('postCard.interestedAria')}
            className={`w-11 h-11 shrink-0 rounded-2xl border flex items-center justify-center transition-colors active:scale-95 ${
              liked ? 'bg-red-50 border-red-200 text-red-500' : 'bg-cloud-50 border-cloud-200 text-forest-900/50'
            }`}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} className={liked ? 'animate-like-burst' : ''} />
          </button>
          <button
            onClick={handleShare}
            aria-label={t('postCard.shareAria')}
            className="w-11 h-11 shrink-0 rounded-2xl bg-cloud-50 border border-cloud-200 text-forest-900/50 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Share2 size={16} />
          </button>
        </div>
        {likeCount > 0 && (
          <p className="px-4 pb-2.5 -mt-2 text-[11px] text-forest-900/50">
            {t('postCard.interestedCount', { count: likeCount })}
          </p>
        )}
      </article>

      {/* Report Modal */}
      <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} post={post} />
    </>
  )
}
