import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import { getNotifications } from '../services/api.js'

export default function Layout() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const res = await getNotifications()
        if (active) setUnreadCount(res.data.filter((n) => !n.is_read).length)
      } catch {
        /* silent - non-critical */
      }
    }
    poll()
    const id = setInterval(poll, 30000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="min-h-screen bg-cloud-50">
      <Outlet context={{ refreshUnread: () => setUnreadCount(0) }} />
      <BottomNav unreadCount={unreadCount} />
    </div>
  )
}
