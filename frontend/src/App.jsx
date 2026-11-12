import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import VoiceAssist from './pages/VoiceAssist.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import AdminLayout from './admin/AdminLayout.jsx'
import AdminDashboard from './admin/pages/Dashboard.jsx'
import AdminUsers from './admin/pages/Users.jsx'
import AdminFarmers from './admin/pages/Farmers.jsx'
import AdminIndustries from './admin/pages/Industries.jsx'
import AdminPosts from './admin/pages/Posts.jsx'
import AdminAnalytics from './admin/pages/Analytics.jsx'
import AdminNotifications from './admin/pages/Notifications.jsx'
import AdminSettings from './admin/pages/Settings.jsx'
import Unauthorized from './pages/Unauthorized.jsx'
import { hasSplashShownThisSession, isWelcomeSeen } from './utils/onboarding.js'

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
      navigate('/language', { replace: true })
    } else {
      navigate('/splash', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export default function App() {
  useOnboardingGate()

  return (
    <Routes>
      <Route path="/splash" element={<Splash />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/language" element={<LanguageSelect />} />
      <Route path="/voice" element={<VoiceAssist />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/farmers" element={<AdminFarmers />} />
        <Route path="/admin/industries" element={<AdminIndustries />} />
        <Route path="/admin/posts" element={<AdminPosts />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
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
  )
}
