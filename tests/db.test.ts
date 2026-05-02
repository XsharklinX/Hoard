/**
 * DB unit tests — run against a real in-memory sql.js instance.
 * Electron's `app` is mocked so tests run outside Electron.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import path from 'path'
import fs from 'fs'

// ── Mock Electron APIs ────────────────────────────────────────────────────────
const TMP_DIR = path.join(process.cwd(), '.test-tmp')
fs.mkdirSync(TMP_DIR, { recursive: true })

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return TMP_DIR
      return TMP_DIR
    },
    getAppPath: () => process.cwd(),
    isPackaged: false
  }
}))

// ── Import after mocks ────────────────────────────────────────────────────────
import { initDb, vaultQueries, folderQueries, itemQueries, tagQueries, saveDb } from '../electron/main/db'

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Remove stale test DB so each run starts fresh
  const dbFile = path.join(TMP_DIR, 'hoard.db')
  if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile)
  await initDb()
})

afterEach(() => {
  // Nothing — tests share state intentionally to test sequential operations
})

// ── Vaults ────────────────────────────────────────────────────────────────────
describe('vaults', () => {
  it('seeds a default vault on first init', () => {
    const vaults = vaultQueries.list()
    expect(vaults).toHaveLength(1)
    expect((vaults[0] as { name: string }).name).toBe('My Hoard')
  })

  it('creates a new vault', () => {
    const vault = vaultQueries.create('Work', '#ff0000') as { id: number; name: string; color: string }
    expect(vault.id).toBeGreaterThan(0)
    expect(vault.name).toBe('Work')
    expect(vault.color).toBe('#ff0000')
  })

  it('updates a vault', () => {
    const vaults = vaultQueries.list() as Array<{ id: number; name: string; color: string }>
    const v = vaults[0]
    const updated = vaultQueries.update(v.id, 'Renamed', '#00ff00') as { name: string; color: string }
    expect(updated.name).toBe('Renamed')
    expect(updated.color).toBe('#00ff00')
  })

  it('deletes a vault', () => {
    const before = vaultQueries.list() as Array<{ id: number }>
    const last = before[before.length - 1]
    vaultQueries.delete(last.id)
    const after = vaultQueries.list() as Array<{ id: number }>
    expect(after.find((v) => v.id === last.id)).toBeUndefined()
  })
})

// ── Folders ───────────────────────────────────────────────────────────────────
describe('folders', () => {
  let vaultId: number

  beforeAll(() => {
    const vaults = vaultQueries.list() as Array<{ id: number }>
    vaultId = vaults[0].id
  })

  it('creates a root folder', () => {
    const folder = folderQueries.create(vaultId, 'Recipes') as { id: number; name: string; parent_id: number | null }
    expect(folder.name).toBe('Recipes')
    expect(folder.parent_id).toBeNull()
  })

  it('creates a nested folder', () => {
    const parent = folderQueries.create(vaultId, 'Parent') as { id: number }
    const child  = folderQueries.create(vaultId, 'Child', parent.id) as { parent_id: number }
    expect(child.parent_id).toBe(parent.id)
  })

  it('updates folder name and smart_query', () => {
    const folder = folderQueries.create(vaultId, 'Old') as { id: number }
    const query = JSON.stringify({ type: 'link' })
    const updated = folderQueries.update(folder.id, 'New', query) as { name: string; smart_query: string }
    expect(updated.name).toBe('New')
    expect(updated.smart_query).toBe(query)
  })

  it('lists folders for vault', () => {
    const list = folderQueries.list(vaultId) as Array<{ vault_id: number }>
    expect(list.every((f) => f.vault_id === vaultId)).toBe(true)
  })
})

// ── Items ─────────────────────────────────────────────────────────────────────
describe('items', () => {
  let vaultId: number

  beforeAll(() => {
    const vaults = vaultQueries.list() as Array<{ id: number }>
    vaultId = vaults[0].id
  })

  it('creates a link item', () => {
    const item = itemQueries.create({
      vaultId,
      type: 'link',
      title: 'Example',
      url: 'https://example.com',
      content: 'A useful site',
      readingTime: 3
    }) as { id: number; type: string; title: string; url: string; tags: unknown[] }
    expect(item.id).toBeGreaterThan(0)
    expect(item.type).toBe('link')
    expect(item.title).toBe('Example')
    expect(item.url).toBe('https://example.com')
    expect(item.tags).toEqual([])
  })

  it('creates a note item', () => {
    const item = itemQueries.create({ vaultId, type: 'note', content: '<p>Hello world</p>' }) as { type: string; content: string }
    expect(item.type).toBe('note')
    expect(item.content).toBe('<p>Hello world</p>')
  })

  it('creates a code item with language', () => {
    const item = itemQueries.create({ vaultId, type: 'code', content: 'console.log("hi")', codeLang: 'javascript' }) as { code_lang: string }
    expect(item.code_lang).toBe('javascript')
  })

  it('updates item title and content', () => {
    const created = itemQueries.create({ vaultId, type: 'note', content: 'old' }) as { id: number }
    const updated = itemQueries.update(created.id, { title: 'Updated', content: 'new' }) as { title: string; content: string }
    expect(updated.title).toBe('Updated')
    expect(updated.content).toBe('new')
  })

  it('sets archive_status', () => {
    const item = itemQueries.create({ vaultId, type: 'link', url: 'https://test.com' }) as { id: number }
    const updated = itemQueries.update(item.id, { archiveStatus: 'done' }) as { archive_status: string }
    expect(updated.archive_status).toBe('done')
  })

  it('pins and unpins an item', () => {
    const item = itemQueries.create({ vaultId, type: 'note', content: 'pin test' }) as { id: number }
    itemQueries.pin(item.id, true)
    const list = itemQueries.list({ vaultId }) as Array<{ id: number; is_pinned: number }>
    const found = list.find((i) => i.id === item.id)
    expect(found?.is_pinned).toBe(1)
    itemQueries.pin(item.id, false)
    const list2 = itemQueries.list({ vaultId }) as Array<{ id: number; is_pinned: number }>
    expect(list2.find((i) => i.id === item.id)?.is_pinned).toBe(0)
  })

  it('pinned items appear first in list', () => {
    const a = itemQueries.create({ vaultId, type: 'note', content: 'a' }) as { id: number }
    const b = itemQueries.create({ vaultId, type: 'note', content: 'b' }) as { id: number }
    itemQueries.pin(b.id, true)
    const list = itemQueries.list({ vaultId }) as Array<{ id: number; is_pinned: number }>
    const pinnedFirst = list[0]
    expect(pinnedFirst.is_pinned).toBe(1)
  })

  it('full-text search returns matching items', () => {
    itemQueries.create({ vaultId, type: 'link', title: 'Vitest Guide', url: 'https://vitest.dev', content: 'testing framework' })
    const results = itemQueries.list({ vaultId, search: 'vitest' }) as Array<{ title: string }>
    expect(results.some((r) => r.title?.toLowerCase().includes('vitest'))).toBe(true)
  })

  it('search returns empty for no match', () => {
    const results = itemQueries.list({ vaultId, search: 'xyznosuchterm99999' })
    expect(results).toHaveLength(0)
  })

  it('filters by type', () => {
    const results = itemQueries.list({ vaultId, type: 'code' }) as Array<{ type: string }>
    expect(results.every((i) => i.type === 'code')).toBe(true)
  })

  it('deletes an item', () => {
    const item = itemQueries.create({ vaultId, type: 'note', content: 'to delete' }) as { id: number }
    itemQueries.delete(item.id)
    const list = itemQueries.list({ vaultId }) as Array<{ id: number }>
    expect(list.find((i) => i.id === item.id)).toBeUndefined()
  })
})

// ── Tags ──────────────────────────────────────────────────────────────────────
describe('tags', () => {
  let vaultId: number

  beforeAll(() => {
    const vaults = vaultQueries.list() as Array<{ id: number }>
    vaultId = vaults[0].id
  })

  it('creates a tag', () => {
    const tag = tagQueries.create(vaultId, 'reading', '#3b82f6') as { id: number; name: string; color: string }
    expect(tag.name).toBe('reading')
    expect(tag.color).toBe('#3b82f6')
  })

  it('lists tags for vault', () => {
    const tags = tagQueries.list(vaultId) as Array<{ vault_id: number }>
    expect(tags.every((t) => t.vault_id === vaultId)).toBe(true)
  })

  it('assigns tags to item and retrieves them', () => {
    const tag = tagQueries.create(vaultId, 'tech', '#10b981') as { id: number }
    const item = itemQueries.create({ vaultId, type: 'link', url: 'https://tech.io', tagIds: [tag.id] }) as { id: number; tags: Array<{ id: number }> }
    expect(item.tags.some((t) => t.id === tag.id)).toBe(true)
  })

  it('removes a tag and it disappears from items', () => {
    const tag = tagQueries.create(vaultId, 'temp', '#ff0000') as { id: number }
    const item = itemQueries.create({ vaultId, type: 'note', content: 'tagged', tagIds: [tag.id] }) as { id: number }
    tagQueries.delete(tag.id)
    const updated = itemQueries.list({ vaultId }) as Array<{ id: number; tags: Array<{ id: number }> }>
    const found = updated.find((i) => i.id === item.id)
    expect(found?.tags.some((t) => t.id === tag.id)).toBe(false)
  })
})

// ── Counts ────────────────────────────────────────────────────────────────────
describe('counts', () => {
  it('returns correct counts per type', () => {
    const vaults = vaultQueries.list() as Array<{ id: number }>
    const vaultId = vaults[0].id
    const counts = itemQueries.counts(vaultId) as { all: number; link: number; note: number; code: number; image: number }
    expect(counts.all).toBeGreaterThan(0)
    expect(typeof counts.link).toBe('number')
    expect(typeof counts.note).toBe('number')
  })
})
