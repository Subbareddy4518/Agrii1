import { useTranslation } from 'react-i18next'

const STYLES = {
  active: 'bg-forest-50 text-forest-700',
  suspended: 'bg-red-50 text-red-600',
  closed: 'bg-slate-100 text-slate-600',
}

export default function StatusBadge({ status }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        STYLES[status] || STYLES.closed
      }`}
    >
      {t(`admin.status.${status}`, status)}
    </span>
  )
}
