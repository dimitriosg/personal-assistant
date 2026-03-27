import { createContext, useContext, useState, useCallback, useRef } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number // default 3000ms
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (opts: { message: string; type: Toast['type']; duration?: number }) => void
  dismissToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
})

export function useToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const showToast = useCallback(
    (opts: { message: string; type: Toast['type']; duration?: number }) => {
      const id = crypto.randomUUID()
      const duration = opts.duration ?? 3000
      const toast: Toast = { id, message: opts.message, type: opts.type, duration }
      setToasts(prev => [...prev, toast])
      const timer = setTimeout(() => {
        dismissToast(id)
      }, duration)
      timersRef.current.set(id, timer)
    },
    [dismissToast],
  )

  return { toasts, showToast, dismissToast }
}

export function useToast() {
  return useContext(ToastContext)
}
