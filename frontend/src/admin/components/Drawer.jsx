import { X } from 'lucide-react'

export default function Drawer({ open, title, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-float flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 h-16 border-b border-cloud-200 shrink-0">
          <h2 className="font-display font-semibold text-forest-950 text-lg truncate">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-forest-900/60 hover:bg-cloud-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
