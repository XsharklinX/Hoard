import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useToastStore } from '../lib/toast'
import { cn } from '../lib/utils'

export function Toaster() {
  const { toasts, remove } = useToastStore()
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 rounded-xl shadow-2xl border text-sm font-medium pointer-events-auto',
            'transition-all duration-200',
            t.type === 'success' && 'bg-surface border-emerald-500/30 text-emerald-300',
            t.type === 'error'   && 'bg-surface border-red-500/30 text-red-300',
            t.type === 'info'    && 'bg-surface border-blue-500/30 text-blue-300'
          )}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {t.type === 'error'   && <XCircle      className="w-4 h-4 shrink-0" />}
          {t.type === 'info'    && <Info         className="w-4 h-4 shrink-0" />}
          <span className="max-w-xs">{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="ml-1 p-0.5 opacity-50 hover:opacity-100 transition-opacity shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
