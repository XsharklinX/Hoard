import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem { id: number; type: ToastType; message: string }

interface ToastStore {
  toasts: ToastItem[]
  add:    (type: ToastType, message: string) => void
  remove: (id: number) => void
}

let _nextId = 1

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = _nextId++
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => useToastStore.getState().remove(id), 3500)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

export const toast = {
  success: (m: string) => useToastStore.getState().add('success', m),
  error:   (m: string) => useToastStore.getState().add('error', m),
  info:    (m: string) => useToastStore.getState().add('info', m),
}
