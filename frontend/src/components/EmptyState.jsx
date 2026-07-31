export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-pop-in">
      <div className="w-16 h-16 rounded-3xl bg-forest-50 flex items-center justify-center mb-4">
        {Icon && <Icon size={28} className="text-forest-500" />}
      </div>
      <p className="font-display font-semibold text-forest-950 text-lg">{title}</p>
      {message && <p className="text-sm text-forest-900/50 mt-1.5 max-w-xs">{message}</p>}
      {action}
    </div>
  )
}
