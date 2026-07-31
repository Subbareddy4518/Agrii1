import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sprout, Phone, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { loginUser } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{10}$/.test(mobile)) {
      setError(t('auth.login.errors.invalidMobile'))
      return
    }
    if (!password) {
      setError(t('auth.login.errors.passwordRequired'))
      return
    }
    setLoading(true)
    try {
      const res = await loginUser({ mobile, password })
      login(res.data.access_token, res.data.user)
      toast.success(t('auth.login.welcomeToast', { name: res.data.user.name.split(' ')[0] }))
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.login.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col justify-center px-6 py-10">
      <div className="max-w-sm mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-16 h-16 rounded-3xl bg-forest-700 flex items-center justify-center shadow-float mb-4">
            <Sprout size={30} className="text-white" />
          </div>
          <h1 className="font-display font-semibold text-white text-2xl">{t('auth.login.appName')}</h1>
          <p className="text-forest-200/70 text-sm mt-1">{t('auth.login.tagline')}</p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          className="bg-white rounded-3xl p-6 shadow-float space-y-4"
          aria-label={t('auth.login.formAria')}
        >
          <div>
            <label htmlFor="login-mobile" className="text-sm font-medium text-forest-950 mb-1.5 block">{t('auth.login.mobileLabel')}</label>
            <div className="relative">
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                id="login-mobile"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder={t('auth.login.mobilePlaceholder')}
                aria-label={t('auth.login.mobileLabel')}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none transition-all text-[15px]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-forest-950 mb-1.5 block">{t('auth.login.passwordLabel')}</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.login.passwordPlaceholder')}
                aria-label={t('auth.login.passwordLabel')}
                className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none transition-all text-[15px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200 rounded-lg"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-label={t('auth.login.signInAria')}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 focus:outline-none focus:ring-4 focus:ring-forest-600/40"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('auth.login.signIn')}
          </button>
        </motion.form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-center text-forest-200/80 text-sm mt-6"
        >
          {t('auth.login.newHere')}{' '}
          <Link to="/register" className="text-white font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-white/40 rounded">
            {t('auth.login.createAccount')}
          </Link>
        </motion.p>
      </div>
    </div>
  )
}
