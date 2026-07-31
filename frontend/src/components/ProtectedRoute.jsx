import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { user, token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloud-50">
        <div className="w-10 h-10 border-[3px] border-forest-200 border-t-forest-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (!token || !user) return <Navigate to="/login" replace />

  return children
}
