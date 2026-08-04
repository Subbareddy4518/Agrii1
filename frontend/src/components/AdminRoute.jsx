import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Guards every /admin/* route. Frontend gating alone is never sufficient —
 * every admin API call is independently re-checked server-side by
 * get_current_admin (see backend/auth.py) — but this keeps non-admins from
 * ever rendering the admin UI in the first place.
 */
export default function AdminRoute({ children }) {
  const { user, token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-[3px] border-forest-200 border-t-forest-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (!token || !user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/unauthorized" replace />

  return children
}
