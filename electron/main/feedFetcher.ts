import Parser from 'rss-parser'
import { itemQueries, feedQueries } from './db'
import { sendToRenderer } from './window'

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Hoard/1.0 (RSS Reader)' }
})

export interface ParsedFeedItem {
  title: string
  url: string
  content: string
  pubDate: number
}

export interface ParsedFeed {
  title: string
  siteUrl: string
  favicon: string | null
  items: ParsedFeedItem[]
}

async function fetchFavicon(siteUrl: string): Promise<string | null> {
  try {
    const origin = new URL(siteUrl).origin
    return `${origin}/favicon.ico`
  } catch {
    return null
  }
}

export async function parseFeed(feedUrl: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(feedUrl)
  const siteUrl = feed.link ?? feedUrl
  const favicon = feed.image?.url ?? await fetchFavicon(siteUrl)

  const items: ParsedFeedItem[] = (feed.items ?? []).slice(0, 100).map((item) => {
    const rawDate = item.pubDate ?? item.isoDate ?? null
    const pubDate = rawDate ? Math.floor(new Date(rawDate).getTime() / 1000) : Math.floor(Date.now() / 1000)
    const content = item.contentSnippet ?? item.content ?? item.summary ?? ''
    return {
      title:   item.title ?? item.link ?? 'Untitled',
      url:     item.link  ?? '',
      content: content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
      pubDate
    }
  }).filter((i) => i.url)

  return {
    title:   feed.title ?? new URL(feedUrl).hostname,
    siteUrl,
    favicon: favicon ?? null,
    items
  }
}

export async function refreshFeed(feedId: number): Promise<{ added: number; error?: string }> {
  const feed = feedQueries.get(feedId) as any
  if (!feed) return { added: 0, error: 'Feed not found' }

  try {
    const parsed = await parseFeed(feed.url)

    // Update feed metadata on first fetch or if title changed
    feedQueries.update(feedId, {
      title:       parsed.title,
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
    const msg = err?.message ?? String(err)
    feedQueries.update(feedId, {
      lastFetched: Math.floor(Date.now() / 1000),
      errorCount:  (feed.error_count ?? 0) + 1,
      lastError:   msg.slice(0, 200)
    })
    return { added: 0, error: msg }
  }
}

let _pollInterval: ReturnType<typeof setInterval> | null = null

export function startFeedPoller(): void {
  if (_pollInterval) return
  // Check every 5 minutes which feeds are due
  _pollInterval = setInterval(pollDueFeeds, 5 * 60 * 1000)
  // Also run once shortly after startup
  setTimeout(pollDueFeeds, 10_000)
}

export function stopFeedPoller(): void {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null }
}

async function pollDueFeeds(): Promise<void> {
  try {
    const allFeeds = feedQueries.getAll() as any[]
    for (const feed of allFeeds) {
      const nowSecs = Math.floor(Date.now() / 1000)
      const due = !feed.last_fetched || (nowSecs - feed.last_fetched) >= feed.interval_minutes * 60
      if (due) {
        await refreshFeed(feed.id).catch(console.error)
      }
    }
  } catch (err) {
    console.error('[feed-poller] error:', err)
  }
}
