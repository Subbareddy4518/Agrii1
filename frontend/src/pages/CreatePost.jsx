import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
    if (!form.title.trim()) return setError(isFarmer ? t('createPost.errors.titleFarmer') : t('createPost.errors.titleIndustry'))
    if (!form.crop_name.trim()) return setError(isFarmer ? t('createPost.errors.cropFarmer') : t('createPost.errors.cropIndustry'))

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
      toast.success(isFarmer ? t('createPost.successToastFarmer') : t('createPost.successToastIndustry'))
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || t('createPost.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  function handleMicClick() {
    toast(t('createPost.voiceComingSoon'), { icon: '🔜' })
  }

  return (
    <div className="min-h-screen pb-28">
      <TopBar
        title={isFarmer ? t('createPost.titleFarmer') : t('createPost.titleIndustry')}
        subtitle={isFarmer ? t('createPost.subtitleFarmer') : t('createPost.subtitleIndustry')}
        showSearch={false}
      />

      <main className="max-w-md mx-auto px-4 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <ImagePicker
            value={form.image}
            onChange={(url) => update('image', url)}
            label={isFarmer ? t('createPost.photoLabelFarmer') : t('createPost.photoLabelIndustry')}
          />

          <div>
            <label className={labelCls}>{isFarmer ? t('createPost.postTitleLabel') : t('createPost.requirementTitleLabel')}</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={isFarmer ? t('createPost.titlePlaceholderFarmer') : t('createPost.titlePlaceholderIndustry')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-forest-950">{t('createPost.descriptionLabel')}</label>
              <button
                type="button"
                onClick={handleMicClick}
                className="flex items-center gap-1 text-xs text-forest-600 bg-forest-50 px-2.5 py-1 rounded-full"
              >
                <Mic size={13} /> {t('createPost.speak')}
              </button>
            </div>
            <textarea
              rows={3}
              className={inputCls}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={isFarmer ? t('createPost.descPlaceholderFarmer') : t('createPost.descPlaceholderIndustry')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isFarmer ? t('createPost.cropNameLabel') : t('createPost.cropNeededLabel')}</label>
              <input
                className={inputCls}
                value={form.crop_name}
                onChange={(e) => update('crop_name', e.target.value)}
                placeholder={t('createPost.cropPlaceholder')}
              />
            </div>
            <div>
              <label className={labelCls}>{isFarmer ? t('createPost.quantityLabel') : t('createPost.quantityRequiredLabel')}</label>
              <input
                className={inputCls}
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                placeholder={t('createPost.quantityPlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isFarmer ? t('createPost.priceLabelFarmer') : t('createPost.priceLabelIndustry')}</label>
              <input
                type="number"
                inputMode="decimal"
                className={inputCls}
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder={t('createPost.pricePlaceholder')}
              />
            </div>
            <div>
              <label className={labelCls}>{isFarmer ? t('createPost.harvestDateLabel') : t('createPost.requiredBeforeLabel')}</label>
              <input
                type="date"
                className={inputCls}
                value={form.target_date}
                onChange={(e) => update('target_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('createPost.locationLabel')}</label>
            <input
              className={inputCls}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder={t('createPost.locationPlaceholder')}
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest-700 hover:bg-forest-800 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : t('createPost.submit')}
          </button>
        </form>
      </main>
    </div>
  )
}
