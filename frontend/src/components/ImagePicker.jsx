import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { uploadImage } from '../services/api.js'
import { compressCropImage, isImageFile } from '../utils/imageOptimizer.js'

export default function ImagePicker({ value, onChange, label, circular = false }) {
  const inputRef = useRef(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const { t } = useTranslation()
  const resolvedLabel = label || t('common.addPhoto', 'Add photo')

  const isBusy = isOptimizing || uploading

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isImageFile(file)) {
      toast.error(t('common.invalidImageFormat', 'Please select a valid image (JPG, PNG, WEBP, BMP, GIF).'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('common.imageSizeError', 'Image is too large. Please choose an image under 20MB.'))
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    try {
      setIsOptimizing(true)
      const optimizedFile = await compressCropImage(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.8,
      })
      setIsOptimizing(false)

      setUploading(true)
      const res = await uploadImage(optimizedFile)
      onChange(res.data.url)
    } catch (err) {
      if (err?.code === 'INVALID_FORMAT') {
        toast.error(t('common.invalidImageFormat', 'Please select a valid image (JPG, PNG, WEBP, BMP, GIF).'))
      } else {
        toast.error(t('common.uploadFailed', 'Failed to upload photo. Please check your connection and try again.'))
      }
    } finally {
      setIsOptimizing(false)
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const statusText = isOptimizing
    ? t('common.optimizingImage', 'Optimizing photo…')
    : uploading
    ? t('common.uploading', 'Uploading…')
    : resolvedLabel

  if (circular) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          aria-label={resolvedLabel}
          className="relative w-24 h-24 rounded-full bg-forest-50 border-2 border-dashed border-forest-300 flex items-center justify-center overflow-hidden active:scale-95 transition-transform disabled:opacity-75 focus:outline-none focus:ring-4 focus:ring-forest-200"
        >
          {value ? (
            <img src={value} alt={t('common.profileAlt', 'Profile')} className="w-full h-full object-cover" />
          ) : isBusy ? (
            <Loader2 className="animate-spin text-forest-500" size={24} />
          ) : (
            <Camera className="text-forest-400" size={24} />
          )}
        </button>
        <span className="text-xs text-forest-900/60 font-medium text-center">{statusText}</span>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    )
  }

  return (
    <div>
      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-cloud-200 aspect-[4/3]">
          <img src={value} alt={t('common.previewAlt', 'Preview')} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t('common.delete', 'Remove photo')}
            className="absolute top-2.5 right-2.5 w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center shadow-md active:scale-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          aria-label={resolvedLabel}
          className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-forest-300 bg-forest-50/50 flex flex-col items-center justify-center gap-2 text-forest-600 active:scale-[0.99] transition-transform disabled:opacity-75 focus:outline-none focus:ring-4 focus:ring-forest-200"
        >
          {isBusy ? <Loader2 className="animate-spin text-forest-500" size={28} /> : <Camera size={28} />}
          <span className="text-sm font-medium">{statusText}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
