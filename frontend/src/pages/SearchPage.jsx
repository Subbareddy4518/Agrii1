import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'
import PostCard from '../components/PostCard.jsx'
import PostCardSkeleton from '../components/PostCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { searchPosts } from '../services/api.js'

const SORTS = [
  { value: 'latest', label: 'Latest' },
  { value: 'price_low', label: 'Price ↑' },
  { value: 'price_high', label: 'Price ↓' },
]

export default function SearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('latest')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runSearch = useCallback(async (q, sortValue) => {
    setLoading(true)
    setSearched(true)
    try {
      const res = await searchPosts({ q: q || undefined, sort: sortValue })
      setResults(res.data.items)
    } catch {
      toast.error('Search failed. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    const timer = setTimeout(() => runSearch(query.trim(), sort), 400)
    return () => clearTimeout(timer)
  }, [query, sort, runSearch])

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 bg-cloud-50/90 backdrop-blur border-b border-cloud-200">
        <div className="max-w-md mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl bg-white border border-cloud-200 shadow-card flex items-center justify-center text-forest-800 shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="relative flex-1">
            <SearchIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                user?.role === 'farmer' ? 'Search industry, crop or location' : 'Search farmer, crop or location'
              }
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-cloud-200 bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none text-[15px]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {searched && (
          <div className="max-w-md mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  sort === s.value
                    ? 'bg-forest-700 border-forest-700 text-white'
                    : 'bg-white border-cloud-200 text-forest-900/60'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 pt-4">
        {!searched ? (
          <EmptyState
            icon={SearchIcon}
            title="Search AgriConnect"
            message={
              user?.role === 'farmer'
                ? 'Find requirements by crop, industry name, or location.'
                : 'Find crops by name, farmer name, or location.'
            }
          />
        ) : loading ? (
          <div className="space-y-4">
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        ) : results.length === 0 ? (
          <EmptyState icon={SearchIcon} title="No results" message={`Nothing matched "${query}". Try another search.`} />
        ) : (
          <div className="space-y-4">
            {results.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
