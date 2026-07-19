export default function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl shadow-card border border-cloud-200/70 overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-11 h-11 rounded-full skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded skeleton" />
          <div className="h-2.5 w-20 rounded skeleton" />
        </div>
      </div>
      <div className="w-full aspect-[4/3] skeleton" />
      <div className="px-4 pt-3 pb-4 space-y-2">
        <div className="h-3.5 w-3/4 rounded skeleton" />
        <div className="h-3 w-full rounded skeleton" />
        <div className="h-3 w-1/2 rounded skeleton" />
        <div className="flex gap-2 pt-2">
          <div className="h-10 flex-1 rounded-2xl skeleton" />
          <div className="h-10 flex-1 rounded-2xl skeleton" />
          <div className="h-10 w-11 rounded-2xl skeleton" />
        </div>
      </div>
    </div>
  )
}
