import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Sprout,
  Building2,
  SlidersHorizontal,
  Sparkles,
  Search,
  MessageSquareText,
  PlusCircle,
  TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar.jsx'
import PostCard from '../components/PostCard.jsx'
import PostCardSkeleton from '../components/PostCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AiAdvisorModal from '../components/AiAdvisorModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getFeed, getMyMatches } from '../services/api.js'
import { translateAgriCategory } from '../utils/i18nHelpers.js'

const SORT_VALUES = ['latest', 'price_low', 'price_high']
const SORT_KEYS = { latest: 'latest', price_low: 'priceLow', price_high: 'priceHigh' }
const CATEGORIES = ['All', 'Cereals', 'Vegetables', 'Spices', 'Cash Crops', 'Pulses', 'Fruits']

export default function Home() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'farmer'

  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState('latest')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showAiAdvisor, setShowAiAdvisor] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const sentinelRef = useRef(null)

  const opposite = isFarmer ? t('home.oppositeIndustry') : t('home.oppositeFarmer')
  const OppositeIcon = isFarmer ? Building2 : Sprout

  // Load feed with category & sort
  const loadFeed = useCallback(async (pageNum, sortValue, categoryValue, replace) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await getFeed({
        page: pageNum,
        page_size: 8,
        sort: sortValue,
        category: categoryValue === 'All' ? undefined : categoryValue,
      })
      setPosts((prev) => (replace ? res.data.items : [...prev, ...res.data.items]))
      setHasMore(res.data.has_more)
    } catch {
      toast.error(t('home.loadError'))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [t])

  // Initial load
  useEffect(() => {
    setPage(1)
    loadFeed(1, sort, selectedCategory, true)
  }, [sort, selectedCategory, loadFeed])

  // Fetch match count badge
  useEffect(() => {
    async function checkMatches() {
      try {
        const res = await getMyMatches()
        setMatchCount(res.data.total_matches || 0)
      } catch {
        // quiet ignore
      }
    }
    checkMatches()
  }, [])

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const next = page + 1
          setPage(next)
          loadFeed(next, sort, selectedCategory, false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [page, hasMore, loadingMore, loading, sort, selectedCategory, loadFeed])

  function handlePostChange(updated) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="min-h-screen pb-28 bg-cloud-50">
      <TopBar title={t('home.title')} subtitle={t('home.showing', { opposite })} />

      <main className="max-w-md mx-auto px-4 pt-3 space-y-4">
        {/* ============================================================ */}
        {/* FARMER-FIRST HERO ACTIONS GRID                               */}
        {/* 4 Large Recognizable Visual Actions:                          */}
        {/* 1. Sell My Crops / Post Requirement                          */}
        {/* 2. Find Buyers / Find Crops                                  */}
        {/* 3. Check My Matches (SmartMatch)                             */}
        {/* 4. Ask AgriConnect AI                                        */}
        {/* ============================================================ */}
        <section className="space-y-2.5">
          {/* Main Primary Action Banner */}
          <div
            onClick={() => navigate('/post')}
            className="cursor-pointer bg-gradient-to-r from-forest-800 via-forest-700 to-forest-900 rounded-3xl p-4 text-white shadow-float border border-forest-600/40 relative overflow-hidden active:scale-[0.99] transition-all"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] bg-harvest-500 text-white font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                  <Sparkles size={11} />
                  {isFarmer ? t('home.actionBadgeFarmer', 'Fast 3-Step Selling') : t('home.actionBadgeIndustry', 'Direct Sourcing')}
                </span>
                <h2 className="font-display font-bold text-white text-lg sm:text-xl mt-1.5 leading-snug">
                  {isFarmer ? t('home.sellMyCrops', '🌾 Sell My Crops') : t('home.postRequirement', '📢 Post Requirement')}
                </h2>
                <p className="text-xs text-forest-100/80 mt-0.5">
                  {isFarmer
                    ? t('home.sellSubtitleFarmer', 'AI-assisted crop posting with mandi price guidance')
                    : t('home.postSubtitleIndustry', 'Post requirements directly to verified farmers')}
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-harvest-500 text-white flex items-center justify-center shrink-0 shadow-card">
                <PlusCircle size={28} />
              </div>
            </div>
          </div>

          {/* 4 Secondary Large Visual Actions */}
          <div className="grid grid-cols-4 gap-2">
            {/* Action 1: Find Buyers / Crops */}
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="bg-white hover:bg-cloud-100/60 p-2.5 rounded-2xl border border-cloud-200 shadow-xs flex flex-col items-center justify-center text-center active:scale-95 transition-all min-h-[76px]"
            >
              <div className="w-8 h-8 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center mb-1">
                <Search size={16} />
              </div>
              <span className="font-bold text-forest-950 text-[11px] sm:text-xs leading-tight">
                {isFarmer ? t('home.findBuyers', 'Find Buyers') : t('home.findCrops', 'Find Crops')}
              </span>
            </button>

            {/* Action 2: My Crops / My Requirements */}
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="bg-white hover:bg-cloud-100/60 p-2.5 rounded-2xl border border-cloud-200 shadow-xs flex flex-col items-center justify-center text-center active:scale-95 transition-all min-h-[76px]"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${
                isFarmer ? 'bg-forest-100 text-forest-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {isFarmer ? <Sprout size={16} /> : <Building2 size={16} />}
              </div>
              <span className="font-bold text-forest-950 text-[11px] sm:text-xs leading-tight">
                {isFarmer ? t('home.myCrops', 'My Crops') : t('home.myRequirements', 'My Requirements')}
              </span>
            </button>

            {/* Action 3: Check My Matches */}
            <button
              type="button"
              onClick={() => navigate('/matches')}
              className="bg-white hover:bg-cloud-100/60 p-2.5 rounded-2xl border border-cloud-200 shadow-xs flex flex-col items-center justify-center text-center active:scale-95 transition-all min-h-[76px] relative"
            >
              <div className="w-8 h-8 rounded-xl bg-harvest-100 text-harvest-700 flex items-center justify-center mb-1">
                <Sparkles size={16} />
              </div>
              <span className="font-bold text-forest-950 text-[11px] sm:text-xs leading-tight">
                {t('home.checkMatches', 'Matches')}
              </span>
              {matchCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-harvest-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {matchCount}
                </span>
              )}
            </button>

            {/* Action 4: Ask AgriConnect AI */}
            <button
              type="button"
              onClick={() => setShowAiAdvisor(true)}
              className="bg-white hover:bg-cloud-100/60 p-2.5 rounded-2xl border border-cloud-200 shadow-xs flex flex-col items-center justify-center text-center active:scale-95 transition-all min-h-[76px]"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
                <MessageSquareText size={16} />
              </div>
              <span className="font-bold text-forest-950 text-[11px] sm:text-xs leading-tight">
                {t('home.askAi', 'Ask AI')}
              </span>
            </button>
          </div>
        </section>

        {/* Category Horizontal Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3.5 py-2 min-h-[36px] rounded-full font-semibold shrink-0 transition-all active:scale-95 flex items-center ${
                selectedCategory === cat
                  ? 'bg-forest-700 text-white shadow-xs'
                  : 'bg-white border border-cloud-200 text-forest-900/70 hover:bg-cloud-100'
              }`}
            >
              {translateAgriCategory(t, cat)}
            </button>
          ))}
        </div>

        {/* Feed Header: Title, near you, & Sort Filter */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-forest-900/60 text-xs font-semibold">
            <OppositeIcon size={14} className="text-forest-700" />
            <span>{t('home.nearYou', { opposite })}</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowSortMenu((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-cloud-200 rounded-full px-3.5 py-2 min-h-[38px] shadow-xs text-forest-800 active:scale-95 transition-all"
            >
              <SlidersHorizontal size={13} />
              {t(`home.sorts.${SORT_KEYS[sort]}`)}
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-float border border-cloud-200 overflow-hidden z-20 w-48 py-1 animate-pop-in">
                  {SORT_VALUES.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSort(value)
                        setShowSortMenu(false)
                      }}
                      className={`w-full text-left px-4 py-3 min-h-[44px] text-xs sm:text-sm flex items-center justify-between ${
                        sort === value ? 'bg-forest-50 text-forest-800 font-bold' : 'text-forest-900/70 hover:bg-cloud-50'
                      }`}
                    >
                      <span>{t(`home.sorts.${SORT_KEYS[value]}`)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Feed Post List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={OppositeIcon}
            title={t('home.empty.title')}
            message={user?.role === 'farmer' ? t('home.empty.farmerMessage') : t('home.empty.industryMessage')}
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onChange={handlePostChange} />
            ))}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && <PostCardSkeleton />}
            {!hasMore && posts.length > 2 && (
              <p className="text-center text-xs text-forest-900/40 py-4 font-medium">
                {t('home.caughtUp', "You're all caught up 🌾")}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Interactive Ask AgriConnect AI Modal */}
      <AiAdvisorModal isOpen={showAiAdvisor} onClose={() => setShowAiAdvisor(false)} />
    </div>
  )
}
