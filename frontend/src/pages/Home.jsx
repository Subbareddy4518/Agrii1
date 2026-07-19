import { useEffect, useRef, useState, useCallback } from 'react'
import { Sprout, Building2, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import TopBar from '../components/TopBar.jsx'
import PostCard from '../components/PostCard.jsx'
import PostCardSkeleton from '../components/PostCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getFeed } from '../services/api.js'

const SORTS = [
  { value: 'latest', label: 'Latest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
]

export default function Home() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState('latest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sentinelRef = useRef(null)

  const opposite = user?.role === 'farmer' ? 'Industry requirements' : 'Farmer crops'
  const OppositeIcon = user?.role === 'farmer' ? Building2 : Sprout

  const loadFeed = useCallback(async (pageNum, sortValue, replace) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await getFeed({ page: pageNum, page_size: 8, sort: sortValue })
      setPosts((prev) => (replace ? res.data.items : [...prev, ...res.data.items]))
      setHasMore(res.data.has_more)
    } catch {
      toast.error('Could not load feed. Pull to refresh.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

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
      <TopBar title="AgriConnect" subtitle={`Showing: ${opposite}`} />

      <main className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-forest-900/50 text-xs font-medium">
            <OppositeIcon size={14} />
            <span>{opposite} near you</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu((s) => !s)}
              className="flex items-center gap-1.5 text-xs font-medium bg-white border border-cloud-200 rounded-full px-3 py-1.5 shadow-card text-forest-800"
            >
              <SlidersHorizontal size={13} />
              {SORTS.find((s) => s.value === sort)?.label}
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-float border border-cloud-200 overflow-hidden z-20 w-48">
                {SORTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      setSort(s.value)
                      setShowSortMenu(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm ${
                      sort === s.value ? 'bg-forest-50 text-forest-800 font-medium' : 'text-forest-900/70'
                    }`}
                  >
                    {s.label}
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
            title="Nothing here yet"
            message={
              user?.role === 'farmer'
                ? 'No industry requirements posted yet. Check back soon.'
                : 'No farmer crop posts yet. Check back soon.'
            }
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onChange={handlePostChange} />
            ))}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && <PostCardSkeleton />}
            {!hasMore && posts.length > 3 && (
              <p className="text-center text-xs text-forest-900/40 py-4">You're all caught up 🌾</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
