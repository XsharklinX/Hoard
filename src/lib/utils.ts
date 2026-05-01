import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len) + '…'
}

// Converts a native file path (Windows or Unix) to a valid hoard:// URL
export function toFileUrl(filePath: string): string {
  const forward = filePath.replace(/\\/g, '/')
  return forward.startsWith('/') ? `hoard://${forward}` : `hoard:///${forward}`
}

export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}
