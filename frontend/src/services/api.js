import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000, // 15 seconds network timeout for unstable rural 2G/3G/4G connections
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agriconnect_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Flag timeout and network disconnection for farmer-friendly error handling
    if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
      err.isTimeout = true
    } else if (!err.response) {
      err.isNetworkError = true
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('agriconnect_token')
      localStorage.removeItem('agriconnect_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ---- Auth ----
export const registerUser = (payload) => api.post('/auth/register', payload)
export const loginUser = (payload) => api.post('/auth/login', payload)
export const sendOtp = (payload) => api.post('/auth/send-otp', payload)
export const verifyOtp = (payload) => api.post('/auth/verify-otp', payload)

// ---- Users ----
export const getMe = () => api.get('/users/me')
export const updateMe = (payload) => api.put('/users/me', payload)

// ---- Posts ----
export const getFeed = (params) => api.get('/posts/feed', { params })
export const searchPosts = (params) => api.get('/posts/search', { params })
export const getMyPosts = () => api.get('/posts/mine')
export const createPost = (payload) => api.post('/posts', payload)
export const updatePost = (id, payload) => api.put(`/posts/${id}`, payload)
export const updatePostStatus = (id, payload) => api.patch(`/posts/${id}/status`, payload)
export const deletePost = (id) => api.delete(`/posts/${id}`)
export const likePost = (id) => api.post(`/posts/${id}/like`)
export const uploadImage = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/posts/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ---- Notifications ----
export const getNotifications = () => api.get('/notifications')
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.post('/notifications/read-all')

// ---- AI & Matching Services ----
export const getCropsCatalog = (category) => api.get('/ai/crops', { params: { category } })
export const getPriceGuidance = (crop, location) => api.get('/ai/price-guidance', { params: { crop, location } })
export const cropAssist = (payload) => api.post('/ai/crop-assist', payload)
export const aiAdvisor = (payload) => api.post('/ai/advisor', payload)

export const getMyMatches = () => api.get('/matching/my-matches')
export const explainMatch = (postId) => api.get(`/matching/explain/${postId}`)

// ---- Reporting ----
export const reportPost = (postId, payload) => api.post(`/reports/post/${postId}`, payload)
export const getAdminReports = (params) => api.get('/reports', { params })
export const resolveAdminReport = (id, payload) => api.post(`/reports/${id}/resolve`, payload)

// ---- Admin ----
export const getAdminStats = () => api.get('/admin/stats')
export const getAdminAnalytics = () => api.get('/admin/analytics')
export const getAdminUsers = (params) => api.get('/admin/users', { params })
export const getAdminUserDetail = (id) => api.get(`/admin/users/${id}`)
export const setAdminUserStatus = (id, status) => api.post(`/admin/users/${id}/status`, { status })
export const revealAdminUserMobile = (id) => api.post(`/admin/users/${id}/reveal-mobile`)
export const getAdminPosts = (params) => api.get('/admin/posts', { params })
export const getAdminPostDetail = (id) => api.get(`/admin/posts/${id}`)
export const setAdminPostStatus = (id, status) => api.post(`/admin/posts/${id}/status`, { status })
export const deleteAdminPost = (id, hardDelete = false) =>
  api.delete(`/admin/posts/${id}`, { params: { hard_delete: hardDelete } })
export const getAdminRecentNotifications = (params) => api.get('/admin/notifications/recent', { params })
export const broadcastAdminNotification = (payload) => api.post('/admin/notifications/broadcast', payload)
export const getAdminAuditLogs = (params) => api.get('/admin/audit-logs', { params })
export const changeAdminPassword = (payload) => api.post('/admin/change-password', payload)

export default api
