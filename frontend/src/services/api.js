import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agriconnect_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
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

// ---- Users ----
export const getMe = () => api.get('/users/me')
export const updateMe = (payload) => api.put('/users/me', payload)

// ---- Posts ----
export const getFeed = (params) => api.get('/posts/feed', { params })
export const searchPosts = (params) => api.get('/posts/search', { params })
export const getMyPosts = () => api.get('/posts/mine')
export const createPost = (payload) => api.post('/posts', payload)
export const updatePost = (id, payload) => api.put(`/posts/${id}`, payload)
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

export default api
