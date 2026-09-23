import { useCallback, useEffect, useState } from 'react'
import { ApiError, type BackendStatus, type Client, type Deck } from '../api'

export type Conn = 'connecting' | 'connected' | 'error'

/**
 * The backend connection and the deck list: connect (with retries while the
 * backend starts), the registered folders, the decks found in them, the
 * selected deck, and the quiet 10-second re-scan.
 */
export function useConnection(client: Client) {
  const [conn, setConn] = useState<Conn>('connecting')
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [roots, setRoots] = useState<string[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Sidebar section overrides while a deck is picked; null = leave the section's own persisted state alone.
  const [decksForce, setDecksForce] = useState<boolean | null>(null)
  const [slidesForce, setSlidesForce] = useState<boolean | null>(null)

  const selected = decks.find((d) => d.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await client.decks()
      setRoots(res.roots)
      setDecks(res.decks)
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed')
    } finally {
      setLoading(false)
    }
  }, [client])

  // Connect to the backend. Right after the app is (re)enabled the backend is
  // still starting, so the first /status can fail: keep retrying until it
  // answers, and only then load the deck list. Nothing renders half-loaded.
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    const connect = async () => {
      if (!alive) return
      try {
        const res = await client.status()
        if (!alive) return
        setStatus(res)
        setConn('connected')
        await refresh()
      } catch {
        if (!alive) return
        setConn(attempt === 0 ? 'connecting' : 'error')
        attempt += 1
        timer = setTimeout(connect, Math.min(1000 * attempt, 5000))
      }
    }
    void connect()
    const onFocus = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
        void connect()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [client, refresh])

  // The deck list re-scans by itself (a deck folder created elsewhere shows up
  // without a button), quietly: no loading state, errors ignored.
  useEffect(() => {
    if (conn !== 'connected') return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void client
        .decks()
        .then((res) => {
          setRoots(res.roots)
          setDecks((cur) => (JSON.stringify(cur.map((d) => [d.id, d.slideCount, d.modifiedAt])) === JSON.stringify(res.decks.map((d) => [d.id, d.slideCount, d.modifiedAt])) ? cur : res.decks))
        })
        .catch(() => undefined)
    }, 10000)
    return () => clearInterval(id)
  }, [client, conn])

  const addRoot = useCallback(
    async (path?: string) => {
      setError(null)
      setErrorDetail(null)
      setLoading(true)
      try {
        if (path) {
          const res = await client.addRoot(path)
          setRoots(res.roots)
        } else {
          // The OS dialog may stay open far longer than the gateway proxy allows
          // a single request to take, so start it and poll for the outcome.
          const start = await client.pickStart()
          let st = start
          while (st.state === 'pending') {
            await new Promise((r) => setTimeout(r, 700))
            st = await client.pickStatus(start.id)
          }
          if (st.state === 'cancelled') return
          if (st.state === 'error') throw new ApiError(st.error ?? 'folder_chooser_failed', st.detail)
          setRoots(st.roots ?? [])
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'request_failed')
        setErrorDetail(e instanceof ApiError ? e.message : String(e))
        return
      } finally {
        setLoading(false)
      }
      await refresh()
    },
    [client, refresh],
  )

  const removeRoot = useCallback(
    async (path: string) => {
      setError(null)
      setLoading(true)
      try {
        const res = await client.removeRoot(path)
        setRoots(res.roots)
        setDecks((prev) => prev.filter((d) => d.root !== path))
        if (selected && selected.root === path) setSelectedId(null)
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'request_failed')
        return
      } finally {
        setLoading(false)
      }
      await refresh()
    },
    [client, refresh, selected],
  )

  const selectDeck = (deck: Deck) => {
    setSelectedId(deck.id)
    // Selecting a deck hands the sidebar over to its slides.
    setDecksForce(false)
    setSlidesForce(true)
    // Release the override so the user can toggle freely afterwards.
    setTimeout(() => {
      setDecksForce(null)
      setSlidesForce(null)
    }, 0)
  }

  return {
    conn,
    status,
    roots,
    decks,
    setDecks,
    loading,
    error,
    errorDetail,
    selectedId,
    selected,
    decksForce,
    slidesForce,
    refresh,
    addRoot,
    removeRoot,
    selectDeck,
  }
}
