import { useState } from 'react'
import { X, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { reportPost } from '../services/api.js'

export default function ReportModal({ isOpen, onClose, post }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('Incorrect price or crop details')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen || !post) return null

  const reasons = [
    'Incorrect price or crop details',
    'Spam or duplicate listing',
    'Misleading quality or variety claims',
    'Unresponsive or fake contact',
    'Inappropriate or offensive content',
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await reportPost(post.id, {
        reason,
        details: details.trim() || null,
      })
      toast.success(t('report.successToast', 'Report submitted. Our moderation team will review it.'))
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('report.errorToast', 'Could not submit report.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 animate-pop-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-float border border-cloud-200">
        <div className="flex items-center justify-between pb-3 border-b border-cloud-100">
          <div className="flex items-center gap-2 text-forest-950 font-semibold">
            <AlertTriangle size={18} className="text-harvest-500" />
            <span>{t('report.title', 'Report Listing')}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-cloud-100 flex items-center justify-center text-forest-900/60 hover:text-forest-950"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <p className="text-xs text-forest-900/70">
            {t('report.guidance', 'Help keep AgriConnect safe and verified. Why are you reporting this listing?')}
          </p>

          <div className="space-y-2">
            {reasons.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                  reason === r
                    ? 'border-forest-600 bg-forest-50/70 font-semibold text-forest-950'
                    : 'border-cloud-200 text-forest-900/80 hover:bg-cloud-50'
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-forest-700"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-forest-950 block mb-1">
              {t('report.additionalDetails', 'Additional details (optional)')}
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
              placeholder={t('report.detailsPlaceholder', 'Any specific context for our reviewers...')}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl border border-cloud-200 text-xs font-semibold text-forest-900/70"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-card"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {t('report.submit', 'Submit Report')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
