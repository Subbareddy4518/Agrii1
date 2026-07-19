import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, MapPin, Sprout, Building2, LogOut, Pencil, Loader2, Trash2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import TopBar from '../components/TopBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import PostCardSkeleton from '../components/PostCardSkeleton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getMyPosts, updateMe, deletePost } from '../services/api.js'
import { timeAgo } from '../utils/time.js'

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'farmer'

  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    contact_person: user?.contact_person || '',
    location: user?.location || '',
    profile_image: user?.profile_image || null,
  })

  useEffect(() => {
    loadPosts()
  }, [])

  async function loadPosts() {
    setLoadingPosts(true)
    try {
      const res = await getMyPosts()
      setPosts(res.data)
    } catch {
      toast.error('Could not load your posts.')
    } finally {
      setLoadingPosts(false)
    }
  }

  function startEdit() {
    setForm({
      name: user?.name || '',
      contact_person: user?.contact_person || '',
      location: user?.location || '',
      profile_image: user?.profile_image || null,
    })
    setEditing(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name cannot be empty')
    setSaving(true)
    try {
      await updateMe({
        name: form.name.trim(),
        contact_person: isFarmer ? null : form.contact_person.trim(),
        location: form.location.trim() || null,
        profile_image: form.profile_image,
      })
      await refreshUser()
      toast.success('Profile updated')
      setEditing(false)
    } catch {
      toast.error('Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePost(id) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await deletePost(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Post deleted')
    } catch {
      toast.error('Could not delete post.')
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen pb-28">
      <TopBar title="Profile" showSearch={false} />

      <main className="max-w-md mx-auto px-4 pt-4">
        {editing ? (
          <div className="bg-white rounded-3xl p-5 shadow-card border border-cloud-200/70 space-y-4 animate-pop-in">
            <div className="flex justify-center">
              <ImagePicker
                circular
                value={form.profile_image}
                onChange={(url) => setForm((f) => ({ ...f, profile_image: url }))}
                label="Change photo"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-forest-950 mb-1.5 block">
                {isFarmer ? 'Full Name' : 'Company Name'}
              </label>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            {!isFarmer && (
              <div>
                <label className="text-sm font-medium text-forest-950 mb-1.5 block">Contact Person</label>
                <input
                  className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-forest-950 mb-1.5 block">
                {isFarmer ? 'Village / District' : 'Location'}
              </label>
              <input
                className="w-full px-4 py-3 rounded-2xl border border-cloud-200 bg-cloud-50 focus:bg-white focus:border-forest-400 outline-none"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-cloud-200 text-forest-900/70 font-medium"
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-forest-700 text-white font-medium disabled:opacity-70"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Save
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-5 shadow-card border border-cloud-200/70 animate-slide-up">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center overflow-hidden shrink-0">
                {user?.profile_image ? (
                  <img src={user.profile_image} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-forest-700 font-semibold text-lg">{initials(user?.name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-display font-semibold text-forest-950 text-lg truncate">{user?.name}</p>
                  {isFarmer ? (
                    <Sprout size={15} className="text-forest-600 shrink-0" />
                  ) : (
                    <Building2 size={15} className="text-forest-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs font-medium text-forest-900/40 uppercase tracking-wide mt-0.5">
                  {isFarmer ? 'Farmer' : 'Industry'}
                </p>
              </div>
              <button
                onClick={startEdit}
                className="w-9 h-9 rounded-xl bg-cloud-50 border border-cloud-200 flex items-center justify-center text-forest-700 shrink-0"
                aria-label="Edit profile"
              >
                <Pencil size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-cloud-100">
              <div className="flex items-center gap-2 text-sm text-forest-900/70">
                <Phone size={15} className="text-forest-500 shrink-0" />
                <span className="truncate">{user?.mobile}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-forest-900/70">
                <MapPin size={15} className="text-forest-500 shrink-0" />
                <span className="truncate">{user?.location || 'Not set'}</span>
              </div>
            </div>

            {!isFarmer && user?.contact_person && (
              <p className="text-sm text-forest-900/50 mt-3">Contact: {user.contact_person}</p>
            )}

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-cloud-100">
              <p className="text-sm text-forest-900/50">
                <span className="font-semibold text-forest-950">{posts.length}</span> posts
              </p>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                <LogOut size={15} /> Log out
              </button>
            </div>
          </div>
        )}

        <h2 className="font-display font-semibold text-forest-950 mt-7 mb-3">Your Posts</h2>

        {loadingPosts ? (
          <div className="space-y-3">
            <div className="h-20 rounded-2xl skeleton" />
            <div className="h-20 rounded-2xl skeleton" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={isFarmer ? Sprout : Building2}
            title="No posts yet"
            message={isFarmer ? 'Post your first crop to start getting industry interest.' : 'Post a requirement to start hearing from farmers.'}
          />
        ) : (
          <div className="space-y-2.5">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-cloud-200/70 shadow-card"
              >
                <div className="w-14 h-14 rounded-xl bg-cloud-100 overflow-hidden shrink-0">
                  {post.image && <img src={post.image} alt={post.title} className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-forest-950 text-sm truncate">{post.title}</p>
                  <p className="text-xs text-forest-900/50">
                    {post.crop_name} &middot; {timeAgo(post.created_at)}
                  </p>
                  <p className="text-xs text-forest-900/40 mt-0.5">{post.likes_count} interested</p>
                </div>
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0"
                  aria-label="Delete post"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
