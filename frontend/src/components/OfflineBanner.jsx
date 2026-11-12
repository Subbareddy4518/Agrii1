import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'

export default function OfflineBanner() {
  const { t } = useTranslation()
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true)
      setJustReconnected(false)
    }

    function handleOnline() {
      setIsOffline(false)
      setJustReconnected(true)
      const timer = setTimeout(() => {
        setJustReconnected(false)
      }, 3500)
      return () => clearTimeout(timer)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline && !justReconnected) return null

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        aria-live="polite"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 text-xs font-semibold py-2 px-4 shadow-md flex items-center justify-center gap-2 select-none ${
          isOffline
            ? 'bg-amber-600 text-white border-b border-amber-700'
            : 'bg-forest-700 text-white border-b border-forest-800'
        }`}
      >
        {isOffline ? (
          <>
            <WifiOff size={15} className="shrink-0 animate-pulse" />
            <span className="truncate">
              {t('common.offlineNotice', 'You are offline. Showing saved data.')}
            </span>
          </>
        ) : (
          <>
            <Wifi size={15} className="shrink-0 text-emerald-300" />
            <span className="truncate">
              {t('common.reconnectedNotice', 'Back online! Reconnected.')}
            </span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
