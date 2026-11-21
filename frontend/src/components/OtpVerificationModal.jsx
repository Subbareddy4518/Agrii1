import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, X, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { sendOtp, verifyOtp } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function OtpVerificationModal({ isOpen, onClose, onVerified, initialMobile, promptReason }) {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [mobile, setMobile] = useState(initialMobile || user?.mobile || '')
  const [otp, setOtp] = useState('')
  const [testOtp, setTestOtp] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [verifiedSuccess, setVerifiedSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const mob = initialMobile || user?.mobile || ''
      setMobile(mob)
      setOtp('')
      setTestOtp(null)
      setError('')
      setVerifiedSuccess(false)
      // Auto-request OTP on open
      if (mob && mob.length >= 10) {
        handleSendOtp(mob)
      }
    }
  }, [isOpen, initialMobile, user?.mobile])

  async function handleSendOtp(mob) {
    const target = mob || mobile
    if (!target || target.length < 10) return
    setResending(true)
    setError('')
    try {
      const res = await sendOtp({ mobile: target })
      if (res.data?.otp) {
        setTestOtp(res.data.otp)
      } else {
        setTestOtp(null)
      }
      toast.success(res.data?.message || t('auth.otp.sentSuccess', 'Verification code sent to your mobile number'))
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.otp.sendFailed', 'Failed to send OTP'))
    } finally {
      setResending(false)
    }
  }

  async function handleVerify(e) {
    if (e) e.preventDefault()
    setError('')
    if (!otp.trim()) {
      setError(t('auth.otp.enterCode', 'Please enter 4-digit code'))
      return
    }

    setLoading(true)
    try {
      const res = await verifyOtp({ mobile: mobile, otp: otp.trim() })
      if (res.data?.is_verified) {
        setVerifiedSuccess(true)
        toast.success(t('auth.otp.success', 'Mobile number verified successfully!'))
        if (refreshUser) {
          await refreshUser()
        }
        setTimeout(() => {
          if (onVerified) onVerified(res.data.user)
          if (onClose) onClose()
        }, 1200)
      }
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.otp.invalidOtp', 'Invalid verification code. Please check and try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-float border border-cloud-200 relative overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-modal-title"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-cloud-100 hover:bg-cloud-200 flex items-center justify-center text-forest-900/60 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-forest-300"
          >
            <X size={18} />
          </button>

          {verifiedSuccess ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="font-display font-bold text-forest-950 text-xl">
                {t('common.mobileVerified', 'Mobile Number Verified')}
              </h3>
              <p className="text-sm text-forest-900/60 mt-1">
                {t('auth.otp.success', 'Mobile number verified successfully!')}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-forest-100 text-forest-700 flex items-center justify-center shrink-0">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h3 id="otp-modal-title" className="font-display font-bold text-forest-950 text-lg">
                    {t('auth.otp.title', 'Verify Mobile Number')}
                  </h3>
                  <p className="text-xs text-forest-900/60">
                    {promptReason || t('auth.otp.subtitle', 'We sent a 4-digit verification code to')} {mobile ? `+91 ${mobile}` : ''}
                  </p>
                </div>
              </div>

              {/* Demo Notice (Only shown when server returns a test code in development) */}
              {testOtp && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 mb-4 text-center">
                  <p className="text-xs font-semibold text-amber-900">
                    ⚡ {t('auth.otp.testHint', 'Test OTP code:')} {testOtp}
                  </p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="otp-input" className="block text-xs font-medium text-forest-900/70 mb-1.5 text-center">
                    {t('auth.otp.enterCode', 'Enter 4-digit code')}
                  </label>
                  <input
                    id="otp-input"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    autoFocus
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold py-3 px-4 rounded-2xl border-2 border-cloud-200 focus:border-forest-600 focus:ring-4 focus:ring-forest-100 outline-none transition-all bg-cloud-50 focus:bg-white"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length < 4}
                  className="w-full min-h-[48px] bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm focus:outline-none focus:ring-4 focus:ring-forest-600/40"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{t('auth.otp.verifying', 'Verifying…')}</span>
                    </>
                  ) : (
                    <span>{t('auth.otp.verifyBtn', 'Verify & Continue')}</span>
                  )}
                </button>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleSendOtp(mobile)}
                    disabled={resending}
                    className="text-xs font-medium text-forest-700 hover:text-forest-900 inline-flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-forest-50 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-forest-200"
                  >
                    <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                    {t('auth.otp.resendBtn', 'Resend Code')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
