import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Pagination({ page, pageSize, total, onChange }) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-cloud-200 text-sm text-forest-900/60">
      <span>{t('admin.pagination.range', { from, to, total })}</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-cloud-200 disabled:opacity-40 hover:bg-cloud-50"
          aria-label={t('admin.pagination.prev')}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-forest-900 font-medium">{page} / {totalPages}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-cloud-200 disabled:opacity-40 hover:bg-cloud-50"
          aria-label={t('admin.pagination.next')}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
