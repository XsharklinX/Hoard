import * as Dialog from '@radix-ui/react-dialog'
import { useConfirmStore } from '../lib/confirm'
import { useT } from '../i18n'

export function ConfirmDialog() {
  const { open, message, accept, cancel } = useConfirmStore()
  const t = useT()

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) cancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-[151] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-surface border border-border rounded-2xl shadow-2xl p-6 focus:outline-none"
          onEscapeKeyDown={cancel}
        >
          <Dialog.Description className="text-sm text-text-primary leading-relaxed mb-5">
            {message}
          </Dialog.Description>
          <div className="flex justify-end gap-2">
            <button
              onClick={cancel}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-card hover:text-text-primary transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={accept}
              autoFocus
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              {t.confirmDelete}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
