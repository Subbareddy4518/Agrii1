import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-cloud-50 flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-float p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={26} />
        </div>
        <h1 className="font-display font-semibold text-forest-950 text-xl mb-2">
          {t('admin.unauthorized.title')}
        </h1>
        <p className="text-sm text-forest-900/60 mb-6">
          {t('admin.unauthorized.subtitle')}
        </p>
        <button
          onClick={() => navigate(user ? '/' : '/login', { replace: true })}
          className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          {t('admin.unauthorized.backHome')}
        </button>
      </div>
    </div>
  )
}
