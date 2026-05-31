/**
 * Hoard Extension — Local Storage (IndexedDB)
 * Works completely offline — no desktop app needed.
 */

const DB_NAME    = 'hoard_ext'
const DB_VERSION = 2

let _db = null

function openDb() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('items')) {
        const store = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true })
        store.createIndex('by_created', 'created_at', { unique: false })
        store.createIndex('by_type',    'type',       { unique: false })
        store.createIndex('by_synced',  'synced',     { unique: false })
      }
      const items = req.transaction.objectStore('items')
      if (!items.indexNames.contains('by_client_id')) {
        items.createIndex('by_client_id', 'clientId', { unique: true })
      }
      if (!db.objectStoreNames.contains('tags')) {
        db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function saveItem(item) {
  const db    = await openDb()
  const duplicatePolicy = item.duplicatePolicy || 'skip'
  const duplicate = item.url ? await findItemByUrl(item.url) : null
  if (duplicate && duplicatePolicy !== 'save-copy') {
    if (duplicatePolicy === 'merge') {
      const merged = await updateItem(duplicate.id, {
        title: item.title || duplicate.title,
        folderId: item.folderId ?? duplicate.folderId,
        tagIds: [...new Set([...(duplicate.tagIds || []), ...(item.tagIds || [])])]
      })
      return { ...merged, duplicateAction: 'merged' }
    }
    return { ...duplicate, duplicateAction: 'skipped' }
  }
  const entry = {
    clientId:    item.clientId     || crypto.randomUUID(),
    type:        item.type        || 'link',
    title:       item.title       || null,
    content:     item.content     || null,
    url:         item.url         || null,
    attribution: item.attribution || null,
    favicon:     item.favicon     || null,
    codeLang:    item.codeLang    || null,
    vaultId:     item.vaultId     || null,
    folderId:    item.folderId    || null,
    tagIds:      item.tagIds      || [],
    created_at:  Date.now(),
    synced:      false,
    syncAttempts: 0,
    lastSyncError: null
  }
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('items', 'readwrite')
    const req   = tx.objectStore('items').add(entry)
    req.onsuccess = (e) => resolve({ ...entry, id: e.target.result })
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function updateItem(id, patch) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('items', 'readwrite')
    const store = tx.objectStore('items')
    const req   = store.get(id)
    req.onsuccess = (e) => {
      const item = e.target.result
      if (!item) { reject(new Error('Item not found')); return }
      const allowed = ['title', 'content', 'folderId', 'tagIds']
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) item[key] = patch[key]
      }
      item.synced = false
      item.lastSyncError = null
      const put = store.put(item)
      put.onsuccess = () => resolve(item)
      put.onerror = (event) => reject(event.target.error)
    }
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function retryItem(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('items', 'readwrite')
    const store = tx.objectStore('items')
    const req   = store.get(id)
    req.onsuccess = (e) => {
      const item = e.target.result
      if (!item) { reject(new Error('Item not found')); return }
      item.synced = false
      item.lastSyncError = null
      const put = store.put(item)
      put.onsuccess = () => resolve(item)
      put.onerror = (event) => reject(event.target.error)
    }
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function getRecentItems(limit = 20) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx      = db.transaction('items', 'readonly')
    const store   = tx.objectStore('items')
    const index   = store.index('by_created')
    const results = []
    const req     = index.openCursor(null, 'prev')  // newest first
    req.onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor && results.length < limit) {
        results.push(cursor.value)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function getAllItems() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('items', 'readonly')
    const req = tx.objectStore('items').getAll()
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function getUnsyncedItems() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx      = db.transaction('items', 'readonly')
    const index   = tx.objectStore('items').index('by_synced')
    const req     = index.getAll(IDBKeyRange.only(false))
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function markItemsSynced(ids) {
  if (!ids.length) return
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('items', 'readwrite')
    const store = tx.objectStore('items')
    let done    = 0
    for (const id of ids) {
      const req = store.get(id)
      req.onsuccess = (e) => {
        const item = e.target.result
        if (item) {
          item.synced = true
          item.lastSyncError = null
          store.put(item)
        }
        if (++done === ids.length) resolve()
      }
    }
    tx.onerror = (e) => reject(e.target.error)
  })
}

export async function markItemSyncFailed(id, error) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('items', 'readwrite')
    const store = tx.objectStore('items')
    const req   = store.get(id)
    req.onsuccess = (e) => {
      const item = e.target.result
      if (item) {
        item.syncAttempts = (item.syncAttempts || 0) + 1
        item.lastSyncError = String(error || 'Sync failed').slice(0, 300)
        store.put(item)
      }
      resolve()
    }
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function deleteItem(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('items', 'readwrite')
    const req = tx.objectStore('items').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function searchItems(query, limit = 30) {
  const all = await getAllItems()
  const q   = (query || '').toLowerCase().trim()
  if (!q) return all.slice(0, limit)
  return all
    .filter(i => (i.title || '').toLowerCase().includes(q) || (i.url || '').toLowerCase().includes(q) || (i.content || '').toLowerCase().includes(q))
    .slice(0, limit)
}

export async function countItems() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('items', 'readonly')
    const req = tx.objectStore('items').count()
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ── Daily count (for badge) ───────────────────────────────────────────────────

export async function getTodayCount() {
  const all   = await getAllItems()
  const today = new Date().toDateString()
  return all.filter(i => new Date(i.created_at).toDateString() === today).length
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportAll() {
  const items = await getAllItems()
  return {
    version:     'hoard-ext-1.0',
    exported_at: new Date().toISOString(),
    items:       items.map(({ synced, syncAttempts, lastSyncError, ...i }) => i)
  }
}

// ── URL duplicate check ───────────────────────────────────────────────────────

export async function urlExists(url) {
  return !!(await findItemByUrl(url))
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats() {
  const all  = await getAllItems()
  const now  = Date.now()
  const DAY  = 86400000
  const WEEK = 7 * DAY

  const thisWeekStart = now - WEEK
  const lastWeekStart = now - 2 * WEEK

  const thisWeek = all.filter(i => i.created_at >= thisWeekStart)
  const lastWeek = all.filter(i => i.created_at >= lastWeekStart && i.created_at < thisWeekStart)
  const today    = all.filter(i => i.created_at >= now - DAY)

  // Type breakdown
  const byType = {}
  for (const item of all) byType[item.type] = (byType[item.type] || 0) + 1

  // Top domains (links only)
  const domainCount = {}
  for (const item of all) {
    if (!item.url) continue
    try {
      const d = new URL(item.url).hostname.replace(/^www\./, '')
      domainCount[d] = (domainCount[d] || 0) + 1
    } catch { /* skip */ }
  }
  const topDomains = Object.entries(domainCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }))

  // Daily activity last 7 days (count per day)
  const daily = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now - i * DAY)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(dayStart.getTime() + DAY)
    const count    = all.filter(item => item.created_at >= dayStart.getTime() && item.created_at < dayEnd.getTime()).length
    daily.push({ date: dayStart, count, label: dayStart.toLocaleDateString('en', { weekday: 'short' }) })
  }

  // Streak: consecutive days with at least 1 save
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(now - i * DAY)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart.getTime() + DAY)
    const saved  = all.some(item => item.created_at >= dayStart.getTime() && item.created_at < dayEnd.getTime())
    if (saved) streak++
    else if (i > 0) break  // gap found (don't break on today if nothing yet)
  }

  return {
    total:        all.length,
    thisWeekCount: thisWeek.length,
    lastWeekCount: lastWeek.length,
    todayCount:    today.length,
    byType,
    topDomains,
    daily,
    streak
  }
}

export async function findItemByUrl(url) {
  const all  = await getAllItems()
  const norm = (u) => (u || '').toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '')
  return all.find(i => norm(i.url) === norm(url)) || null
}
