import { useEffect, useRef, useState, useCallback } from 'react'
import { Sprout, Building2, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar.jsx'
import PostCard from '../components/PostCard.jsx'
import PostCardSkeleton from '../components/PostCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getFeed } from '../services/api.js'

const SORT_VALUES = ['latest', 'price_low', 'price_high']
const SORT_KEYS = { latest: 'latest', price_low: 'priceLow', price_high: 'priceHigh' }

export default function Home() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState('latest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sentinelRef = useRef(null)

  const opposite = user?.role === 'farmer' ? t('home.oppositeIndustry') : t('home.oppositeFarmer')
  const OppositeIcon = user?.role === 'farmer' ? Building2 : Sprout

  const loadFeed = useCallback(async (pageNum, sortValue, replace) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await getFeed({ page: pageNum, page_size: 8, sort: sortValue })
      setPosts((prev) => (replace ? res.data.items : [...prev, ...res.data.items]))
      setHasMore(res.data.has_more)
    } catch {
      toast.error(t('home.loadError'))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [t])

  useEffect(() => {
    setPage(1)
    loadFeed(1, sort, true)
  }, [sort, loadFeed])

  useEffect(() => {
    if (!sentinelRef.current || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const next = page + 1
          setPage(next)
          loadFeed(next, sort, false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [page, hasMore, loadingMore, loading, sort, loadFeed])

  function handlePostChange(updated) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="min-h-screen pb-28">
      <TopBar title={t('home.title')} subtitle={t('home.showing', { opposite })} />

      <main className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-forest-900/50 text-xs font-medium">
            <OppositeIcon size={14} />
            <span>{t('home.nearYou', { opposite })}</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-medium bg-white border border-cloud-200 rounded-full px-3 py-1.5 shadow-card text-forest-800"
            >
              <SlidersHorizontal size={13} />
              {t(`home.sorts.${SORT_KEYS[sort]}`)}
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-float border border-cloud-200 overflow-hidden z-20 w-48">
                {SORT_VALUES.map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      setSort(value)
                      setShowSortMenu(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm ${
                      sort === value ? 'bg-forest-50 text-forest-800 font-medium' : 'text-forest-900/70'
                    }`}
                  >
                    {t(`home.sorts.${SORT_KEYS[value]}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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
            {!hasMore && posts.length > 3 && (
              <p className="text-center text-xs text-forest-900/40 py-4">{t('home.caughtUp')}</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
