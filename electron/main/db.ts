import initSqlJs from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any

// ── Persistence ───────────────────────────────────────────────────────────────

export function saveDb(): void {
  const data: Uint8Array = db.export()
  const dbPath = path.join(app.getPath('userData'), 'hoard.db')
  fs.writeFileSync(dbPath, Buffer.from(data))
}

// ── Query helpers ─────────────────────────────────────────────────────────────

function all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stmt: any = db.prepare(sql)
  if (params?.length) stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as T)
  stmt.free()
  return rows
}

function get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | null {
  return all<T>(sql, params)[0] ?? null
}

function run(sql: string, params?: unknown[]): void {
  db.run(sql, params)
}

function insertReturning<T = Record<string, unknown>>(
  table: string,
  sql: string,
  params?: unknown[]
): T {
  run(sql, params)
  const id = (db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]) as number
  const row = get<T>(`SELECT * FROM ${table} WHERE id=?`, [id])
  saveDb()
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
      const tableSql = (db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'")[0]?.values[0][0] as string) || ''
      if (tableSql.includes("'code'")) return
      run('PRAGMA foreign_keys = OFF')
      run('BEGIN TRANSACTION')
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
      run('COMMIT')
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
  saveDb()
}

function setupFts(): void {
  run('DROP TRIGGER IF EXISTS items_ai')
  run('DROP TRIGGER IF EXISTS items_ad')
  run('DROP TRIGGER IF EXISTS items_au')
  run('DROP TRIGGER IF EXISTS items_bu')
  run('DROP TABLE IF EXISTS items_fts')
  run('CREATE VIRTUAL TABLE items_fts USING fts4(title, body, url)')
  run(`INSERT INTO items_fts(docid, title, body, url)
       SELECT id, COALESCE(title,''), COALESCE(content,''), COALESCE(url,'') FROM items`)
  run(`CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(docid, title, body, url)
      VALUES (new.id, COALESCE(new.title,''), COALESCE(new.content,''), COALESCE(new.url,''));
  END`)
  run(`CREATE TRIGGER items_bu BEFORE UPDATE ON items BEGIN
    DELETE FROM items_fts WHERE docid = old.id;
  END`)
  run(`CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(docid, title, body, url)
      VALUES (new.id, COALESCE(new.title,''), COALESCE(new.content,''), COALESCE(new.url,''));
  END`)
  run(`CREATE TRIGGER items_ad BEFORE DELETE ON items BEGIN
    DELETE FROM items_fts WHERE docid = old.id;
  END`)
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDb(password?: string): Promise<{ needsPassword?: boolean }> {
  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(app.getAppPath(), 'resources/sql-wasm.wasm')

  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'hoard.db')

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath))
  } else {
    db = new SQL.Database()
  }

  run('PRAGMA foreign_keys = ON')

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
  const count = (db.exec('SELECT COUNT(*) c FROM vaults')[0]?.values[0][0] ?? 0) as number
  if (count === 0) {
    run("INSERT INTO vaults (name, color) VALUES ('My Hoard', '#c9952a')")
    saveDb()
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
    saveDb()
    return get('SELECT * FROM vaults WHERE id=?', [id])
  },

  delete: (id: number) => {
    run('DELETE FROM vaults WHERE id=?', [id])
    saveDb()
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
    saveDb()
    return get('SELECT * FROM folders WHERE id=?', [id])
  },

  delete: (id: number) => {
    run('DELETE FROM folders WHERE id=?', [id])
    saveDb()
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
    const allCount = (db.exec(`SELECT COUNT(*) FROM items WHERE vault_id=${vaultId}`)[0]?.values[0][0] ?? 0) as number
    const result = { all: allCount, link: 0, note: 0, image: 0, code: 0 }
    for (const row of rows) {
      if (row.type in result) result[row.type as keyof typeof result] = row.count
    }
    return result
  },

  list: (params: { vaultId: number; folderId?: number | null; search?: string; tagId?: number | null; type?: string | null }) => {
    const { vaultId, folderId, search, tagId, type } = params
    let rows: Record<string, unknown>[]
    
    let baseQuery = 'SELECT i.* FROM items i '
    const where = ['i.vault_id=?']
    const queryParams: unknown[] = [vaultId]

    if (search?.trim()) {
      const q = search.trim() + '*'
      where.push('i.id IN (SELECT docid FROM items_fts WHERE items_fts MATCH ?)')
      queryParams.push(q)
    } else if (tagId != null) {
      baseQuery += 'JOIN item_tags it ON it.item_id = i.id '
      where.push('it.tag_id=?')
      queryParams.push(tagId)
    } else if (folderId != null) {
      const folder = db.exec('SELECT smart_query FROM folders WHERE id=' + folderId)[0]?.values[0][0] as string | null
      if (folder) {
        try {
          const smart = JSON.parse(folder)
          if (smart.type) {
            where.push('i.type=?')
            queryParams.push(smart.type)
          }
          if (smart.search) {
            where.push('i.id IN (SELECT docid FROM items_fts WHERE items_fts MATCH ?)')
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

    const fullQuery = `${baseQuery} WHERE ${where.join(' AND ')} ORDER BY i.is_pinned DESC, i.created_at DESC`
    rows = all(fullQuery, queryParams)

    return attachTags(rows as { id: number }[])
  },

  create: (data: CreateItemData) => {
    const row = insertReturning(
      'items',
      `INSERT INTO items (vault_id, folder_id, type, title, content, url, image_path, favicon, reading_time, code_lang, archive_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at, updated_at`,
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
      for (const tagId of data.tagIds) {
        run('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', [row.id, tagId])
      }
      saveDb()
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

    if (fields.length) {
      fields.push("updated_at=strftime('%s','now')")
      values.push(id)
      run(`UPDATE items SET ${fields.join(', ')} WHERE id=?`, values)
    }

    if (data.tagIds !== undefined) {
      run('DELETE FROM item_tags WHERE item_id=?', [id])
      for (const tagId of data.tagIds) {
        run('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', [id, tagId])
      }
    }

    saveDb()
    const row = get<{ id: number }>('SELECT * FROM items WHERE id=?', [id])
    return { ...row, tags: getTagsForItem(id) }
  },

  pin: (id: number, pinned: boolean) => {
    run('UPDATE items SET is_pinned=? WHERE id=?', [pinned ? 1 : 0, id])
    saveDb()
  },

  delete: (id: number) => {
    run('DELETE FROM items WHERE id=?', [id])
    saveDb()
  },

  duplicate: (id: number) => {
    const src = get<Record<string, unknown>>('SELECT * FROM items WHERE id=?', [id])
    if (!src) throw new Error(`Item ${id} not found`)
    const tags = getTagsForItem(id) as Array<{ id: number }>
    const newTitle = src.title ? `${src.title} (copy)` : null
    const row = insertReturning(
      'items',
      `INSERT INTO items (vault_id, folder_id, type, title, content, url, image_path, favicon, reading_time, code_lang, archive_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at, updated_at`,
      [src.vault_id, src.folder_id, src.type, newTitle, src.content, src.url, src.image_path, src.favicon, src.reading_time, src.code_lang, null]
    ) as { id: number }
    for (const tag of tags) {
      run('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', [row.id, tag.id])
    }
    saveDb()
    return { ...row, tags: getTagsForItem(row.id) }
  },

  move: (id: number, targetVaultId: number, targetFolderId?: number | null) => {
    run('UPDATE items SET vault_id=?, folder_id=?, updated_at=strftime(\'%s\',\'now\') WHERE id=?',
      [targetVaultId, targetFolderId ?? null, id])
    saveDb()
    const row = get<{ id: number }>('SELECT * FROM items WHERE id=?', [id])
    return { ...row, tags: getTagsForItem(id) }
  },

  copy: (id: number, targetVaultId: number, targetFolderId?: number | null) => {
    const src = get<Record<string, unknown>>('SELECT * FROM items WHERE id=?', [id])
    if (!src) throw new Error(`Item ${id} not found`)
    const tags = getTagsForItem(id) as Array<{ id: number }>
    const row = insertReturning(
      'items',
      `INSERT INTO items (vault_id, folder_id, type, title, content, url, image_path, favicon, reading_time, code_lang, archive_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at, updated_at`,
      [targetVaultId, targetFolderId ?? null, src.type, src.title, src.content, src.url, src.image_path, src.favicon, src.reading_time, src.code_lang, null]
    ) as { id: number }
    for (const tag of tags) {
      run('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', [row.id, tag.id])
    }
    saveDb()
    return { ...row, tags: getTagsForItem(row.id) }
  },

  folderCounts: (vaultId: number): Record<number, number> => {
    const rows = all<{ folder_id: number; count: number }>(
      'SELECT folder_id, COUNT(*) as count FROM items WHERE vault_id=? AND folder_id IS NOT NULL GROUP BY folder_id',
      [vaultId]
    )
    const result: Record<number, number> = {}
    for (const row of rows) result[row.folder_id] = row.count
    return result
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
    saveDb()
  },

  setItemTags: (itemId: number, tagIds: number[]) => {
    run('DELETE FROM item_tags WHERE item_id=?', [itemId])
    for (const tagId of tagIds) {
      run('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)', [itemId, tagId])
    }
    saveDb()
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
