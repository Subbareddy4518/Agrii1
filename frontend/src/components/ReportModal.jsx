import { useState } from 'react'
import { X, AlertTriangle, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { reportPost } from '../services/api.js'

const REPORT_REASONS = [
  { key: 'incorrectDetails', backendValue: 'Incorrect price or crop details' },
  { key: 'spamDuplicate', backendValue: 'Spam or duplicate listing' },
  { key: 'misleadingQuality', backendValue: 'Misleading quality or variety claims' },
  { key: 'unresponsiveFake', backendValue: 'Unresponsive or fake contact' },
  { key: 'inappropriateContent', backendValue: 'Inappropriate or offensive content' },
]

export default function ReportModal({ isOpen, onClose, post }) {
  const { t } = useTranslation()
  const [selectedKey, setSelectedKey] = useState('incorrectDetails')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (!isOpen || !post) return null

  function handleInitiateSubmit(e) {
    e.preventDefault()
    if (!selectedKey) {
      toast.error(t('report.selectReasonError', 'Please select a reason for reporting.'))
      return
    }
    // Prevent accidental report submission by requiring explicit confirmation
    setShowConfirm(true)
  }

  async function handleConfirmedSubmit() {
    setSubmitting(true)
    const selectedItem = REPORT_REASONS.find((r) => r.key === selectedKey)
    const backendReason = selectedItem ? selectedItem.backendValue : selectedKey

    try {
      await reportPost(post.id, {
        reason: backendReason,
        details: details.trim() || null,
      })
      toast.success(t('report.successToast', 'Report submitted. Our moderation team will review it.'))
      handleClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || t('report.errorToast', 'Could not submit report.'))
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setShowConfirm(false)
    setDetails('')
    setSelectedKey('incorrectDetails')
    onClose()
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
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-cloud-100 flex items-center justify-center text-forest-900/60 hover:text-forest-950"
            aria-label={t('common.close', 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step 2: Accidental Submission Prevention Screen */}
        {showConfirm ? (
          <div className="mt-4 space-y-4 animate-fade-in">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2">
              <h4 className="font-bold text-amber-950 text-sm">
                {t('report.confirmTitle', 'Confirm Report Submission')}
              </h4>
              <p className="text-amber-900/80 leading-relaxed">
                {t('report.confirmDesc', 'Are you sure you want to report this listing? Our moderation team investigates all reports to protect farmers and buyers.')}
              </p>
              <div className="pt-2 border-t border-amber-200/60 flex items-center gap-2 text-forest-900 font-semibold">
                <span className="text-forest-900/50">{t('postCard.crop', 'Crop')}:</span>
                <span>{post.crop_name} ({post.title})</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-2xl border border-cloud-200 text-xs font-semibold text-forest-900/70 hover:bg-cloud-50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <ArrowLeft size={14} />
                {t('report.cancelAction', 'Keep Listing (Go Back)')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmedSubmit}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-card disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {t('report.confirmAction', 'Yes, Submit Report')}
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Reason Selection */
          <form onSubmit={handleInitiateSubmit} className="mt-4 space-y-3.5">
            <p className="text-xs text-forest-900/70 leading-relaxed">
              {t('report.guidance', 'Help keep AgriConnect safe and verified. Why are you reporting this listing?')}
            </p>

            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.key}
                  className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                    selectedKey === r.key
                      ? 'border-forest-600 bg-forest-50/70 font-semibold text-forest-950'
                      : 'border-cloud-200 text-forest-900/80 hover:bg-cloud-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    checked={selectedKey === r.key}
                    onChange={() => setSelectedKey(r.key)}
                    className="accent-forest-700"
                  />
                  <span>{t(`report.reasons.${r.key}`, r.backendValue)}</span>
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
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-2xl border border-cloud-200 text-xs font-semibold text-forest-900/70 hover:bg-cloud-50 active:scale-95 transition-all"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-card"
              >
                <ShieldCheck size={14} />
                {t('report.submit', 'Submit Report')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
