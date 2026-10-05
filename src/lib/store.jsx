import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { seed } from './seed'

const KEY = 'soudoc-escalas-v2'
const Ctx = createContext(null)

const load = () => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* sem storage */
  }
  return seed()
}

export function StoreProvider({ children }) {
  const [db, setDb] = useState(load)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* ignore */
    }
  }, [db])

  const notify = useCallback((msg, tipo = 'ok') => {
    const id = Date.now() + Math.random()
    setToast({ msg, tipo, id })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200)
  }, [])

  const update = useCallback(
    (fn) =>
      setDb((prev) => {
        const next = structuredClone(prev)
        return fn(next) || next
      }),
    [],
  )
  const reset = () => setDb(seed())

  return <Ctx.Provider value={{ db, update, reset, notify, toast }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useStore = () => useContext(Ctx)
