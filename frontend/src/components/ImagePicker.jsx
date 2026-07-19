import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadImage } from '../services/api.js'

export default function ImagePicker({ value, onChange, label = 'Add photo', circular = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8MB')
      return
    }
    setUploading(true)
    try {
      const res = await uploadImage(file)
      onChange(res.data.url)
    } catch {
      toast.error('Upload failed. Try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (circular) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative w-24 h-24 rounded-full bg-forest-50 border-2 border-dashed border-forest-300 flex items-center justify-center overflow-hidden active:scale-95 transition-transform"
        >
          {value ? (
            <img src={value} alt="Profile" className="w-full h-full object-cover" />
          ) : uploading ? (
            <Loader2 className="animate-spin text-forest-500" size={22} />
          ) : (
            <Camera className="text-forest-400" size={24} />
          )}
        </button>
        <span className="text-xs text-forest-900/50">{label}</span>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    )
  }

  return (
    <div>
      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-cloud-200 aspect-[4/3]">
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-forest-300 bg-forest-50/50 flex flex-col items-center justify-center gap-2 text-forest-500 active:scale-[0.99] transition-transform"
        >
          {uploading ? <Loader2 className="animate-spin" size={26} /> : <Camera size={26} />}
          <span className="text-sm font-medium">{uploading ? 'Uploading…' : label}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
