import { getAllItems, deleteItem, getUnsyncedItems, retryItem, updateItem, getStats } from './db.js'
import { getAppStatus } from './api.js'
import { applyTranslations } from './i18n.js'

const API = 'http://127.0.0.1:43210'

const $ = (id) => document.getElementById(id)
const tr = (key, fallback) => chrome.i18n?.getMessage(key) || fallback

// ── State ─────────────────────────────────────────────────────────────────────
let allItems      = []
let filtered      = []
let activeFilter  = 'all'
let searchQuery   = ''
let appOnline     = false
let folders       = []
let tags          = []
let domainRules   = []
let editingItem   = null
let focusedIdx    = -1   // keyboard navigation index

// ── Type colors ───────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  link: '#38bdf8', note: '#4ade80', image: '#c084fc',
  code: '#fbbf24', quote: '#f472b6', file: '#fb923c'
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url || '' }
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderItems() {
  const list = $('itemsList')
  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <div class="empty-icon">🏴</div>
        <h3>${searchQuery ? tr('noResults', 'No results found') : tr('nothingSaved', 'Nothing saved yet')}</h3>
        <p>${searchQuery ? tr('trySearch', 'Try a different search term.') : tr('saveHint', 'Save links, notes and quotes from any webpage. Use the extension popup or context menu.')}</p>
      </div>`
    return
  }

  list.innerHTML = filtered.map((item, idx) => {
    const color     = TYPE_COLOR[item.type] || '#888'
    const isFocused = idx === focusedIdx
    const hasContent = item.content && item.content.length > 80
    const icon  = item.favicon
      ? `<img src="${escHtml(item.favicon)}" alt="" onerror="this.style.display='none'">`
      : `<span style="font-size:13px">${typeEmoji(item.type)}</span>`
    const title = escHtml(item.title || item.url || item.content?.slice(0, 60) || 'Untitled')
    const meta  = item.type === 'quote' && item.attribution
      ? `❝ ${escHtml(item.attribution)}`
      : item.url ? escHtml(getDomain(item.url)) : escHtml(item.type)
    const time      = timeAgo(item.created_at)
    const syncBadge = item.synced ? '' : `<span style="color:${item.lastSyncError ? '#f87171' : '#888'};font-size:9px;margin-left:4px">●${item.lastSyncError ? 'error' : 'pending'}</span>`
    const readBadge = hasContent ? `<span style="color:#38bdf8;font-size:9px;margin-left:5px" title="Has saved content">📄</span>` : ''

    return `
      <div class="item-row${isFocused ? ' focused' : ''}" data-id="${item.id}" data-idx="${idx}" data-url="${escHtml(item.url || '')}">
        <div class="item-icon">${icon}</div>
        <div class="item-info">
          <div class="item-title">${title}${syncBadge}${readBadge}</div>
          <div class="item-meta">${meta} · ${time}</div>
        </div>
        <div class="item-type-dot" style="background:${color}"></div>
        <div class="item-actions">
          ${hasContent ? `<button class="act-btn read-btn" data-id="${item.id}" title="Read offline (r)">📖</button>` : ''}
          <button class="act-btn edit-btn" data-id="${item.id}" title="Edit (e)">✎</button>
          ${item.synced ? '' : `<button class="act-btn retry-btn" data-id="${item.id}" title="Retry sync">↻</button>`}
          <button class="act-btn delete-btn" data-id="${item.id}" title="Delete (del)">🗑</button>
        </div>
      </div>`
  }).join('')

  // Click to open URL
  list.querySelectorAll('.item-row[data-url]').forEach(row => {
    const url = row.getAttribute('data-url')
    if (!url) return
    row.addEventListener('click', (e) => {
      if (e.target.closest('.item-actions')) return
      chrome.tabs.create({ url })
    })
  })

  // Delete buttons
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = parseInt(btn.dataset.id)
      if (!confirm(tr('deleteItem', 'Delete this item?'))) return
      await deleteItem(id)
      await reload()
    })
  })

  list.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      openEditor(parseInt(btn.dataset.id))
    })
  })

  list.querySelectorAll('.read-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id   = parseInt(btn.dataset.id)
      const item = filtered.find(i => i.id === id)
      if (item) openReader(item)
    })
  })

  list.querySelectorAll('.retry-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      await retryItem(parseInt(btn.dataset.id))
      await requestSync()
    })
  })
}

function typeEmoji(type) {
  return { link: '🔗', note: '📝', image: '🖼', code: '💻', quote: '❝', file: '📎' }[type] || '•'
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── Apply filters ─────────────────────────────────────────────────────────────

function applyFilters() {
  let list = allItems
  if (activeFilter !== 'all') list = list.filter(i => i.type === activeFilter)
  if (searchQuery)            list = list.filter(i =>
    (i.title || '').toLowerCase().includes(searchQuery) ||
    (i.url   || '').toLowerCase().includes(searchQuery) ||
    (i.content || '').toLowerCase().includes(searchQuery)
  )
  filtered = list
  renderItems()
}

// ── Load + reload ─────────────────────────────────────────────────────────────

async function reload() {
  allItems = await getAllItems()
  allItems.sort((a, b) => b.created_at - a.created_at)
  const total = allItems.length
  $('itemCount').textContent = `${total} ${total === 1 ? 'item' : tr('items', 'items')}`
  applyFilters()
  await renderSyncHealth()
  // Render stats lazily (only when panel is open)
  if ($('statsPanel')?.open) await renderStats()
}

// ── Stats dashboard ───────────────────────────────────────────────────────────

async function renderStats() {
  try {
    const s = await getStats()

    // Numbers
    $('statThisWeek').textContent = s.thisWeekCount
    $('statToday').textContent    = s.todayCount
    $('statStreak').textContent   = s.streak

    // Week delta
    const delta    = s.thisWeekCount - s.lastWeekCount
    const deltaEl  = $('statWeekDelta')
    if (delta > 0)  { deltaEl.textContent = `▲ ${delta} vs last week`; deltaEl.className = 'stat-delta up' }
    else if (delta < 0) { deltaEl.textContent = `▼ ${Math.abs(delta)} vs last week`; deltaEl.className = 'stat-delta down' }
    else            { deltaEl.textContent = '= same as last week';  deltaEl.className = 'stat-delta' }

    // Daily bar chart
    const maxCount = Math.max(...s.daily.map(d => d.count), 1)
    $('dailyChart').innerHTML = s.daily.map(d => {
      const pct   = Math.max(Math.round((d.count / maxCount) * 100), d.count > 0 ? 8 : 4)
      const color = d.count > 0 ? 'rgba(201,149,42,.6)' : 'rgba(201,149,42,.12)'
      return `<div class="day-bar" style="height:${pct}%;background:${color}" title="${d.label}: ${d.count}">
        <div class="day-tip">${d.label} · ${d.count} saved</div>
      </div>`
    }).join('')

    // Top domains
    if (s.topDomains.length) {
      const max = s.topDomains[0]?.count || 1
      $('topDomains').innerHTML = `
        <div class="stat-section-title">Top domains</div>
        ${s.topDomains.map(({ domain, count }) => `
          <div class="stat-row">
            <div class="stat-row-label">${escHtml(domain)}</div>
            <div class="stat-row-bar" style="width:${Math.round((count/max)*60)}px"></div>
            <div class="stat-row-count">${count}</div>
          </div>`).join('')}`
    }

    // Type breakdown
    const typeEmojis = { link: '🔗', note: '📝', image: '🖼', quote: '❝', code: '💻', file: '📎' }
    const typeEntries = Object.entries(s.byType).sort((a, b) => b[1] - a[1])
    if (typeEntries.length) {
      const maxT = typeEntries[0][1] || 1
      $('typeBreakdown').innerHTML = `
        <div class="stat-section-title">By type</div>
        ${typeEntries.map(([type, count]) => `
          <div class="stat-row">
            <div class="stat-row-label">${typeEmojis[type] || '•'} ${type}</div>
            <div class="stat-row-bar" style="width:${Math.round((count/maxT)*60)}px"></div>
            <div class="stat-row-count">${count}</div>
          </div>`).join('')}`
    }
  } catch (err) {
    if ($('statsBody')) $('statsBody').innerHTML = `<div style="color:#888;font-size:11px;padding:6px">Could not load stats.</div>`
  }
}

async function renderSyncHealth() {
  const pending = await getUnsyncedItems()
  const failed = pending.filter(item => item.lastSyncError)
  $('syncHealthSummary').textContent = `Sync health · ${pending.length} pending${failed.length ? ` · ${failed.length} failed` : ''}`
  $('syncHealthList').innerHTML = pending.length
    ? pending.map(item => `
      <div class="health-entry">
        <strong>${escHtml(item.title || item.url || item.type)}</strong>
        <span>${item.syncAttempts || 0} attempt${item.syncAttempts === 1 ? '' : 's'}</span>
        ${item.lastSyncError ? `<div class="error-text">${escHtml(item.lastSyncError)}</div>` : ''}
        <button class="small-btn health-retry-btn" data-id="${item.id}">Retry</button>
      </div>`).join('')
    : '<div class="health-entry">Everything synced.</div>'
  document.querySelectorAll('.health-retry-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await retryItem(parseInt(btn.dataset.id))
      await requestSync()
    })
  })
}

// ── App status ────────────────────────────────────────────────────────────────

async function updateStatus() {
  try {
    await getAppStatus()
    appOnline = true
  } catch { appOnline = false }

  const dot  = $('statusDot')
  const text = $('statusText')
  if (appOnline) {
    dot.className  = 'status-dot online'
    const unsynced = (await getUnsyncedItems()).length
    text.textContent = unsynced > 0
      ? `Hoard running · ${unsynced} item${unsynced > 1 ? 's' : ''} pending sync`
      : 'Hoard running · all synced'
  } else {
    dot.className  = 'status-dot offline'
    text.textContent = 'Saves locally · syncs when Hoard opens'
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function syncNow() {
  if (!appOnline) { alert('Hoard app is not running.'); return }
  const btn = $('syncBtn')
  btn.textContent = '↑ Syncing…'
  btn.classList.add('syncing')

  try {
    const pending = await getUnsyncedItems()
    if (!pending.length) { btn.textContent = '✓ All synced'; setTimeout(() => { btn.textContent = '↑ Sync'; btn.classList.remove('syncing') }, 2000); return }

    await chrome.runtime.sendMessage({ action: 'hoard:sync-now' })
    const remaining = (await getUnsyncedItems()).length
    btn.textContent = `✓ Synced ${pending.length - remaining}`
    setTimeout(() => { btn.textContent = '↑ Sync'; btn.classList.remove('syncing') }, 2500)
    await reload()
    await updateStatus()
  } catch (err) {
    btn.textContent = '↑ Sync'
    btn.classList.remove('syncing')
  }
}

async function requestSync() {
  await chrome.runtime.sendMessage({ action: 'hoard:sync-now' })
  await reload()
  await updateStatus()
}

async function loadTaxonomy() {
  try {
    const { vaults = [] } = await getAppStatus()
    const stored = await chrome.storage.local.get(['selectedVaultId'])
    const vaultId = stored.selectedVaultId || vaults[0]?.id
    if (!vaultId) return
    const res = await fetch(`${API}/data?vaultId=${vaultId}`, { signal: AbortSignal.timeout(2000) })
    const data = await res.json()
    folders = data.folders || []
    tags = data.tags || []
  } catch {
    folders = []
    tags = []
  }
  renderFolderOptions()
}

function renderFolderOptions() {
  const options = `<option value="">No folder</option>${folders.map(folder => `<option value="${folder.id}">${escHtml(folder.name)}</option>`).join('')}`
  $('editFolder').innerHTML = options
  $('ruleFolder').innerHTML = options
}

function openEditor(id) {
  editingItem = allItems.find(item => item.id === id)
  if (!editingItem) return
  $('editTitle').value = editingItem.title || ''
  $('editFolder').value = editingItem.folderId || ''
  $('editTags').innerHTML = tags.length
    ? tags.map(tag => `<button class="tag-option ${(editingItem.tagIds || []).includes(tag.id) ? 'selected' : ''}" data-id="${tag.id}">${escHtml(tag.name)}</button>`).join('')
    : '<span style="color:#6a6a80;font-size:11px">No desktop tags available.</span>'
  $('editTags').querySelectorAll('.tag-option').forEach(btn => btn.addEventListener('click', () => btn.classList.toggle('selected')))
  $('editOverlay').classList.add('visible')
}

function closeEditor() {
  editingItem = null
  $('editOverlay').classList.remove('visible')
}

async function loadPreferences() {
  const stored = await chrome.storage.local.get(['duplicatePolicy', 'domainRules'])
  $('duplicatePolicy').value = stored.duplicatePolicy || 'skip'
  domainRules = Array.isArray(stored.domainRules) ? stored.domainRules : []
  renderRules()
}

function renderRules() {
  $('rulesList').innerHTML = domainRules.length
    ? domainRules.map((rule, index) => {
      const folder = folders.find(entry => entry.id === Number(rule.folderId))
      return `<div class="rule-entry">${escHtml(rule.domain)} → ${escHtml(folder?.name || 'No folder')} <button class="small-btn remove-rule-btn" data-index="${index}">Remove</button></div>`
    }).join('')
    : '<div class="rule-entry">No automatic filing rules.</div>'
  document.querySelectorAll('.remove-rule-btn').forEach(btn => btn.addEventListener('click', async () => {
    domainRules.splice(parseInt(btn.dataset.index), 1)
    await chrome.storage.local.set({ domainRules })
    renderRules()
  }))
}

// ── Event listeners ───────────────────────────────────────────────────────────

$('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase().trim()
  focusedIdx  = -1
  applyFilters()
})

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    activeFilter = btn.dataset.filter
    focusedIdx   = -1
    applyFilters()
  })
})

$('syncBtn').addEventListener('click', syncNow)
$('retryAllBtn').addEventListener('click', requestSync)
$('duplicatePolicy').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ duplicatePolicy: e.target.value })
})
$('addRuleBtn').addEventListener('click', async () => {
  const domain = $('ruleDomain').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  if (!domain) return
  domainRules = domainRules.filter(rule => rule.domain !== domain)
  domainRules.push({ domain, folderId: $('ruleFolder').value ? parseInt($('ruleFolder').value) : null, tagIds: [] })
  await chrome.storage.local.set({ domainRules })
  $('ruleDomain').value = ''
  renderRules()
})
$('cancelEditBtn').addEventListener('click', closeEditor)
$('saveEditBtn').addEventListener('click', async () => {
  if (!editingItem) return
  const tagIds = [...$('editTags').querySelectorAll('.tag-option.selected')].map(btn => parseInt(btn.dataset.id))
  await updateItem(editingItem.id, {
    title: $('editTitle').value.trim() || null,
    folderId: $('editFolder').value ? parseInt($('editFolder').value) : null,
    tagIds
  })
  closeEditor()
  await reload()
})

// ── Init ──────────────────────────────────────────────────────────────────────

// ── Reader view ───────────────────────────────────────────────────────────────

function openReader(item) {
  const overlay = $('readerOverlay')
  if (!overlay) return

  const domain    = item.url ? getDomain(item.url) : item.type
  const title     = item.title || domain || 'Untitled'
  const content   = item.content || ''
  const time      = timeAgo(item.created_at)
  const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  const readMins  = Math.max(1, Math.ceil(wordCount / 200))
  const readLabel = wordCount > 50 ? ` · ~${readMins} min read` : ''

  // Build readable HTML from plain text or existing HTML
  const body = content.startsWith('<')
    ? content
    : content.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')

  $('readerTitle').textContent  = title
  $('readerMeta').textContent   = `${domain} · ${time}${readLabel}`
  $('readerBody').innerHTML     = `<p>${body}</p>`
  $('readerLink').href          = item.url || '#'
  $('readerLink').style.display = item.url ? 'inline-flex' : 'none'

  overlay.classList.add('visible')
}

function closeReader() {
  $('readerOverlay')?.classList.remove('visible')
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

function setFocusedIdx(newIdx) {
  focusedIdx = Math.max(-1, Math.min(newIdx, filtered.length - 1))
  renderItems()
  // Scroll focused item into view
  if (focusedIdx >= 0) {
    const row = $('itemsList')?.querySelector(`.item-row[data-idx="${focusedIdx}"]`)
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

function setupKeyboardNav() {
  const FILTER_KEYS = ['1', '2', '3', '4', '5', '6']
  const FILTER_NAMES = ['all', 'link', 'note', 'image', 'quote', 'code']

  document.addEventListener('keydown', (e) => {
    // Don't interfere with input fields (except Escape)
    const inInput = document.activeElement?.tagName === 'INPUT' ||
                    document.activeElement?.tagName === 'TEXTAREA' ||
                    document.activeElement?.tagName === 'SELECT'

    // Escape: close reader, clear search, lose focus
    if (e.key === 'Escape') {
      if ($('readerOverlay')?.classList.contains('visible')) { closeReader(); return }
      if ($('editOverlay')?.classList.contains('visible'))   { closeEditor(); return }
      if (searchQuery) { $('searchInput').value = ''; searchQuery = ''; focusedIdx = -1; applyFilters(); return }
      focusedIdx = -1; renderItems()
      return
    }

    if (inInput) return

    // / → focus search
    if (e.key === '/') {
      e.preventDefault()
      $('searchInput')?.focus()
      $('searchInput')?.select()
      return
    }

    // ↑↓ → navigate items
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx(focusedIdx < 0 ? 0 : focusedIdx + 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx(focusedIdx <= 0 ? 0 : focusedIdx - 1)
      return
    }

    // Enter → open URL of focused item
    if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      const item = filtered[focusedIdx]
      if (item?.url) chrome.tabs.create({ url: item.url })
      return
    }

    // Delete / Backspace → delete focused item
    if ((e.key === 'Delete' || e.key === 'Backspace') && focusedIdx >= 0) {
      e.preventDefault()
      const item = filtered[focusedIdx]
      if (!item) return
      if (confirm(`Delete "${item.title || item.url || 'this item'}"?`)) {
        deleteItem(item.id).then(() => {
          focusedIdx = Math.min(focusedIdx, filtered.length - 2)
          reload()
        })
      }
      return
    }

    // r → read offline if item has content
    if (e.key === 'r' && focusedIdx >= 0) {
      const item = filtered[focusedIdx]
      if (item?.content && item.content.length > 80) openReader(item)
      return
    }

    // e → edit focused item
    if (e.key === 'e' && focusedIdx >= 0) {
      const item = filtered[focusedIdx]
      if (item) openEditor(item.id)
      return
    }

    // 1-6 → switch filter tabs
    if (FILTER_KEYS.includes(e.key)) {
      const name = FILTER_NAMES[parseInt(e.key) - 1]
      if (name) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
        const btn = document.querySelector(`.filter-btn[data-filter="${name}"]`)
        if (btn) btn.classList.add('active')
        activeFilter = name
        focusedIdx   = -1
        applyFilters()
      }
      return
    }
  })
}

async function init() {
  await loadTaxonomy()
  await loadPreferences()
  await reload()
  await updateStatus()
  setupKeyboardNav()
  $('readerClose')?.addEventListener('click', closeReader)

  // Show keyboard hint briefly when first arrow key is pressed
  let hintShown = false
  document.addEventListener('keydown', () => {
    if (hintShown) return
    hintShown = true
    const hint = $('kbdHint')
    if (hint) {
      hint.classList.add('visible')
      setTimeout(() => hint.classList.remove('visible'), 3500)
    }
  }, { once: false })
  // Refresh status every 30s
  setInterval(updateStatus, 30000)

  // Render stats when panel is toggled open
  const statsPanel = $('statsPanel')
  if (statsPanel) {
    statsPanel.addEventListener('toggle', () => {
      if (statsPanel.open) renderStats()
    })
  }
}

applyTranslations()
init()
