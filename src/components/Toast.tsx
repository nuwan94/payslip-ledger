import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { IconCheck, IconClose } from './Icons'

type Tone = 'good' | 'bad' | 'info'
interface ToastItem { id: number; text: string; tone: Tone }
type ToastFn = (text: string, tone?: Tone) => void

const Ctx = createContext<ToastFn>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const toast = useCallback<ToastFn>((text, tone = 'info') => {
    const id = ++seq.current
    setItems((l) => [...l, { id, text, tone }])
    window.setTimeout(() => dismiss(id), tone === 'bad' ? 6000 : 3500)
  }, [dismiss])

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'good' && <IconCheck />}
            <span>{t.text}</span>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(t.id)}><IconClose /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
