import { useState, useRef, useEffect } from 'react'
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

interface LockScreenProps {
  onUnlock: (password: string) => Promise<boolean>
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const inputRef                  = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    const ok = await onUnlock(password)
    if (!ok) {
      setError('Wrong password. Try again.')
      setPassword('')
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20">
          <Lock className="w-7 h-7 text-gold" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-text-primary mb-1">Hoard is locked</h1>
          <p className="text-sm text-text-muted">Enter your master password to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Master password"
              autoComplete="current-password"
              className={cn(
                'w-full px-4 py-3 pr-11 rounded-xl bg-card border text-sm text-text-primary placeholder-text-muted',
                'focus:outline-none focus:ring-1 transition-colors',
                error
                  ? 'border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50'
                  : 'border-border focus:ring-gold/30 focus:border-gold/50'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center -mt-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold-light active:bg-gold-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
