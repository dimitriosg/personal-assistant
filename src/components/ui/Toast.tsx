import { useEffect, useState } from 'react'
import type { Toast as ToastType } from '../../hooks/useToast'
import { ToastContext, useToastProvider } from '../../hooks/useToast'

/* ── Single toast item with slide-in animation ─────────────────────────────── */

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      className={`bg-[#2a2a4a] border border-[#3a3a5a] text-white text-sm
        px-4 py-2 rounded-lg shadow-lg cursor-pointer select-none
        transition-all duration-300 ease-out
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      {toast.message}
    </div>
  )
}

/* ── Toast container — fixed bottom-center ─────────────────────────────────── */

function ToastContainer({ toasts, dismissToast }: { toasts: ToastType[]; dismissToast: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  )
}

/* ── Provider — wrap at top of component tree ──────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, showToast, dismissToast } = useToastProvider()

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  )
}
