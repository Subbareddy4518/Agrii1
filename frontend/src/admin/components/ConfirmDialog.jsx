import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function ConfirmDialog({ open, title, message, confirmLabel, danger = true, loading, onConfirm, onCancel }) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-float w-full max-w-sm p-6">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${danger ? 'bg-red-50 text-red-600' : 'bg-forest-50 text-forest-700'}`}>
          <AlertTriangle size={20} />
        </div>
        <h2 className="font-display font-semibold text-forest-950 text-lg mb-1.5">{title}</h2>
        <p className="text-sm text-forest-900/60 mb-6">{message}</p>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-cloud-200 text-forest-900 hover:bg-cloud-50 transition-colors disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-forest-700 hover:bg-forest-800'
            }`}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
