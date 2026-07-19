import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import TopBar from '../components/TopBar.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createPost } from '../services/api.js'

const inputCls =
  'w-full px-4 py-3.5 rounded-2xl border border-cloud-200 bg-white focus:border-forest-400 focus:ring-4 focus:ring-forest-100 outline-none transition-all text-[15px]'
const labelCls = 'text-sm font-medium text-forest-950 mb-1.5 block'

export default function CreatePost() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isFarmer = user?.role === 'farmer'

  const [form, setForm] = useState({
    title: '',
    description: '',
    crop_name: '',
    quantity: '',
    price: '',
    location: user?.location || '',
    target_date: '',
    image: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) return setError(isFarmer ? 'Add a short description title for your crop' : 'Add a requirement title')
    if (!form.crop_name.trim()) return setError(isFarmer ? 'Enter the crop name' : 'Enter the crop you need')

    setLoading(true)
    try {
      await createPost({
        title: form.title.trim(),
        description: form.description.trim() || null,
        crop_name: form.crop_name.trim(),
        quantity: form.quantity.trim() || null,
        price: form.price ? parseFloat(form.price) : null,
        location: form.location.trim() || null,
        target_date: form.target_date || null,
        image: form.image,
      })
      toast.success(isFarmer ? 'Crop posted! Industries will see it now.' : 'Requirement posted! Farmers will see it now.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create post. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleMicClick() {
    toast('Voice input is coming soon 🎙️', { icon: '🔜' })
  }

  return (
    <div className="min-h-screen pb-28">
      <TopBar
        title={isFarmer ? 'Post Your Crop' : 'Post a Requirement'}
        subtitle={isFarmer ? 'Let industries find you' : 'Let farmers find you'}
        showSearch={false}
      />

      <main className="max-w-md mx-auto px-4 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ImagePicker
            value={form.image}
            onChange={(url) => update('image', url)}
            label={isFarmer ? 'Add crop photo' : 'Add photo (optional)'}
          />

          <div>
            <label className={labelCls}>{isFarmer ? 'Post Title' : 'Requirement Title'}</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={isFarmer ? 'e.g. Fresh Organic Tomatoes' : 'e.g. Need 2 Tons of Cotton'}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-forest-950">Description</label>
              <button
                type="button"
                onClick={handleMicClick}
                className="flex items-center gap-1 text-xs text-forest-600 bg-forest-50 px-2.5 py-1 rounded-full"
              >
                <Mic size={13} /> Speak
              </button>
            </div>
            <textarea
              rows={3}
              className={inputCls}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={isFarmer ? 'Describe your crop quality, harvest details, etc.' : 'Describe your requirement in detail'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isFarmer ? 'Crop Name' : 'Crop Needed'}</label>
              <input
                className={inputCls}
                value={form.crop_name}
                onChange={(e) => update('crop_name', e.target.value)}
                placeholder="e.g. Tomato"
              />
            </div>
            <div>
              <label className={labelCls}>{isFarmer ? 'Quantity' : 'Quantity Required'}</label>
              <input
                className={inputCls}
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                placeholder="e.g. 500 kg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isFarmer ? 'Expected Price (₹)' : 'Price Offered (₹)'}</label>
              <input
                type="number"
                inputMode="decimal"
                className={inputCls}
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="per unit"
              />
            </div>
            <div>
              <label className={labelCls}>{isFarmer ? 'Harvest Date' : 'Required Before'}</label>
              <input
                type="date"
                className={inputCls}
                value={form.target_date}
                onChange={(e) => update('target_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Location</label>
            <input
              className={inputCls}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="Village / District"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Submit'}
          </button>
        </form>
      </main>
    </div>
  )
}
