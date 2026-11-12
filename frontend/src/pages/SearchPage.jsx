import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon, X, Sprout, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import PostCard from '../components/PostCard.jsx'
import PostCardSkeleton from '../components/PostCardSkeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { searchPosts } from '../services/api.js'

const SORT_VALUES = ['latest', 'price_low', 'price_high']
const SORT_KEYS = { latest: 'latest', price_low: 'priceLow', price_high: 'priceHigh' }

export default function SearchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [sort, setSort] = useState('latest')
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    debounceRef.current = setTimeout(() => runSearch(query, sort), 400)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort])

  async function runSearch(q, sortValue) {
    setLoading(true)
    try {
      const res = await searchPosts({ q, sort: sortValue })
      setResults(res.data.items || (Array.isArray(res.data) ? res.data : []))
      setSearched(true)
    } catch {
      toast.error(t('search.failedToast'))
    } finally {
      setLoading(false)
    }
  }

  function handlePostChange(updated) {
    setResults((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  return (
    <div className="min-h-screen pb-28">
      <div className="sticky top-0 z-30 bg-cloud-50/95 backdrop-blur-sm border-b border-cloud-200/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-forest-800 shrink-0 focus:outline-none focus:ring-2 focus:ring-forest-200"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="relative flex-1">
            <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={user?.role === 'farmer' ? t('search.placeholderFarmer') : t('search.placeholderIndustry')}
              aria-label={t('common.search')}
              className="w-full pl-9 pr-9 py-2.5 rounded-full bg-white border border-cloud-200 focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label={t('search.clearAria')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200 rounded-full"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4">
        {searched && results.length > 0 && (
          <div className="flex justify-end mb-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label={t('home.sorts.latest')}
              className="text-xs font-medium bg-white border border-cloud-200 rounded-full px-3 py-1.5 text-forest-800 outline-none"
            >
              {SORT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`search.sorts.${SORT_KEYS[value]}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : !searched ? (
          <EmptyState
            icon={SearchIcon}
            title={t('search.empty.title')}
            message={user?.role === 'farmer' ? t('search.empty.farmerMessage') : t('search.empty.industryMessage')}
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={user?.role === 'farmer' ? Building2 : Sprout}
            title={t('search.noResults.title')}
            message={t('search.noResults.message', { query })}
          />
        ) : (
          <div className="space-y-4">
            {results.map((post) => (
              <PostCard key={post.id} post={post} onChange={handlePostChange} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
