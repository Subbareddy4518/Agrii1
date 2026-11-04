import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sprout, Building2, Loader2, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { registerUser } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import ImagePicker from '../components/ImagePicker.jsx'

const inputCls =
  'w-full px-4 py-3.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none transition-all text-[15px]'
const labelCls = 'text-sm font-medium text-forest-950 mb-1.5 block'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useTranslation()
  const [step, setStep] = useState(1) // 1 = choose role, 2 = fill form
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    mobile: '',
    password: '',
    confirm_password: '',
    location: '',
    profile_image: null,
  })

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function chooseRole(r) {
    setRole(r)
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) return setError(role === 'farmer' ? t('auth.register.errors.nameFarmer') : t('auth.register.errors.nameIndustry'))
    if (role === 'industry' && !form.contact_person.trim()) return setError(t('auth.register.errors.contactPerson'))
    if (!/^\d{10}$/.test(form.mobile)) return setError(t('auth.register.errors.mobile'))
    if (form.password.length < 6) return setError(t('auth.register.errors.passwordLength'))
    if (form.password !== form.confirm_password) return setError(t('auth.register.errors.passwordMismatch'))

    setLoading(true)
    try {
      const res = await registerUser({
        role,
        name: form.name.trim(),
        contact_person: role === 'industry' ? form.contact_person.trim() : null,
        mobile: form.mobile,
        password: form.password,
        confirm_password: form.confirm_password,
        location: form.location.trim() || null,
        profile_image: form.profile_image,
      })
      login(res.data.access_token, res.data.user)
      toast.success(t('auth.register.successToast'))
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.register.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
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
            <h1 className="font-display font-semibold text-white text-2xl">{t('auth.register.title')}</h1>
            <p className="text-forest-200/70 text-sm mt-1 text-center">{t('auth.register.subtitle')}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
            className="space-y-4"
          >
            <button
              onClick={() => chooseRole('farmer')}
              aria-label={t('auth.register.farmerAria')}
              className="w-full bg-white rounded-3xl p-5 flex items-center gap-4 shadow-float active:scale-[0.98] transition-transform text-left focus:outline-none focus:ring-4 focus:ring-forest-600/30"
            >
              <div className="w-14 h-14 rounded-2xl bg-forest-100 flex items-center justify-center shrink-0">
                <Sprout size={26} className="text-forest-700" />
              </div>
              <div>
                <p className="font-display font-semibold text-forest-950 text-lg">{t('auth.register.farmerLabel')}</p>
                <p className="text-sm text-forest-900/50">{t('auth.register.farmerDesc')}</p>
              </div>
            </button>

            <button
              onClick={() => chooseRole('industry')}
              aria-label={t('auth.register.industryAria')}
              className="w-full bg-white rounded-3xl p-5 flex items-center gap-4 shadow-float active:scale-[0.98] transition-transform text-left focus:outline-none focus:ring-4 focus:ring-forest-600/30"
            >
              <div className="w-14 h-14 rounded-2xl bg-harvest-400/20 flex items-center justify-center shrink-0">
                <Building2 size={26} className="text-harvest-600" />
              </div>
              <div>
                <p className="font-display font-semibold text-forest-950 text-lg">{t('auth.register.industryLabel')}</p>
                <p className="text-sm text-forest-900/50">{t('auth.register.industryDesc')}</p>
              </div>
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="text-center text-forest-200/80 text-sm mt-8"
          >
            {t('auth.register.alreadyHave')}{' '}
            <Link to="/login" className="text-white font-semibold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-white/40 rounded">
              {t('auth.register.signIn')}
            </Link>
          </motion.p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cloud-50 px-6 py-8">
      <div className="max-w-sm mx-auto w-full">
        <button
          onClick={() => setStep(1)}
          aria-label={t('auth.register.backAria')}
          className="flex items-center gap-1.5 text-forest-700 font-medium mb-6 focus:outline-none focus:ring-2 focus:ring-forest-200 rounded-lg"
        >
          <ArrowLeft size={18} /> {t('auth.register.back')}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <h2 className="font-display font-semibold text-forest-950 text-xl mb-1">
            {role === 'farmer' ? t('auth.register.farmerRegistrationTitle') : t('auth.register.industryRegistrationTitle')}
          </h2>
          <p className="text-sm text-forest-900/50 mb-6">
            {role === 'farmer' ? t('auth.register.farmerRegistrationSubtitle') : t('auth.register.industryRegistrationSubtitle')}
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: 'easeOut' }}
          className="space-y-4"
          aria-label={role === 'farmer' ? t('auth.register.formAriaFarmer') : t('auth.register.formAriaIndustry')}
        >
          <div className="flex justify-center mb-2">
            <ImagePicker
              circular
              value={form.profile_image}
              onChange={(url) => update('profile_image', url)}
              label={role === 'farmer' ? t('auth.register.photoLabelFarmer') : t('auth.register.photoLabelIndustry')}
            />
          </div>

          <div>
            <label htmlFor="reg-name" className={labelCls}>{role === 'farmer' ? t('auth.register.fullNameLabel') : t('auth.register.companyNameLabel')}</label>
            <input
              id="reg-name"
              className={inputCls}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={role === 'farmer' ? t('auth.register.fullNamePlaceholder') : t('auth.register.companyNamePlaceholder')}
              aria-label={role === 'farmer' ? t('auth.register.fullNameLabel') : t('auth.register.companyNameLabel')}
            />
          </div>

          {role === 'industry' && (
            <div>
              <label htmlFor="reg-contact" className={labelCls}>{t('auth.register.contactPersonLabel')}</label>
              <input
                id="reg-contact"
                className={inputCls}
                value={form.contact_person}
                onChange={(e) => update('contact_person', e.target.value)}
                placeholder={t('auth.register.contactPersonPlaceholder')}
                aria-label={t('auth.register.contactPersonLabel')}
              />
            </div>
          )}

          <div>
            <label htmlFor="reg-mobile" className={labelCls}>{t('auth.register.mobileLabel')}</label>
            <input
              id="reg-mobile"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className={inputCls}
              value={form.mobile}
              onChange={(e) => update('mobile', e.target.value.replace(/\D/g, ''))}
              placeholder={t('auth.register.mobilePlaceholder')}
              aria-label={t('auth.register.mobileLabel')}
            />
          </div>

          <div>
            <label htmlFor="reg-location" className={labelCls}>{role === 'farmer' ? t('auth.register.villageDistrictLabel') : t('auth.register.locationLabel')}</label>
            <input
              id="reg-location"
              className={inputCls}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder={t('auth.register.locationPlaceholder')}
              aria-label={role === 'farmer' ? t('auth.register.villageDistrictLabel') : t('auth.register.locationLabel')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-password" className={labelCls}>{t('auth.register.passwordLabel')}</label>
              <input
                id="reg-password"
                type="password"
                className={inputCls}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder={t('auth.register.passwordPlaceholder')}
                aria-label={t('auth.register.passwordLabel')}
              />
            </div>
            <div>
              <label htmlFor="reg-confirm" className={labelCls}>{t('auth.register.confirmLabel')}</label>
              <input
                id="reg-confirm"
                type="password"
                className={inputCls}
                value={form.confirm_password}
                onChange={(e) => update('confirm_password', e.target.value)}
                placeholder={t('auth.register.confirmPlaceholder')}
                aria-label={t('auth.register.confirmLabel')}
              />
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            aria-label={t('auth.register.createAccountAria')}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 mt-2 focus:outline-none focus:ring-4 focus:ring-forest-600/40"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('auth.register.createAccount')}
          </button>
        </motion.form>
      </div>
    </div>
  )
}
