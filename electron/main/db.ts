import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

// ── Persistence ───────────────────────────────────────────────────────────────

export function saveDb(): void {
  // better-sqlite3 handles persistence automatically.
}

// ── Query helpers ─────────────────────────────────────────────────────────────

function all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  const stmt = db.prepare(sql)
  return (params?.length ? stmt.all(params) : stmt.all()) as T[]
}

function get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
  const stmt = db.prepare(sql)
  return (params?.length ? stmt.get(params) : stmt.get()) as T | null
}

function run(sql: string, params?: unknown[]): void {
  const stmt = db.prepare(sql)
  if (params?.length) stmt.run(params)
  else stmt.run()
}

function insertReturning<T = Record<string, unknown>>(
  table: string,
  sql: string,
  params?: unknown[]
): T {
  const stmt = db.prepare(sql)
  const info = params?.length ? stmt.run(params) : stmt.run()
  const id = info.lastInsertRowid
  const row = get<T>(`SELECT * FROM ${table} WHERE id=?`, [id])
  return row!
}

function columnExists(table: string, column: string): boolean {
  const info = all<{ name: string }>(`PRAGMA table_info(${table})`)
  return info.some((c) => c.name === column)
}

function getSchemaVersion(): number {
  run('CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL DEFAULT 0)')
  const row = get<{ version: number }>('SELECT version FROM _schema_version')
  if (!row) { run('INSERT INTO _schema_version (version) VALUES (0)'); return 0 }
  return row.version
}

function setSchemaVersion(v: number): void {
  run('UPDATE _schema_version SET version=?', [v])
}

// Each migration runs exactly once; version is bumped atomically after.
const MIGRATIONS: Array<{ version: number; up: () => void }> = [
  {
    // smart_query on folders
    version: 1,
    up: () => {
      if (!columnExists('folders', 'smart_query'))
        run('ALTER TABLE folders ADD COLUMN smart_query TEXT')
    }
  },
  {
    // code_lang on items
    version: 2,
    up: () => {
      if (!columnExists('items', 'code_lang'))
        run('ALTER TABLE items ADD COLUMN code_lang TEXT')
    }
  },
  {
    // archive_path on items
    version: 3,
    up: () => {
      if (!columnExists('items', 'archive_path'))
        run('ALTER TABLE items ADD COLUMN archive_path TEXT')
    }
  },
  {
    // Rebuild items table to add 'code' to type CHECK constraint
    version: 4,
    up: () => {
      const tableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get() as any)?.sql || ''
      if (tableSql.includes("'code'")) return
      run('PRAGMA foreign_keys = OFF')
      db.transaction(() => {
        run(`CREATE TABLE items_new (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          vault_id     INTEGER NOT NULL REFERENCES vaults(id)  ON DELETE CASCADE,
          folder_id    INTEGER          REFERENCES folders(id) ON DELETE SET NULL,
          type         TEXT    NOT NULL CHECK(type IN ('link','note','image','code')),
          title        TEXT,
          content      TEXT,
          url          TEXT,
          image_path   TEXT,
          favicon      TEXT,
          reading_time INTEGER,
          code_lang    TEXT,
          archive_path TEXT,
          is_pinned    INTEGER NOT NULL DEFAULT 0,
          created_at   INTEGER DEFAULT (strftime('%s','now')),
          updated_at   INTEGER DEFAULT (strftime('%s','now'))
        )`)
        run(`INSERT INTO items_new
               (id, vault_id, folder_id, type, title, content, url, image_path,
                favicon, reading_time, code_lang, is_pinned, created_at, updated_at)
             SELECT id, vault_id, folder_id, type, title, content, url, image_path,
                    favicon, reading_time, code_lang, is_pinned, created_at, updated_at
             FROM items`)
        run('DROP TABLE items')
        run('ALTER TABLE items_new RENAME TO items')
      })()
      run('PRAGMA foreign_keys = ON')
    }
  },
  {
    // archive_status on items
    version: 5,
    up: () => {
      if (!columnExists('items', 'archive_status'))
        run("ALTER TABLE items ADD COLUMN archive_status TEXT CHECK(archive_status IN ('pending','done','failed'))")
    }
  },
  {
    // read_status on items
    version: 6,
    up: () => {
      if (!columnExists('items', 'read_status'))
        run("ALTER TABLE items ADD COLUMN read_status TEXT NOT NULL DEFAULT 'unread' CHECK(read_status IN ('unread','read'))")
    }
  }
]

function applyMigrations(): void {
  const current = getSchemaVersion()
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      m.up()
      setSchemaVersion(m.version)
    }
  }
}

function setupFts(): void {
  db.transaction(() => {
    run('DROP TRIGGER IF EXISTS items_ai')
    run('DROP TRIGGER IF EXISTS items_ad')
    run('DROP TRIGGER IF EXISTS items_au')
    run('DROP TRIGGER IF EXISTS items_bu')
    run('DROP TABLE IF EXISTS items_fts')
    run('CREATE VIRTUAL TABLE items_fts USING fts5(title, body, url, tags)')
    run(`INSERT INTO items_fts(rowid, title, body, url, tags)
         SELECT i.id,
                COALESCE(i.title,''),
                COALESCE(i.content,''),
                COALESCE(i.url,''),
                COALESCE((SELECT GROUP_CONCAT(t.name,' ') FROM item_tags it JOIN tags t ON t.id=it.tag_id WHERE it.item_id=i.id),'')
         FROM items i`)
    run(`CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
      INSERT INTO items_fts(rowid, title, body, url, tags)
        VALUES (new.id, COALESCE(new.title,''), COALESCE(new.content,''), COALESCE(new.url,''), '');
    END`)
    run(`CREATE TRIGGER items_bu BEFORE UPDATE ON items BEGIN
      DELETE FROM items_fts WHERE rowid = old.id;
    END`)
    run(`CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
      INSERT INTO items_fts(rowid, title, body, url, tags)
        VALUES (new.id, COALESCE(new.title,''), COALESCE(new.content,''), COALESCE(new.url,''), '');
    END`)
    run(`CREATE TRIGGER items_ad BEFORE DELETE ON items BEGIN
      DELETE FROM items_fts WHERE rowid = old.id;
    END`)
  })()
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDb(password?: string): Promise<{ needsPassword?: boolean }> {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'hoard.db')

  db = new Database(dbPath)

  run('PRAGMA foreign_keys = ON')
  run('PRAGMA journal_mode = WAL')

  // ── Base schema (always idempotent, full current shape) ───────────────────
  run(`CREATE TABLE IF NOT EXISTS vaults (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    color      TEXT    NOT NULL DEFAULT '#c9952a',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )`)

  run(`CREATE TABLE IF NOT EXISTS folders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id    INTEGER NOT NULL REFERENCES vaults(id)  ON DELETE CASCADE,
    parent_id   INTEGER          REFERENCES folders(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    smart_query TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now')),
    updated_at  INTEGER DEFAULT (strftime('%s','now'))
  )`)

  run(`CREATE TABLE IF NOT EXISTS items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id       INTEGER NOT NULL REFERENCES vaults(id)  ON DELETE CASCADE,
    folder_id      INTEGER          REFERENCES folders(id) ON DELETE SET NULL,
    type           TEXT    NOT NULL CHECK(type IN ('link','note','image','code')),
    title          TEXT,
    content        TEXT,
    url            TEXT,
    image_path     TEXT,
    favicon        TEXT,
    reading_time   INTEGER,
    code_lang      TEXT,
    archive_path   TEXT,
    archive_status TEXT CHECK(archive_status IN ('pending','done','failed')),
    is_pinned      INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER DEFAULT (strftime('%s','now')),
    updated_at     INTEGER DEFAULT (strftime('%s','now'))
  )`)

  run(`CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id   INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#c9952a',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`)

  run(`CREATE TABLE IF NOT EXISTS item_tags (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
  )`)

  // ── Run any pending migrations on existing DBs ────────────────────────────
  applyMigrations()

  // ── FTS (rebuilt every start to stay consistent) ──────────────────────────
  setupFts()

  // ── Seed default vault ────────────────────────────────────────────────────
  const count = (db.prepare('SELECT COUNT(*) c FROM vaults').get() as any).c
  if (count === 0) {
    run("INSERT INTO vaults (name, color) VALUES ('My Hoard', '#c9952a')")
  }

  return { needsPassword: false }
}

// ── Vaults ────────────────────────────────────────────────────────────────────

export const vaultQueries = {
  list: () => all('SELECT * FROM vaults ORDER BY created_at ASC'),

  create: (name: string, color: string) =>
    insertReturning('vaults', 'INSERT INTO vaults (name, color) VALUES (?, ?)', [name, color]),

  update: (id: number, name: string, color: string) => {
    run("UPDATE vaults SET name=?, color=?, updated_at=strftime('%s','now') WHERE id=?", [name, color, id])
    return get('SELECT * FROM vaults WHERE id=?', [id])
  },

  delete: (id: number) => {
    run('DELETE FROM vaults WHERE id=?', [id])
  }
}

// ── Folders ───────────────────────────────────────────────────────────────────

export const folderQueries = {
  list: (vaultId: number) =>
    all('SELECT * FROM folders WHERE vault_id=? ORDER BY name ASC', [vaultId]),

  create: (vaultId: number, name: string, parentId?: number, smartQuery?: string) =>
    insertReturning('folders', 'INSERT INTO folders (vault_id, parent_id, name, smart_query) VALUES (?, ?, ?, ?)', [
      vaultId, parentId ?? null, name, smartQuery ?? null
    ]),

  update: (id: number, name: string, smartQuery?: string) => {
    run("UPDATE folders SET name=?, smart_query=?, updated_at=strftime('%s','now') WHERE id=?", [name, smartQuery ?? null, id])
    return get('SELECT * FROM folders WHERE id=?', [id])
  },

  delete: (id: number) => {
    run('DELETE FROM folders WHERE id=?', [id])
  }
}

// ── Items ─────────────────────────────────────────────────────────────────────

export interface CreateItemData {
  vaultId: number
  folderId?: number | null
  type: 'link' | 'note' | 'image' | 'code'
  title?: string
  content?: string
  url?: string
  imagePath?: string
  favicon?: string
  readingTime?: number
  codeLang?: string
  archivePath?: string
  archiveStatus?: 'pending' | 'done' | 'failed' | null
  tagIds?: number[]
}

function getTagsForItem(itemId: number) {
  return all(
    `SELECT t.* FROM tags t
     JOIN item_tags it ON it.tag_id = t.id
     WHERE it.item_id = ?
     ORDER BY t.name ASC`,
    [itemId]
  )
}

function attachTags<T extends { id: number }>(items: T[]) {
  return items.map((item) => ({ ...item, tags: getTagsForItem(item.id) }))
}

export const itemQueries = {
  counts: (vaultId: number) => {
    const rows = all<{ type: string; count: number }>(
      'SELECT type, COUNT(*) as count FROM items WHERE vault_id=? GROUP BY type',
      [vaultId]
    )
    const allCount = (db.prepare(`SELECT COUNT(*) c FROM items WHERE vault_id=${vaultId}`).get() as any).c
    const result = { all: allCount, link: 0, note: 0, image: 0, code: 0 }
    for (const row of rows) {
      if (row.type in result) result[row.type as keyof typeof result] = row.count
    }
    return result
  },

  list: (params: { vaultId: number; folderId?: number | null; search?: string; tagId?: number | null; type?: string | null; readStatus?: string | null }) => {
    const { vaultId, folderId, search, tagId, type, readStatus } = params
    let rows: Record<string, unknown>[]
    
    let baseQuery = 'SELECT i.* FROM items i '
    const where = ['i.vault_id=?']
    const queryParams: unknown[] = [vaultId]

    if (search?.trim()) {
      const q = search.trim().replace(/['"*]/g, ' ').trim() + '*'
      where.push('i.id IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?)')
      queryParams.push(q)
    } else if (tagId != null) {
      baseQuery += 'JOIN item_tags it ON it.item_id = i.id '
      where.push('it.tag_id=?')
      queryParams.push(tagId)
    } else if (folderId != null) {
      const folder = (db.prepare('SELECT smart_query FROM folders WHERE id=' + folderId).get() as any)?.smart_query as string | null
      if (folder) {
        try {
          const smart = JSON.parse(folder)
          if (smart.type) {
            where.push('i.type=?')
            queryParams.push(smart.type)
          }
          if (smart.search) {
            where.push('i.id IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?)')
            queryParams.push(smart.search + '*')
          }
          if (smart.tagId) {
            baseQuery += 'JOIN item_tags it ON it.item_id = i.id '
            where.push('it.tag_id=?')
            queryParams.push(smart.tagId)
          }
        } catch (err) {
          console.error('Failed to parse smart_query', folder)
        }
      } else {
        where.push('i.folder_id=?')
        queryParams.push(folderId)
      }
    }

    if (type) {
      where.push('i.type=?')
      queryParams.push(type)
    }

    if (readStatus) {
      where.push('i.read_status=?')
      queryParams.push(readStatus)
    }

    const fullQuery = `${baseQuery} WHERE ${where.join(' AND ')} ORDER BY i.is_pinned DESC, i.created_at DESC`
    rows = all(fullQuery, queryParams)

    return attachTags(rows as { id: number }[])
  },

  create: (data: CreateItemData) => {
    const row = insertReturning(
      'items',
      `INSERT INTO items (vault_id, folder_id, type, title, content, url, image_path, favicon, reading_time, code_lang, archive_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.vaultId,
        data.folderId ?? null,
        data.type,
        data.title ?? null,
        data.content ?? null,
        data.url ?? null,
        data.imagePath ?? null,
        data.favicon ?? null,
        data.readingTime ?? null,
        data.codeLang ?? null,
        data.archivePath ?? null
      ]
    ) as { id: number }

    if (data.tagIds?.length) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)')
      db.transaction(() => {
        for (const tagId of data.tagIds!) {
          insertTag.run(row.id, tagId)
        }
      })()
    }

    return { ...row, tags: getTagsForItem(row.id) }
  },

  update: (id: number, data: Partial<CreateItemData>) => {
    const fields: string[] = []
    const values: unknown[] = []

    if (data.title       !== undefined) { fields.push('title=?');        values.push(data.title) }
    if (data.content     !== undefined) { fields.push('content=?');      values.push(data.content) }
    if (data.folderId    !== undefined) { fields.push('folder_id=?');    values.push(data.folderId) }
    if (data.codeLang    !== undefined) { fields.push('code_lang=?');    values.push(data.codeLang) }
    if (data.archivePath   !== undefined) { fields.push('archive_path=?');   values.push(data.archivePath) }
    if (data.archiveStatus !== undefined) { fields.push('archive_status=?'); values.push(data.archiveStatus) }
    if (data.favicon     !== undefined) { fields.push('favicon=?');      values.push(data.favicon) }
    if (data.readingTime !== undefined) { fields.push('reading_time=?'); values.push(data.readingTime) }
    if (data.imagePath   !== undefined) { fields.push('image_path=?');   values.push(data.imagePath) }
    if (data.url         !== undefined) { fields.push('url=?');          values.push(data.url) }
    if ((data as any).readStatus !== undefined) {
      fields.push('read_status=?')
      values.push((data as any).readStatus)
    }

    if (fields.length) {
      fields.push("updated_at=strftime('%s','now')")
      values.push(id)
      run(`UPDATE items SET ${fields.join(', ')} WHERE id=?`, values)
    }

    if (data.tagIds !== undefined) {
      db.transaction(() => {
        run('DELETE FROM item_tags WHERE item_id=?', [id])
        const insertTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)')
        for (const tagId of data.tagIds!) {
          insertTag.run(id, tagId)
        }
        // Re-sync FTS tags column after tag changes
        const tagNames = all<{ name: string }>(
          'SELECT t.name FROM tags t JOIN item_tags it ON t.id=it.tag_id WHERE it.item_id=?', [id]
        ).map((r) => r.name).join(' ')
        const src = get<{ title: string | null; content: string | null; url: string | null }>('SELECT title, content, url FROM items WHERE id=?', [id])
        if (src) {
          run('DELETE FROM items_fts WHERE rowid=?', [id])
          run('INSERT INTO items_fts(rowid,title,body,url,tags) VALUES(?,?,?,?,?)',
            [id, src.title ?? '', src.content ?? '', src.url ?? '', tagNames])
        }
      })()
    }

    const row = get<{ id: number }>('SELECT * FROM items WHERE id=?', [id])
    return { ...row, tags: getTagsForItem(id) }
  },

  pin: (id: number, pinned: boolean) => {
    run('UPDATE items SET is_pinned=? WHERE id=?', [pinned ? 1 : 0, id])
  },

  delete: (id: number) => {
    run('DELETE FROM items WHERE id=?', [id])
  },

  duplicate: (id: number) => {
    const src = get<Record<string, any>>('SELECT * FROM items WHERE id=?', [id])
    if (!src) throw new Error(`Item ${id} not found`)
    const tags = getTagsForItem(id) as Array<{ id: number }>
    const newTitle = src.title ? `${src.title} (copy)` : null
    
    let newId: number = 0
    db.transaction(() => {
      const info = db.prepare(`INSERT INTO items (vault_id, folder_id, type, title, content, url, image_path, favicon, reading_time, code_lang, archive_path)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        [src.vault_id, src.folder_id, src.type, newTitle, src.content, src.url, src.image_path, src.favicon, src.reading_time, src.code_lang, null]
      )
      newId = Number(info.lastInsertRowid)
      const insertTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)')
      for (const tag of tags) {
        insertTag.run(newId, tag.id)
      }
    })()
    
    const row = get<{ id: number }>('SELECT * FROM items WHERE id=?', [newId])
    return { ...row, tags: getTagsForItem(newId) }
  },

  move: (id: number, targetVaultId: number, targetFolderId?: number | null) => {
    run('UPDATE items SET vault_id=?, folder_id=?, updated_at=strftime(\'%s\',\'now\') WHERE id=?',
      [targetVaultId, targetFolderId ?? null, id])
    const row = get<{ id: number }>('SELECT * FROM items WHERE id=?', [id])
    return { ...row, tags: getTagsForItem(id) }
  },

  copy: (id: number, targetVaultId: number, targetFolderId?: number | null) => {
    const src = get<Record<string, any>>('SELECT * FROM items WHERE id=?', [id])
    if (!src) throw new Error(`Item ${id} not found`)
    const tags = getTagsForItem(id) as Array<{ id: number }>
    
    let newId: number = 0
    db.transaction(() => {
      const info = db.prepare(`INSERT INTO items (vault_id, folder_id, type, title, content, url, image_path, favicon, reading_time, code_lang, archive_path)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        [targetVaultId, targetFolderId ?? null, src.type, src.title, src.content, src.url, src.image_path, src.favicon, src.reading_time, src.code_lang, null]
      )
      newId = Number(info.lastInsertRowid)
      const insertTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)')
      for (const tag of tags) {
        insertTag.run(newId, tag.id)
      }
    })()
    
    const row = get<{ id: number }>('SELECT * FROM items WHERE id=?', [newId])
    return { ...row, tags: getTagsForItem(newId) }
  },

  folderCounts: (vaultId: number): Record<number, number> => {
    const rows = all<{ folder_id: number; count: number }>(
      'SELECT folder_id, COUNT(*) as count FROM items WHERE vault_id=? AND folder_id IS NOT NULL GROUP BY folder_id',
      [vaultId]
    )
    const result: Record<number, number> = {}
    for (const row of rows) result[row.folder_id] = row.count
    return result
  },

  searchForLink: (vaultId: number, q: string) => {
    if (!q.trim()) return []
    const escaped = q.trim().replace(/['"*]/g, ' ').trim() + '*'
    try {
      return all<{ id: number; title: string | null; type: string }>(
        'SELECT i.id, i.title, i.type FROM items i WHERE i.vault_id=? AND i.id IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?) LIMIT 8',
        [vaultId, escaped]
      )
    } catch {
      return all<{ id: number; title: string | null; type: string }>(
        "SELECT id, title, type FROM items WHERE vault_id=? AND title LIKE ? LIMIT 8",
        [vaultId, `%${q}%`]
      )
    }
  }
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export const tagQueries = {
  list: (vaultId: number) =>
    all('SELECT * FROM tags WHERE vault_id=? ORDER BY name ASC', [vaultId]),

  create: (vaultId: number, name: string, color: string) =>
    insertReturning('tags', 'INSERT INTO tags (vault_id, name, color) VALUES (?, ?, ?)', [
      vaultId, name, color
    ]),

  delete: (id: number) => {
    run('DELETE FROM tags WHERE id=?', [id])
  },

  setItemTags: (itemId: number, tagIds: number[]) => {
    db.transaction(() => {
      run('DELETE FROM item_tags WHERE item_id=?', [itemId])
      const insertTag = db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)')
      for (const tagId of tagIds) {
        insertTag.run(itemId, tagId)
      }
    })()
  }
}

// ── Images ────────────────────────────────────────────────────────────────────

export function getImagesDir(): string {
  const dir = path.join(app.getPath('userData'), 'hoard-images')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ── Security (Mocked for now) ──────────────────────────────────────────────────
export function isEncryptionEnabled(): boolean { return false }
export function hasEncryptedDb(): boolean { return false }
export function verifyPassword(password: string): boolean { return true }
export function enableEncryption(password: string): void {}
export function disableEncryption(): void {}
