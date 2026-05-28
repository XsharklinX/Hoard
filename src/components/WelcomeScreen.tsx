import { useState } from 'react'
import { Link as LinkIcon, FileText, Image as ImageIcon, Code2, Shield, Wifi, Puzzle, ArrowRight, Zap, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface WelcomeScreenProps {
  onComplete: () => void
}

const STEPS = 3

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState(0)

  const next = () => {
    if (step < STEPS - 1) setStep(step + 1)
    else onComplete()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-lg mx-4">
        {/* Skip */}
        <button
          onClick={onComplete}
          className="absolute -top-10 right-0 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Skip intro
        </button>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-surface shadow-2xl shadow-black/80 overflow-hidden">
          {/* Progress bar */}
          <div className="h-0.5 bg-border">
            <div
              className="h-0.5 bg-gold transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / STEPS) * 100}%` }}
            />
          </div>

          <div className="p-8 min-h-[420px] flex flex-col">
            {step === 0 && <StepWelcome />}
            {step === 1 && <StepFeatures />}
            {step === 2 && <StepExtension />}

            {/* Footer */}
            <div className="mt-auto pt-6 flex items-center justify-between">
              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: STEPS }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={cn(
                      'rounded-full transition-all duration-300',
                      i === step ? 'w-5 h-1.5 bg-gold' : 'w-1.5 h-1.5 bg-border hover:bg-text-muted'
                    )}
                  />
                ))}
              </div>

              {/* Next / Get Started */}
              <button
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors"
              >
                {step < STEPS - 1 ? (
                  <><span>Continue</span><ArrowRight className="w-4 h-4" /></>
                ) : (
                  <><span>Start hoarding</span><Zap className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 0: Hero ──────────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center gap-5 flex-1 justify-center">
      {/* Logo */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center shadow-lg shadow-gold/10">
          <img
            src={new URL('../assets/icon.png', import.meta.url).href}
            alt="Hoard"
            className="w-12 h-12 object-contain drop-shadow-lg"
          />
        </div>
        <div className="absolute -inset-3 rounded-3xl bg-gold/5 blur-xl -z-10" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Welcome to <span className="text-gold">Hoard</span>
        </h1>
        <p className="text-base text-text-secondary leading-relaxed max-w-xs">
          Your personal digital collection. Links, notes, images and code — all saved locally on your machine.
        </p>
      </div>

      {/* Value props */}
      <div className="flex items-center gap-6 mt-2">
        <Prop icon={<Shield className="w-4 h-4" />} label="100% local" />
        <Prop icon={<Wifi className="w-4 h-4" />} label="Works offline" />
        <Prop icon={<Zap className="w-4 h-4" />} label="Instant search" />
      </div>
    </div>
  )
}

function Prop({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
        {icon}
      </div>
      <span className="text-[11px] text-text-muted font-medium">{label}</span>
    </div>
  )
}

// ── Step 1: Features ──────────────────────────────────────────────────────────

function StepFeatures() {
  const features = [
    {
      icon: <LinkIcon className="w-5 h-5" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      label: 'Links',
      desc: 'Save any URL with automatic title, favicon, reading time and full-page archive.'
    },
    {
      icon: <FileText className="w-5 h-5" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      label: 'Notes',
      desc: 'Rich text notes with headers, lists, tasks, inline code and links between items.'
    },
    {
      icon: <ImageIcon className="w-5 h-5" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      label: 'Images',
      desc: 'Store images locally with automatic OCR — the text inside images becomes searchable.'
    },
    {
      icon: <Code2 className="w-5 h-5" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      label: 'Code',
      desc: 'Save code snippets with syntax highlighting for any language.'
    }
  ]

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-text-primary">What you can save</h2>
        <p className="text-sm text-text-muted">Four types, one search.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {features.map((f) => (
          <div key={f.label} className={cn('flex flex-col gap-2 p-3 rounded-xl border', f.bg)}>
            <div className={cn('flex items-center gap-2', f.color)}>
              {f.icon}
              <span className="text-sm font-semibold text-text-primary">{f.label}</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 text-xs text-text-muted bg-card/60 rounded-lg px-3 py-2">
        <Zap className="w-3 h-3 text-gold shrink-0" />
        Use <kbd className="mx-1 px-1.5 py-0.5 rounded bg-border text-text-secondary font-mono text-[10px]">Ctrl+N</kbd> or the <strong className="text-text-secondary">+ New</strong> button to add anything.
      </div>
    </div>
  )
}

// ── Step 2: Extension + Privacy ───────────────────────────────────────────────

function StepExtension() {
  return (
    <div className="flex flex-col gap-5 flex-1">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-text-primary">Save from anywhere</h2>
        <p className="text-sm text-text-muted">The browser extension makes it instant.</p>
      </div>

      {/* Extension card */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border">
        <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
          <Puzzle className="w-5 h-5 text-gold" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-text-primary">Save to Hoard</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Right-click any link, image or page → <strong className="text-text-secondary">Save to Hoard</strong>.
            Or press <kbd className="px-1 py-0.5 rounded bg-border text-text-secondary text-[10px] font-mono">Alt+S</kbd> for the quick popup.
          </p>
          <p className="text-[11px] text-text-muted mt-1">
            Load it in Chrome/Edge via Settings → Browser Extension
          </p>
        </div>
      </div>

      {/* Privacy callout */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
        <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-emerald-300">Your data, your machine</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Everything stays on your computer. No cloud, no account, no tracking. Optional encryption for extra peace of mind.
          </p>
        </div>
      </div>

      {/* First step callout */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gold/5 border border-gold/20">
        <div className="w-6 h-6 rounded-full bg-gold text-black flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">1</div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-text-primary">Create your first vault</p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            A vault is your top-level container. After this screen, click <strong className="text-gold">+ New vault</strong> in the sidebar to get started.
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-auto flex flex-col gap-1.5">
        <p className="text-[11px] text-text-muted uppercase tracking-widest font-semibold">Quick tips</p>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-text-muted">
          <Tip keys="Ctrl+K" label="Command palette" />
          <Tip keys="Ctrl+N" label="New item" />
          <Tip keys="Ctrl+," label="Settings" />
          <Tip keys="?" label="Shortcuts cheatsheet" />
        </div>
      </div>
    </div>
  )
}

function Tip({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-card/60 rounded-lg px-2.5 py-1.5">
      <kbd className="px-1.5 py-0.5 rounded bg-border text-text-secondary font-mono text-[10px]">{keys}</kbd>
      <span>{label}</span>
    </div>
  )
}
