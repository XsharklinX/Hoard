import { create } from 'zustand'

interface ConfirmState {
  open:     boolean
  message:  string
  _resolve: ((v: boolean) => void) | null
  show:     (message: string) => Promise<boolean>
  accept:   () => void
  cancel:   () => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false, message: '', _resolve: null,
  show: (message) => new Promise<boolean>((resolve) => {
    set({ open: true, message, _resolve: resolve })
  }),
  accept: () => { get()._resolve?.(true);  set({ open: false, _resolve: null }) },
  cancel: () => { get()._resolve?.(false); set({ open: false, _resolve: null }) },
}))

export const confirm = (message: string) => useConfirmStore.getState().show(message)
