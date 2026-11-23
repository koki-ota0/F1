import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { refreshLive, readStatus } from '../lib/live.js'

const RefreshContext = createContext(null)

/**
 * Manual live-data refresh. Used on static hosts (GitHub Pages) where there is
 * no Express server: pressing 「更新」 fetches calendar + standings straight
 * from the public F1 APIs in the browser and caches them in localStorage.
 */
export function RefreshProvider({ children }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(() => readStatus())
  const [message, setMessage] = useState(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const refresh = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    setBusy(true)
    try {
      const next = await refreshLive()
      setStatus(next)
      const ok = next.okCount
      setMessage(ok === next.results.length ? 'live-all' : ok > 0 ? 'live-partial' : 'offline')
      // pages re-read the cache on navigation; also nudge current consumers
      window.dispatchEvent(new CustomEvent('pitwall:live-refreshed', { detail: next }))
    } catch {
      setMessage('offline')
    } finally {
      setBusy(false)
      timer.current = setTimeout(() => setMessage(null), 6000)
    }
  }, [])

  return (
    <RefreshContext.Provider value={{ busy, status, message, refresh }}>
      {children}
    </RefreshContext.Provider>
  )
}

/** Re-run a loader whenever the navbar 「更新」 button writes new live data. */
export function useLiveRefresh(fn) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const handler = () => ref.current?.()
    window.addEventListener('pitwall:live-refreshed', handler)
    return () => window.removeEventListener('pitwall:live-refreshed', handler)
  }, [])
}

export function useRefresh() {
  const ctx = useContext(RefreshContext)
  if (!ctx) throw new Error('useRefresh must be used within RefreshProvider')
  return ctx
}
