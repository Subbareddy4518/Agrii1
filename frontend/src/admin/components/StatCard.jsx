export default function StatCard({ icon: Icon, label, value, tint = 'forest' }) {
  const tints = {
    forest: 'bg-forest-50 text-forest-700',
    harvest: 'bg-harvest-400/15 text-harvest-600',
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-cloud-200 shadow-card p-4 sm:p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tints[tint] || tints.forest}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-display font-semibold text-forest-950 leading-tight">
          {value}
        </p>
        <p className="text-xs text-forest-900/50 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
