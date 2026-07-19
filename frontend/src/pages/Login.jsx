import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sprout, Phone, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { loginUser } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{10}$/.test(mobile)) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    if (!password) {
      setError('Enter your password')
      return
    }
    setLoading(true)
    try {
      const res = await loginUser({ mobile, password })
      login(res.data.access_token, res.data.user)
      toast.success(`Welcome back, ${res.data.user.name.split(' ')[0]}!`)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not sign in. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-forest-950 flex flex-col justify-center px-6 py-10">
      <div className="max-w-sm mx-auto w-full">
        <div className="flex flex-col items-center mb-10 animate-slide-up">
          <div className="w-16 h-16 rounded-3xl bg-forest-700 flex items-center justify-center shadow-float mb-4">
            <Sprout size={30} className="text-white" />
          </div>
          <h1 className="font-display font-semibold text-white text-2xl">AgriConnect</h1>
          <p className="text-forest-200/70 text-sm mt-1">Farmers &amp; Industries, directly connected</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-float space-y-4 animate-slide-up">
          <div>
            <label className="text-sm font-medium text-forest-950 mb-1.5 block">Mobile Number</label>
            <div className="relative">
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="9876543210"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none transition-all text-[15px]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-forest-950 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-11 pr-11 py-3.5 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none transition-all text-[15px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-forest-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-forest-200/80 text-sm mt-6">
          New to AgriConnect?{' '}
          <Link to="/register" className="text-white font-semibold underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
