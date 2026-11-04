import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getMe } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('agriconnect_user')
    return raw ? JSON.parse(raw) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('agriconnect_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      if (token) {
        try {
          const res = await getMe()
          setUser(res.data)
          localStorage.setItem('agriconnect_user', JSON.stringify(res.data))
        } catch {
          logout()
        }
      }
      setLoading(false)
    }
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('agriconnect_token', newToken)
    localStorage.setItem('agriconnect_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('agriconnect_token')
    localStorage.removeItem('agriconnect_user')
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await getMe()
    setUser(res.data)
    localStorage.setItem('agriconnect_user', JSON.stringify(res.data))
    return res.data
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
