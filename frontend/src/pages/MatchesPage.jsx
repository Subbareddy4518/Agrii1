import { useEffect, useState } from 'react'
import { Sparkles, Phone, MessageCircle, MapPin, RefreshCw, Sprout, Building2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PostCardSkeleton from '../components/PostCardSkeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getMyMatches } from '../services/api.js'
import { translateCropName, translateUnit, translateMatchReason, translateDistance } from '../utils/i18nHelpers.js'

export default function MatchesPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const isFarmer = user?.role === 'farmer'

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadMatches() {
    setLoading(true)
    try {
      const res = await getMyMatches()
      setMatches(res.data.matches || [])
    } catch {
      toast.error(t('matches.loadError', 'Could not load AI matches'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMatches()
  }, [])

  function handleCall(mobile) {
    window.location.href = `tel:${mobile}`
  }

  function handleWhatsApp(post, cropName) {
    const label = isFarmer ? t('postCard.requirementWord', 'requirement') : t('postCard.cropWord', 'crop')
    const messageTemplate = t('matches.whatsappMessage', {
      name: post.owner.name,
      label,
      crop: cropName,
      defaultValue: `Hello ${post.owner.name}, I saw your ${label} for ${cropName} on AgriConnect SmartMatch. I would like to discuss it.`
    })
    const text = encodeURIComponent(messageTemplate)
    window.open(`https://wa.me/91${post.owner.mobile.replace(/\D/g, '').slice(-10)}?text=${text}`, '_blank')
  }

  return (
    <div className="min-h-screen pb-28">
      <TopBar
        title={t('matches.title', 'SmartMatch AI')}
        subtitle={isFarmer ? t('matches.subtitleFarmer', 'Matching buyers for your crops') : t('matches.subtitleIndustry', 'Matching crops for your requirements')}
        showSearch={false}
      />

      <main className="max-w-md mx-auto px-4 pt-4">
        {/* Banner Explaining SmartMatch */}
        <div className="bg-gradient-to-r from-forest-800 to-forest-900 rounded-3xl p-4 text-white shadow-card mb-4 relative overflow-hidden">
          <div className="relative z-10 flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-harvest-500/20 border border-harvest-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="text-harvest-400" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-white text-base">
                  {t('matches.bannerTitle', 'Explainable AI Matching')}
                </h2>
                <span className="text-[10px] bg-harvest-500 text-white font-bold px-2 py-0.5 rounded-full">
                  SmartMatch 2.0
                </span>
              </div>
              <p className="text-xs text-forest-100/80 mt-1 leading-relaxed">
                {isFarmer
                  ? t('matches.bannerDescFarmer', 'AI evaluates buyer requirements against your crops based on variety, district proximity, and price alignment.')
                  : t('matches.bannerDescIndustry', 'AI scans farmer listings to match your exact crop, volume, and budget requirements.')}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-forest-200/90 font-medium">
              {t('matches.verifiedDirect', 'Verified Direct Connection (No Middlemen)')}
            </span>
            <button
              onClick={loadMatches}
              disabled={loading}
              className="flex items-center gap-1 text-harvest-300 font-semibold active:scale-95 transition-transform"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh', 'Refresh')}
            </button>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="space-y-4">
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        ) : matches.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={t('matches.emptyTitle', 'No matches found yet')}
            message={
              isFarmer
                ? t('matches.emptyFarmer', 'Post a crop listing to let AI automatically match you with interested industry buyers!')
                : t('matches.emptyIndustry', 'Post a requirement to discover verified farmers who have harvested your required crops.')
            }
          />
        ) : (
          <div className="space-y-4">
            {matches.map((item) => {
              const post = item.post
              const cropName = translateCropName(t, post.crop_name)
              const isIndustryPost = post.role === 'industry'

              return (
                <article
                  key={post.id}
                  className="bg-white rounded-3xl shadow-card border border-cloud-200/90 overflow-hidden animate-slide-up"
                >
                  {/* Header with match score badge */}
                  <div className="bg-forest-50/70 border-b border-forest-100/60 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-forest-700" />
                      <span className="text-xs font-bold text-forest-800">
                        {item.match_score}% {t('matches.matchLabel', 'Match')}
                      </span>
                      {item.distance_approx && (
                        <span className="text-[11px] text-forest-900/50 bg-white px-2 py-0.5 rounded-full border border-forest-200/50">
                          {translateDistance(t, item.distance_approx)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-harvest-700 bg-harvest-100/80 px-2.5 py-0.5 rounded-full">
                      {isIndustryPost ? t('postCard.requirementBadge', 'Requirement') : t('postCard.cropBadge', 'Crop')}
                    </span>
                  </div>

                  <div className="p-4">
                    {/* User info */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-forest-100 flex items-center justify-center font-bold text-forest-800 text-sm shrink-0 overflow-hidden">
                        {post.owner.profile_image ? (
                          <img src={post.owner.profile_image} alt={post.owner.name} className="w-full h-full object-cover" />
                        ) : (
                          post.owner.name[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-forest-950 truncate text-sm">{post.owner.name}</p>
                          {isIndustryPost ? (
                            <Building2 size={13} className="text-forest-600 shrink-0" />
                          ) : (
                            <Sprout size={13} className="text-forest-600 shrink-0" />
                          )}
                          {post.owner?.is_verified && (
                            <span className="text-[10px] bg-forest-100 text-forest-800 font-medium px-1.5 py-0.2 rounded-full shrink-0">
                              ✓ {t('profile.verified', 'Verified')}
                            </span>
                          )}
                          {post.owner?.trust_score != null && (
                            <span className="text-[10px] bg-cloud-100 text-forest-800/80 font-medium px-1.5 py-0.2 rounded-full shrink-0" title={t('profile.trustScore', 'Trust Score')}>
                              🛡️ {post.owner.trust_score}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-forest-900/50 mt-0.5">
                          {post.location && (
                            <>
                              <MapPin size={11} />
                              <span className="truncate">{post.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Post Title & Details */}
                    <h3 className="font-display font-semibold text-forest-950 text-base leading-snug">
                      {post.title}
                    </h3>
                    {post.description && (
                      <p className="text-xs text-forest-900/70 mt-1 line-clamp-2">{post.description}</p>
                    )}

                    {/* Crop, Qty, Price tags */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <div className="bg-cloud-100 rounded-xl px-2.5 py-1 text-xs">
                        <span className="text-forest-900/50">{t('postCard.crop', 'Crop')}: </span>
                        <span className="font-bold text-forest-950">{cropName}</span>
                      </div>
                      {post.quantity && (
                        <div className="bg-cloud-100 rounded-xl px-2.5 py-1 text-xs">
                          <span className="text-forest-900/50">{t('postCard.qty', 'Qty')}: </span>
                          <span className="font-semibold text-forest-950">{translateUnit(t, post.quantity)}</span>
                        </div>
                      )}
                      {post.price != null && (
                        <div className="bg-harvest-50 border border-harvest-200/60 rounded-xl px-2.5 py-1 text-xs">
                          <span className="text-harvest-800/70">{t('postCard.price', 'Price')}: </span>
                          <span className="font-bold text-harvest-700">₹{post.price}</span>
                        </div>
                      )}
                    </div>

                    {/* Transparent Explainable Match Reasons */}
                    {item.reasons && item.reasons.length > 0 && (
                      <div className="mt-3.5 bg-forest-50/50 rounded-2xl p-2.5 border border-forest-100/80">
                        <p className="text-[11px] font-bold text-forest-900/70 mb-1.5 flex items-center gap-1">
                          <Sparkles size={11} className="text-forest-600" />
                          {t('matches.whyMatched', 'Why this matched with you:')}
                        </p>
                        <ul className="space-y-1">
                          {item.reasons.map((reason, idx) => (
                            <li key={idx} className="text-xs text-forest-900/80 flex items-start gap-1.5">
                              <CheckCircle2 size={13} className="text-forest-600 shrink-0 mt-0.5" />
                              <span>{translateMatchReason(t, reason)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-cloud-100">
                      <button
                        onClick={() => handleCall(post.owner.mobile)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-forest-700 hover:bg-forest-800 text-white font-semibold text-xs py-2.5 rounded-2xl active:scale-95 transition-all shadow-sm"
                      >
                        <Phone size={14} /> {t('postCard.call', 'Call')}
                      </button>
                      <button
                        onClick={() => handleWhatsApp(post, cropName)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:brightness-95 text-white font-semibold text-xs py-2.5 rounded-2xl active:scale-95 transition-all shadow-sm"
                      >
                        <MessageCircle size={14} /> {t('postCard.whatsapp', 'WhatsApp')}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
