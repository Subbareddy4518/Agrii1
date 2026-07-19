import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sprout, Building2, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { registerUser } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import ImagePicker from '../components/ImagePicker.jsx'

const inputCls =
  'w-full px-4 py-3.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none transition-all text-[15px]'
const labelCls = 'text-sm font-medium text-forest-950 mb-1.5 block'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()
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

    if (!form.name.trim()) return setError(role === 'farmer' ? 'Enter your full name' : 'Enter your company name')
    if (role === 'industry' && !form.contact_person.trim()) return setError('Enter contact person name')
    if (!/^\d{10}$/.test(form.mobile)) return setError('Enter a valid 10-digit mobile number')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    if (form.password !== form.confirm_password) return setError('Passwords do not match')

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
      toast.success('Account created! Welcome to AgriConnect.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col justify-center px-6 py-10">
        <div className="max-w-sm mx-auto w-full">
          <div className="flex flex-col items-center mb-10 animate-slide-up">
            <div className="w-16 h-16 rounded-3xl bg-forest-700 flex items-center justify-center shadow-float mb-4">
              <Sprout size={30} className="text-white" />
            </div>
            <h1 className="font-display font-semibold text-white text-2xl">Join AgriConnect</h1>
            <p className="text-forest-200/70 text-sm mt-1 text-center">Tell us who you are</p>
          </div>

          <div className="space-y-4 animate-slide-up">
            <button
              onClick={() => chooseRole('farmer')}
              className="w-full bg-white rounded-3xl p-5 flex items-center gap-4 shadow-float active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-forest-100 flex items-center justify-center shrink-0">
                <Sprout size={26} className="text-forest-700" />
              </div>
              <div>
                <p className="font-display font-semibold text-forest-950 text-lg">I'm a Farmer</p>
                <p className="text-sm text-forest-900/50">Sell your crops directly to industries</p>
              </div>
            </button>

            <button
              onClick={() => chooseRole('industry')}
              className="w-full bg-white rounded-3xl p-5 flex items-center gap-4 shadow-float active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-harvest-400/20 flex items-center justify-center shrink-0">
                <Building2 size={26} className="text-harvest-600" />
              </div>
              <div>
                <p className="font-display font-semibold text-forest-950 text-lg">I'm an Industry</p>
                <p className="text-sm text-forest-900/50">Post requirements, source directly from farmers</p>
              </div>
            </button>
          </div>

          <p className="text-center text-forest-200/80 text-sm mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-white font-semibold underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cloud-50 px-6 py-8">
      <div className="max-w-sm mx-auto w-full">
        <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-forest-700 font-medium mb-6">
          <ArrowLeft size={18} /> Back
        </button>

        <h2 className="font-display font-semibold text-forest-950 text-xl mb-1">
          {role === 'farmer' ? 'Farmer Registration' : 'Industry Registration'}
        </h2>
        <p className="text-sm text-forest-900/50 mb-6">
          {role === 'farmer' ? 'A few details to get you connected' : 'Tell us about your company'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-2">
            <ImagePicker
              circular
              value={form.profile_image}
              onChange={(url) => update('profile_image', url)}
              label={role === 'farmer' ? 'Profile photo' : 'Company logo'}
            />
          </div>

          <div>
            <label className={labelCls}>{role === 'farmer' ? 'Full Name' : 'Company Name'}</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={role === 'farmer' ? 'e.g. Ramesh Kumar' : 'e.g. AgroFoods Pvt Ltd'}
            />
          </div>

          {role === 'industry' && (
            <div>
              <label className={labelCls}>Contact Person</label>
              <input
                className={inputCls}
                value={form.contact_person}
                onChange={(e) => update('contact_person', e.target.value)}
                placeholder="Name of the person we should reach"
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Mobile Number</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className={inputCls}
              value={form.mobile}
              onChange={(e) => update('mobile', e.target.value.replace(/\D/g, ''))}
              placeholder="9876543210"
            />
          </div>

          <div>
            <label className={labelCls}>{role === 'farmer' ? 'Village / District' : 'Location'}</label>
            <input
              className={inputCls}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Nalgonda, Telangana"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Password</label>
              <input
                type="password"
                className={inputCls}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Min. 6 characters"
              />
            </div>
            <div>
              <label className={labelCls}>Confirm</label>
              <input
                type="password"
                className={inputCls}
                value={form.confirm_password}
                onChange={(e) => update('confirm_password', e.target.value)}
                placeholder="Re-enter"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
