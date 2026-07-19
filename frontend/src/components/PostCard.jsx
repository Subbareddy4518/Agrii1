import { useState } from 'react'
import { Phone, MessageCircle, Heart, Share2, MapPin, Sprout, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { timeAgo } from '../utils/time.js'
import { likePost } from '../services/api.js'

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export default function PostCard({ post, onChange }) {
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const [busy, setBusy] = useState(false)
  const isIndustryPost = post.role === 'industry'

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
      toast.error('Could not update. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleCall() {
    window.location.href = `tel:${post.owner.mobile}`
  }

  function handleWhatsApp() {
    const label = isIndustryPost ? 'requirement' : 'crop'
    const text = encodeURIComponent(
      `Hi ${post.owner.name}, I saw your ${label} post for ${post.crop_name} on AgriConnect. Is it still available?`
    )
    window.open(`https://wa.me/91${post.owner.mobile.replace(/\D/g, '').slice(-10)}?text=${text}`, '_blank')
  }

  async function handleShare() {
    const shareData = {
      title: post.title,
      text: `${post.crop_name} - ${post.title} on AgriConnect`,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(`${shareData.title}: ${shareData.text}`)
      toast.success('Post details copied')
    }
  }

  return (
    <article className="bg-white rounded-3xl shadow-card border border-cloud-200/70 overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-11 h-11 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center shrink-0 overflow-hidden">
          {post.owner.profile_image ? (
            <img src={post.owner.profile_image} alt={post.owner.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-forest-700 font-semibold text-sm">{initials(post.owner.name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-forest-950 truncate">{post.owner.name}</p>
            {isIndustryPost ? (
              <Building2 size={13} className="text-forest-600 shrink-0" />
            ) : (
              <Sprout size={13} className="text-forest-600 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-forest-900/50">
            {post.location && (
              <>
                <MapPin size={11} />
                <span className="truncate">{post.location}</span>
                <span>&middot;</span>
              </>
            )}
            <span>{timeAgo(post.created_at)}</span>
          </div>
        </div>
        <span
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
            isIndustryPost ? 'bg-harvest-400/20 text-harvest-600' : 'bg-forest-100 text-forest-700'
          }`}
        >
          {isIndustryPost ? 'Requirement' : 'Crop'}
        </span>
      </div>

      {/* Image */}
      {post.image && (
        <div className="w-full aspect-[4/3] bg-cloud-100">
          <img src={post.image} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Body */}
      <div className="px-4 pt-3 pb-2">
        <p className="font-display font-semibold text-forest-950 text-[15px]">{post.title}</p>
        {post.description && (
          <p className="text-sm text-forest-900/70 mt-1 line-clamp-3">{post.description}</p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">
          <div>
            <span className="text-forest-900/40">Crop </span>
            <span className="font-medium text-forest-950">{post.crop_name}</span>
          </div>
          {post.quantity && (
            <div>
              <span className="text-forest-900/40">Qty </span>
              <span className="font-medium text-forest-950">{post.quantity}</span>
            </div>
          )}
          {post.price != null && (
            <div>
              <span className="text-forest-900/40">{isIndustryPost ? 'Offer ' : 'Price '}</span>
              <span className="font-semibold text-harvest-600">₹{post.price}/unit</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4 pt-1">
        <button
          onClick={handleCall}
          className="flex-1 flex items-center justify-center gap-1.5 bg-forest-700 hover:bg-forest-800 text-white font-medium text-sm py-2.5 rounded-2xl active:scale-95 transition-all"
        >
          <Phone size={16} /> Call
        </button>
        <button
          onClick={handleWhatsApp}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:brightness-95 text-white font-medium text-sm py-2.5 rounded-2xl active:scale-95 transition-all"
        >
          <MessageCircle size={16} /> WhatsApp
        </button>
        <button
          onClick={handleLike}
          aria-label="Interested"
          className={`w-11 h-11 shrink-0 rounded-2xl border flex items-center justify-center transition-colors ${
            liked ? 'bg-red-50 border-red-200 text-red-500' : 'bg-cloud-50 border-cloud-200 text-forest-900/50'
          }`}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} className={liked ? 'animate-like-burst' : ''} />
        </button>
        <button
          onClick={handleShare}
          aria-label="Share"
          className="w-11 h-11 shrink-0 rounded-2xl bg-cloud-50 border border-cloud-200 text-forest-900/50 flex items-center justify-center"
        >
          <Share2 size={17} />
        </button>
      </div>
      {likeCount > 0 && (
        <p className="px-4 pb-3 -mt-3 text-xs text-forest-900/50">
          {likeCount} {likeCount === 1 ? 'person is' : 'people are'} interested
        </p>
      )}
    </article>
  )
}
