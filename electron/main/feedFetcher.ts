import { itemQueries, feedQueries } from './db'
import { sendToRenderer } from './window'

// ── Minimal RSS/Atom parser (no external deps) ────────────────────────────────

async function fetchText(feedUrl: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Hoard/1.0 RSS Reader', Accept: 'application/rss+xml,application/atom+xml,text/xml,*/*' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

function xmlText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`, 'i')
  const m = re.exec(block)
  return ((m?.[1] ?? m?.[2]) || '').trim()
}

function xmlAttr(tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i')
  return re.exec(tag)?.[1] ?? ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseDateSec(s: string): number {
  if (!s) return Math.floor(Date.now() / 1000)
  const t = new Date(s).getTime()
  return isNaN(t) ? Math.floor(Date.now() / 1000) : Math.floor(t / 1000)
}

interface ParsedItem { title: string; url: string; content: string; pubDate: number }
interface ParsedFeed { title: string; siteUrl: string; favicon: string | null; items: ParsedItem[] }

function parseRss(xml: string, feedUrl: string): ParsedFeed {
  const channelM = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i)
  const channel  = channelM?.[1] ?? xml
  const title    = xmlText(channel, 'title')
  const link     = xmlText(channel, 'link') || feedUrl
  const items: ParsedItem[] = []
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const b   = m[1]
    const url = xmlText(b, 'link') || (/<link[^/]*\/>/i.exec(b)?.[0] ?? '')
                .replace(/<link[^>]*href="([^"]+)"[^>]*>/i, '$1').trim()
    if (!url.startsWith('http')) continue
    items.push({
      title:   xmlText(b, 'title') || url,
      url:     url.trim(),
      content: stripHtml(xmlText(b, 'description') || xmlText(b, 'content:encoded')).slice(0, 500),
      pubDate: parseDateSec(xmlText(b, 'pubDate') || xmlText(b, 'dc:date'))
    })
  }
  return { title, siteUrl: link, favicon: null, items: items.slice(0, 100) }
}

function parseAtom(xml: string, feedUrl: string): ParsedFeed {
  const title   = xmlText(xml, 'title')
  const linkM   = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i.exec(xml)
               ?? /<link[^>]*href="([^"]+)"[^>]*rel="alternate"/i.exec(xml)
               ?? /<link[^>]*href="([^"]+)"[^>]*/i.exec(xml)
  const siteUrl = linkM?.[1] ?? feedUrl
  const items: ParsedItem[] = []
  const re = /<entry[^>]*>([\s\S]*?)<\/entry>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const b     = m[1]
    const urlM  = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i.exec(b)
               ?? /<link[^>]*href="([^"]+)"[^>]*/i.exec(b)
    const url   = urlM?.[1]
    if (!url || !url.startsWith('http')) continue
    items.push({
      title:   xmlText(b, 'title') || url,
      url:     url.trim(),
      content: stripHtml(xmlText(b, 'summary') || xmlText(b, 'content')).slice(0, 500),
      pubDate: parseDateSec(xmlText(b, 'published') || xmlText(b, 'updated'))
    })
  }
  return { title, siteUrl, favicon: null, items: items.slice(0, 100) }
}

export async function parseFeed(feedUrl: string): Promise<ParsedFeed> {
  const xml = await fetchText(feedUrl)
  const parsed = xml.includes('<feed') && xml.includes('Atom') || xml.includes('<entry>')
    ? parseAtom(xml, feedUrl)
    : parseRss(xml, feedUrl)
  // Try to derive favicon from siteUrl
  try {
    const origin = new URL(parsed.siteUrl).origin
    parsed.favicon = `${origin}/favicon.ico`
  } catch { /* skip */ }
  return parsed
}

// ── Refresh a single feed ─────────────────────────────────────────────────────

export async function refreshFeed(feedId: number): Promise<{ added: number; error?: string }> {
  const feed = feedQueries.get(feedId) as any
  if (!feed) return { added: 0, error: 'Feed not found' }

  try {
    const parsed = await parseFeed(feed.url)

    feedQueries.update(feedId, {
      title:       parsed.title || feed.title,
      siteUrl:     parsed.siteUrl,
      favicon:     parsed.favicon ?? undefined,
      lastFetched: Math.floor(Date.now() / 1000),
      errorCount:  0,
      lastError:   null
    })

    let added = 0
    for (const item of parsed.items) {
      if (!item.url) continue
      if (feedQueries.urlExists(feed.vault_id, item.url)) continue
      itemQueries.create({
        vaultId:      feed.vault_id,
        folderId:     feed.folder_id ?? null,
        type:         'link',
        title:        item.title,
        content:      item.content || undefined,
        url:          item.url,
        favicon:      parsed.favicon ?? undefined,
        readStatus:   'unread',
        sourceFeedId: feedId
      })
      added++
    }

    if (added > 0) {
      sendToRenderer('feed:items-added', { feedId, count: added })
      sendToRenderer('item:refresh', {})
    }

    return { added }
  } catch (err: any) {
    const msg = (err?.message ?? String(err)).slice(0, 200)
    feedQueries.update(feedId, {
      lastFetched: Math.floor(Date.now() / 1000),
      errorCount:  (feed.error_count ?? 0) + 1,
      lastError:   msg
    })
    return { added: 0, error: msg }
  }
}

// ── Background poller ─────────────────────────────────────────────────────────

let _pollInterval: ReturnType<typeof setInterval> | null = null

export function startFeedPoller(): void {
  if (_pollInterval) return
  _pollInterval = setInterval(pollDueFeeds, 5 * 60 * 1000)
  setTimeout(pollDueFeeds, 10_000)
}

export function stopFeedPoller(): void {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null }
}

async function pollDueFeeds(): Promise<void> {
  try {
    const nowSecs  = Math.floor(Date.now() / 1000)
    const allFeeds = feedQueries.getAll() as any[]
    for (const feed of allFeeds) {
      const due = !feed.last_fetched || (nowSecs - feed.last_fetched) >= feed.interval_minutes * 60
      if (due) await refreshFeed(feed.id).catch(console.error)
    }
  } catch (err) {
    console.error('[feed-poller] error:', err)
  }
}
