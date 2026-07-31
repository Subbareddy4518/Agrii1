// `t` is the i18next translation function from useTranslation(). It's
// optional so any code that hasn't been touched keeps working exactly
// as before (falls back to the original English strings), but every
// call site in this app now passes it so relative times translate
// along with everything else.
export function timeAgo(dateString, t) {
  const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z')
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return t ? t('time.justNow') : 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t ? t('time.minutesAgo', { count: minutes }) : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t ? t('time.hoursAgo', { count: hours }) : `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return t ? t('time.daysAgo', { count: days }) : `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return t ? t('time.weeksAgo', { count: weeks }) : `${weeks}w ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
