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

export function formatRelativeDate(unixSecs: number): string {
  const diffMs    = Date.now() - unixSecs * 1000
  const diffMins  = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays  = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears  = Math.floor(diffDays / 365)

  if (diffMins  <  1) return 'just now'
  if (diffMins  < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays  ===1) return 'yesterday'
  if (diffDays  <  7) return `${diffDays}d ago`
  if (diffWeeks <  5) return `${diffWeeks}w ago`
  if (diffMonths< 12) return `${diffMonths}mo ago`
  return `${diffYears}y ago`
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
