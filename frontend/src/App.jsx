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
import Splash from './pages/Splash.jsx'
import Welcome from './pages/Welcome.jsx'
import LanguageSelect from './pages/LanguageSelect.jsx'
import VoiceAssist from './pages/VoiceAssist.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { hasSplashShownThisSession, isWelcomeSeen } from './utils/onboarding.js'

/**
 * Onboarding gate: on the very first load of the app (path "/"), a
 * first-time visitor is sent through Splash → Welcome → Language →
 * Voice before ever reaching Login/Home. Returning visitors who have
 * already completed onboarding (welcomeSeen === true) are left alone
 * and fall straight through to the existing protected routes below —
 * this effect only ever *adds* a redirect, it never runs again after
 * the initial mount, so it cannot interfere with normal in-app
 * navigation, deep links, or the existing Login/Register/Home flow.
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
    <Routes>
      <Route path="/splash" element={<Splash />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/language" element={<LanguageSelect />} />
      <Route path="/voice" element={<VoiceAssist />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
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
