import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import CreatePost from './pages/CreatePost.jsx'
import Notifications from './pages/Notifications.jsx'
import Profile from './pages/Profile.jsx'
import SearchPage from './pages/SearchPage.jsx'
import Settings from './pages/Settings.jsx'
import MatchesPage from './pages/MatchesPage.jsx'
import Splash from './pages/Splash.jsx'
import Welcome from './pages/Welcome.jsx'
import LanguageSelect from './pages/LanguageSelect.jsx'
import RoleSelect from './pages/RoleSelect.jsx'
import VoiceAssist from './pages/VoiceAssist.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import Unauthorized from './pages/Unauthorized.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import { hasSplashShownThisSession, isWelcomeSeen } from './utils/onboarding.js'

// Safe code-splitting: Lazy load admin suite and heavy analytics/recharts to reduce bundle size for farmers
const AdminLayout = lazy(() => import('./admin/AdminLayout.jsx'))
const AdminDashboard = lazy(() => import('./admin/pages/Dashboard.jsx'))
const AdminUsers = lazy(() => import('./admin/pages/Users.jsx'))
const AdminFarmers = lazy(() => import('./admin/pages/Farmers.jsx'))
const AdminIndustries = lazy(() => import('./admin/pages/Industries.jsx'))
const AdminPosts = lazy(() => import('./admin/pages/Posts.jsx'))
const AdminReports = lazy(() => import('./admin/pages/Reports.jsx'))
const AdminAnalytics = lazy(() => import('./admin/pages/Analytics.jsx'))
const AdminNotifications = lazy(() => import('./admin/pages/Notifications.jsx'))
const AdminSettings = lazy(() => import('./admin/pages/Settings.jsx'))

function AdminSuspenseFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cloud-50 text-forest-700">
      <Loader2 className="animate-spin" size={28} />
    </div>
  )
}

/**
 * Onboarding gate: on the very first load of the app (path "/"), a
 * first-time visitor is sent through Splash → Language → Welcome →
 * Voice → Registration. Returning visitors who have already completed
 * onboarding (welcomeSeen === true) are left alone and fall straight
 * through to the existing protected routes below.
 */
function useOnboardingGate() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname !== '/') return
    if (isWelcomeSeen()) return
    if (hasSplashShownThisSession()) {
      navigate('/welcome', { replace: true })
    } else {
      navigate('/splash', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export default function App() {
  useOnboardingGate()

  return (
    <>
      <OfflineBanner />
      <Routes>
      <Route path="/splash" element={<Splash />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/language" element={<LanguageSelect />} />
      <Route path="/role" element={<RoleSelect />} />
      <Route path="/voice" element={<VoiceAssist />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route
        element={
          <AdminRoute>
            <Suspense fallback={<AdminSuspenseFallback />}>
              <AdminLayout />
            </Suspense>
          </AdminRoute>
        }
      >
        <Route path="/admin" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminDashboard /></Suspense>} />
        <Route path="/admin/users" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminUsers /></Suspense>} />
        <Route path="/admin/farmers" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminFarmers /></Suspense>} />
        <Route path="/admin/industries" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminIndustries /></Suspense>} />
        <Route path="/admin/posts" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminPosts /></Suspense>} />
        <Route path="/admin/reports" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminReports /></Suspense>} />
        <Route path="/admin/analytics" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminAnalytics /></Suspense>} />
        <Route path="/admin/notifications" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminNotifications /></Suspense>} />
        <Route path="/admin/settings" element={<Suspense fallback={<AdminSuspenseFallback />}><AdminSettings /></Suspense>} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/post" element={<CreatePost />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </>
  )
}
