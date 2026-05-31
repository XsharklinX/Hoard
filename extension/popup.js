const API = 'http://127.0.0.1:43210'
const $ = (id) => document.getElementById(id)
const tr = (key, fallback) => chrome.i18n?.getMessage(key) || fallback
import('./i18n.js').then(({ applyTranslations }) => applyTranslations())

// ── State ────────────────────────────────────────────────────────────────────
let currentTab      = null
let isOnline        = false
let vaults          = []
let selectedVaultId = null
let selectedFolderId = null
let selectedTagIds   = new Set()
let currentUrlSaved  = false

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab

  if (tab) {
    try {
      const hostname = new URL(tab.url || 'about:blank').hostname
      $('pageFavicon').src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    } catch { /* ignore */ }
    $('pageTitle').textContent = tab.title || tab.url || 'Current page'
  }

  const stored = await storageGet(['selectedVaultId'])
  selectedVaultId = stored.selectedVaultId || null

  // Check app status (but don't hide UI if offline)
  await checkStatus()

  // Always load recents (from IndexedDB if offline, from app if online)
  await loadRecent()

  if (isOnline) {
    await loadVaultData()
    if (tab?.url && tab.url.startsWith('http')) checkIfAlreadySaved(tab.url)
    updateImportBoardBar()
  } else {
    // Check if current URL was already saved locally
    if (tab?.url && tab.url.startsWith('http')) checkIfAlreadySavedLocal(tab.url)
  }
}

// ── Status check — never hides the UI ────────────────────────────────────────
async function checkStatus() {
  try {
    const { getAppStatus } = await import('./api.js')
    const data = await getAppStatus()
    isOnline = true
    vaults   = data.vaults || []
  } catch {
    isOnline = false
  }

  $('statusDot').className = `status-dot ${isOnline ? 'online' : 'offline'}`
  // Always show the save UI — just update the offline banner
  if ($('offlineBanner')) $('offlineBanner').style.display = isOnline ? 'none' : 'block'
  if ($('openAppBtn'))    $('openAppBtn').style.display    = isOnline ? 'inline-block' : 'none'
  if ($('vaultWrap') || $('vaultSelect')?.parentElement) {
    const vw = document.querySelector('.vault-wrap')
    if (vw) vw.style.display = isOnline ? 'block' : 'none'
  }
}

// ── Already saved check (local IndexedDB) ────────────────────────────────────
async function checkIfAlreadySavedLocal(url) {
  try {
    const { urlExists } = await import('./db.js')
    currentUrlSaved = await urlExists(url)
    updateSaveCurrentBtn()
  } catch { currentUrlSaved = false }
}

// ── Vault selector ────────────────────────────────────────────────────────────
async function loadVaultData() {
  if (!vaults.length) return

  // Default to stored vault or first vault
  if (!selectedVaultId || !vaults.find((v) => v.id === selectedVaultId)) {
    selectedVaultId = vaults[0].id
  }

  // Render vault dropdown
  const sel = $('vaultSelect')
  sel.innerHTML = vaults.map((v) =>
    `<option value="${v.id}" ${v.id === selectedVaultId ? 'selected' : ''}>${escHtml(v.name)}</option>`
  ).join('')

  sel.addEventListener('change', async () => {
    selectedVaultId  = parseInt(sel.value)
    selectedFolderId = null
    selectedTagIds   = new Set()
    await storageSet({ selectedVaultId })
    await loadFoldersTags()
    await loadRecent()
    if (currentTab?.url?.startsWith('http')) checkIfAlreadySaved(currentTab.url)
  })

  await loadFoldersTags()
}

async function loadFoldersTags() {
  if (!selectedVaultId) return
  try {
    const res  = await fetch(`${API}/data?vaultId=${selectedVaultId}`, { signal: AbortSignal.timeout(2000) })
    const data = await res.json()
    renderFolders(data.folders || [])
    renderTags(data.tags || [])

    const hasContent = (data.folders || []).length > 0 || (data.tags || []).length > 0
    $('metaRow').style.display = hasContent ? 'flex' : 'none'
  } catch {
    $('metaRow').style.display = 'none'
  }
}

function renderFolders(folders) {
  const sel = $('folderSelect')
  sel.innerHTML = `<option value="">${tr('noFolder', 'No folder')}</option>` +
    folders.map((f) => `<option value="${f.id}">${escHtml(f.name)}</option>`).join('')

  sel.addEventListener('change', () => {
    selectedFolderId = sel.value ? parseInt(sel.value) : null
  })
}

function renderTags(tags) {
  const wrap = $('tagsWrap')
  if (!tags.length) {
    wrap.innerHTML = `<span class="tags-empty">${tr('noTags', 'No tags')}</span>`
    return
  }

  wrap.innerHTML = tags.map((t) =>
    `<span class="tag-pill" data-id="${t.id}" style="background:${escHtml(t.color)}">${escHtml(t.name)}</span>`
  ).join('')

  wrap.querySelectorAll('.tag-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const id = parseInt(pill.dataset.id)
      if (selectedTagIds.has(id)) { selectedTagIds.delete(id); pill.classList.remove('selected') }
      else                        { selectedTagIds.add(id);    pill.classList.add('selected') }
    })
  })
}

// ── Already saved check ───────────────────────────────────────────────────────
async function checkIfAlreadySaved(url) {
  try {
    const res  = await fetch(`${API}/check?url=${encodeURIComponent(url)}&vaultId=${selectedVaultId || ''}`, { signal: AbortSignal.timeout(2000) })
    const data = await res.json()
    currentUrlSaved = !!data.exists
    updateSaveCurrentBtn()
  } catch {
    currentUrlSaved = false
  }
}

function updateSaveCurrentBtn() {
  const btn   = $('saveCurrentBtn')
  const label = $('saveLabel')
  if (currentUrlSaved) {
    btn.classList.add('saved')
    label.textContent = `✓ ${tr('saved', 'Saved')}`
    label.className   = 'action-label saved-lbl'
    btn.title         = 'Already in your Hoard'
  } else {
    btn.classList.remove('saved')
    label.textContent = `${tr('save', 'Save')} ↗`
    label.className   = 'action-label save-lbl'
    btn.title         = ''
  }
}

// ── Extract article text from active tab ──────────────────────────────────────
async function extractPageContent(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Remove noise: nav, headers, footers, scripts, ads
        const noise = document.querySelectorAll('nav,header,footer,aside,script,style,noscript,.ad,.ads,.advertisement,[aria-hidden="true"]')
        noise.forEach(el => el.remove())
        // Prefer article/main content
        const article = document.querySelector('article, [role="main"], main, .post-content, .article-body, .entry-content')
        const source  = article || document.body
        return source.innerText?.replace(/\s{3,}/g, '\n\n').trim().slice(0, 15000) || ''
      }
    })
    return results?.[0]?.result || ''
  } catch { return '' }  // e.g., chrome:// pages, PDFs
}

// ── Save current page ─────────────────────────────────────────────────────────
$('saveCurrentBtn').addEventListener('click', async () => {
  if (!currentTab?.url || currentUrlSaved) return
  const content = await extractPageContent(currentTab.id)
  await saveItem({ type: 'link', url: currentTab.url, title: currentTab.title || '', content: content || undefined })
})

// ── Save manual URL ───────────────────────────────────────────────────────────
$('saveUrlBtn').addEventListener('click', () => saveFromInput())
$('urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveFromInput() })

async function saveFromInput() {
  const raw = $('urlInput').value.trim()
  if (!raw) return
  let url = raw
  if (!url.startsWith('http')) url = 'https://' + url
  try { new URL(url) } catch { showToast('Invalid URL', 'error'); return }
  $('urlInput').value = ''
  await saveItem({ type: 'link', url })
}

// ── Quick note ────────────────────────────────────────────────────────────────
$('noteToggle').addEventListener('click', () => {
  const section = $('noteSection')
  const isOpen  = section.classList.toggle('open')
  if (isOpen) $('noteText').focus()
})

$('saveNoteBtn').addEventListener('click', saveNote)
$('noteText').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote()
})

async function saveNote() {
  const content = $('noteText').value.trim()
  if (!content) return
  $('noteText').value = ''
  $('noteSection').classList.remove('open')
  await saveItem({ type: 'note', content })
}

// ── Core save — always works offline via background.js → IndexedDB ───────────
async function saveItem(payload) {
  if (selectedVaultId)     payload.vaultId  = selectedVaultId
  if (selectedFolderId)    payload.folderId = selectedFolderId
  if (selectedTagIds.size) payload.tagIds   = [...selectedTagIds]

  const btn     = $('saveUrlBtn')
  const saveBtn = $('saveCurrentBtn')
  btn.disabled           = true
  btn.innerHTML          = '<span class="spinner"></span>'
  saveBtn.style.opacity  = '0.5'
  saveBtn.style.pointerEvents = 'none'

  try {
    const result = await chrome.runtime.sendMessage({ action: 'hoard:save-item', payload })
    if (!result?.ok) throw new Error(result?.error || 'Save failed')

    const msg = result.item?.duplicateAction === 'skipped'
      ? 'Already saved · skipped duplicate'
      : result.item?.duplicateAction === 'merged'
        ? '✓ Existing item updated'
        : isOnline ? '✓ Saved!' : '✓ Saved locally · syncs when app opens'
    showToast(msg, 'success')

    if (payload.url && currentTab?.url && payload.url === currentTab.url) {
      currentUrlSaved = true
      updateSaveCurrentBtn()
    }
    await loadRecent()
  } catch (err) {
    showToast('Save failed', 'error')
    console.error(err)
  } finally {
    btn.disabled = false
    btn.textContent = tr('save', 'Save')
    saveBtn.style.opacity = ''
    saveBtn.style.pointerEvents = ''
  }
}

// ── Recent items — reads from IndexedDB (always works) ────────────────────────
async function loadRecent() {
  try {
    const { getRecentItems } = await import('./db.js')
    const localItems = await getRecentItems(20)
    if (localItems.length) { renderRecent(localItems); return }
    // Fallback to app if local is empty and app is online
    if (!isOnline) return
    const res = await fetch(`${API}/recent?vaultId=${selectedVaultId || ''}&limit=20`, { signal: AbortSignal.timeout(2000) })
    const { items } = await res.json()
    renderRecent(items || [])
  } catch {
    $('recentList').innerHTML = `<div style="padding:8px 14px;color:#444455;font-size:11px">${tr('nothingSaved', 'Nothing saved yet')}</div>`
  }
}

function renderRecent(items) {
  const list = $('recentList')
  if (!items.length) {
    list.innerHTML = `<div style="padding:8px 14px;color:#444455;font-size:11px">${tr('nothingSaved', 'Nothing saved yet')}</div>`
    return
  }

  list.innerHTML = items.map((item) => {
    const typeColor = { link: '#38bdf8', note: '#4ade80', image: '#c084fc', code: '#fbbf24', quote: '#f472b6', file: '#fb923c' }
    const dotColor  = typeColor[item.type] || '#888'
    const dotClass  = `type-dot dot-${item.type}`
    const icon     = item.favicon
      ? `<img src="${escHtml(item.favicon)}" alt="" style="width:14px;height:14px;object-fit:contain;" onerror="this.style.display='none'">`
      : `<span class="${dotClass}" style="background:${dotColor}"></span>`
    const title = escHtml(item.title || item.url || 'Untitled')
    const meta  = item.type === 'quote' && item.attribution
      ? `❝ ${escHtml(item.attribution)}`
      : item.url ? escHtml(getDomain(item.url)) : escHtml(item.type)
    const url   = item.url ? escHtml(item.url) : ''

    return `
      <div class="recent-item" data-url="${url}" title="${title}">
        <div class="recent-icon">${icon}</div>
        <div class="recent-info">
          <div class="recent-title">${title}</div>
          <div class="recent-meta">${meta}</div>
        </div>
      </div>`
  }).join('')

  list.querySelectorAll('.recent-item[data-url]').forEach((el) => {
    el.addEventListener('click', () => {
      const url = el.getAttribute('data-url')
      if (url) chrome.tabs.create({ url })
    })
  })
}

// ── Import images from page ───────────────────────────────────────────────────
let importInProgress = false
let previewResolver = null
let previewImages = []

const BOARD_SITES = [
  { test: (h) => h.includes('pinterest.'),  label: '⊞ Import board' },
  { test: (h) => h.includes('flickr.com'),  label: '⊞ Import photos' },
  { test: (h) => h.includes('imgur.com'),   label: '⊞ Import album' },
  { test: (h) => h.includes('unsplash.com'),label: '⊞ Import images' },
  { test: (h) => h.includes('behance.net'), label: '⊞ Import project' },
  { test: (h) => h.includes('dribbble.com'),label: '⊞ Import shots' },
]

function getImportLabel(url) {
  try {
    const hostname = new URL(url).hostname
    const match = BOARD_SITES.find(s => s.test(hostname))
    return match ? match.label : '⊞ Import images from page'
  } catch { return null }
}

function extractFolderName(url, pageTitle) {
  try {
    const u     = new URL(url)
    const host  = u.hostname
    const parts = u.pathname.split('/').filter(Boolean)

    const fmt = (s) => s.replace(/[-_+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()

    // Pinterest: pinterest.com/username/board-name  → board-name
    if (host.includes('pinterest.') && parts.length >= 2) return fmt(parts[1])

    // Flickr: flickr.com/photos/user/albums/id/  → use page title
    // Behance / Dribbble / Imgur: use last path segment
    if (parts.length >= 1) {
      const last = parts[parts.length - 1]
      // Skip generic path segments
      if (!['photos', 'videos', 'images', 'gallery', 'album', 'sets', 'tags', 'search'].includes(last)) {
        return fmt(last)
      }
    }

    // Fallback: page title stripped of site name
    if (pageTitle) {
      return pageTitle
        .replace(/\s*[-|–—].*$/, '')
        .replace(/\s*on\s+\w[\w.]+$/, '')
        .trim()
        .slice(0, 60)
    }
    return ''
  } catch { return '' }
}

function updateImportBoardBar() {
  const bar   = $('importBoardBar')
  const label = $('importBoardLabel')
  const url   = currentTab?.url || ''
  if (!url.startsWith('http') || url.startsWith('http://127.0.0.1')) {
    bar.style.display = 'none'
    return
  }
  const text = getImportLabel(url)
  bar.style.display = 'block'
  label.textContent  = text || 'Import images from page'
}

// Listen for progress messages sent back from the content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== 'hoard:scrape-progress') return
  const pct = Math.min(80, Math.round((msg.round / msg.max) * 100))
  $('importProgress').classList.add('visible')
  $('importProgressText').textContent = `Scrolling… ${msg.found} images found`
  $('importProgressFill').style.width = `${pct}%`
})

$('importBoardBtn').addEventListener('click', async () => {
  if (importInProgress || !currentTab?.id) return
  importInProgress = true
  const btn = $('importBoardBtn')
  btn.disabled = true

  // Determine folder name NOW from the tab URL — no need to wait for content script
  const detectedFolder = extractFolderName(currentTab.url || '', currentTab.title || '')

  $('importProgress').classList.add('visible')
  $('importProgressText').textContent = detectedFolder ? `Scanning "${detectedFolder}"…` : 'Injecting…'
  $('importProgressFill').style.width = '3%'

  try {
    // Inject content script (guard prevents double-injection)
    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files:  ['content.js']
    })

    $('importProgressText').textContent = 'Scrolling through page…'
    $('importProgressFill').style.width = '8%'

    // Ask content script to start collecting
    const result = await chrome.tabs.sendMessage(currentTab.id, { action: 'hoard:scrape' })
    const images = result?.images || []
    // Use content script's suggestion if available, otherwise fall back to URL-based detection
    const folderName = (result?.folderName || detectedFolder || '').trim()

    if (!images.length) {
      showToast('No images found on this page', 'info')
      $('importProgress').classList.remove('visible')
      return
    }

    const selectedImages = await reviewImages(images)
    if (!selectedImages.length) {
      showToast('Import cancelled', 'info')
      $('importProgress').classList.remove('visible')
      return
    }

    $('importProgressText').textContent = `Saving ${selectedImages.length} images${folderName ? ` to "${folderName}"` : ''}…`
    $('importProgressFill').style.width = '88%'

    const { apiFetch } = await import('./api.js')
    const ruleFolderId = selectedFolderId || await getRuleFolderId(currentTab.url || '')
    const res = await apiFetch('/add-batch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        items:      selectedImages,
        vaultId:    selectedVaultId,
        folderName: ruleFolderId ? undefined : (folderName || undefined),
        folderId:   ruleFolderId || undefined,
        tagIds:     selectedTagIds.size ? [...selectedTagIds] : undefined
      }),
      signal: AbortSignal.timeout(15000)
    })

    const data      = await res.json()
    $('importProgressFill').style.width = '100%'
    const folderMsg = data.folderName ? ` in "${data.folderName}"` : ''
    $('importProgressText').textContent = `Done — ${data.count} images saved${folderMsg}`
    await loadRecent()
    setTimeout(() => $('importProgress').classList.remove('visible'), 3500)

  } catch {
    $('importProgress').classList.remove('visible')
    showToast('Import failed — is Hoard running?', 'error')
  } finally {
    importInProgress = false
    btn.disabled     = false
  }
})

function reviewImages(images) {
  const overlay = $('previewOverlay')
  const grid = $('previewGrid')
  $('previewTitle').textContent = `Review images before import · ${images.length} found`
  previewImages = images
  grid.innerHTML = images.map((image, index) => `
    <button class="preview-item" data-index="${index}" title="${escHtml(image.title || image.url || '')}">
      <img src="${escHtml(image.url || '')}" alt="" loading="lazy">
    </button>`).join('')
  grid.querySelectorAll('.preview-item').forEach(btn => btn.addEventListener('click', () => btn.classList.toggle('excluded')))
  overlay.classList.add('visible')
  return new Promise(resolve => { previewResolver = resolve })
}

function closePreview(confirm) {
  if (!previewResolver) return
  const excluded = new Set([...$('previewGrid').querySelectorAll('.preview-item.excluded')].map(btn => parseInt(btn.dataset.index)))
  const selected = [...$('previewGrid').querySelectorAll('.preview-item')]
    .filter(btn => !excluded.has(parseInt(btn.dataset.index)))
    .map(btn => parseInt(btn.dataset.index))
  const result = confirm ? selected : []
  $('previewOverlay').classList.remove('visible')
  const resolve = previewResolver
  previewResolver = null
  resolve(result.map(index => previewImages[index]))
  previewImages = []
}

$('cancelPreviewBtn').addEventListener('click', () => closePreview(false))
$('confirmPreviewBtn').addEventListener('click', () => closePreview(true))

// ── Open app (only visible when online) ──────────────────────────────────────
$('openAppBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://127.0.0.1:43210/status' })
})

// ── Browse all — opens side panel or a new tab ────────────────────────────────
$('browseBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') })
})

// ── Export all saved items ────────────────────────────────────────────────────
$('exportBtn').addEventListener('click', async () => {
  try {
    const { exportAll } = await import('./db.js')
    const data     = await exportAll()
    const json     = JSON.stringify(data, null, 2)
    const blob     = new Blob([json], { type: 'application/json' })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href         = url
    a.download     = `hoard-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Exported ${data.items.length} items`, 'success')
  } catch (err) {
    showToast('Export failed', 'error')
  }
})

// ── Import bookmarks ──────────────────────────────────────────────────────────
$('importBtn').addEventListener('click', () => $('bookmarkFile').click())

$('bookmarkFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ''

  const html = await file.text()
  const progress  = $('importProgress')
  const fillEl    = $('importProgressFill')
  const textEl    = $('importProgressText')

  progress.classList.add('visible')
  textEl.textContent = 'Importing…'
  fillEl.style.width = '15%'

  try {
    const { apiFetch } = await import('./api.js')
    const res  = await apiFetch('/bookmarks-import', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ html, vaultId: selectedVaultId }),
      signal:  AbortSignal.timeout(10000)
    })
    const data = await res.json()
    fillEl.style.width = '100%'
    textEl.textContent = `Done — ${data.count} bookmarks imported`
    await loadRecent()
    setTimeout(() => progress.classList.remove('visible'), 3000)
  } catch {
    progress.classList.remove('visible')
    showToast('Import failed — is Hoard running?', 'error')
  }
})

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null
function showToast(msg, type = 'success') {
  const el    = $('toast')
  el.textContent = msg
  el.className   = `toast ${type}`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.className = 'toast' }, 3500)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}

function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve))
}

async function getRuleFolderId(url) {
  let hostname = ''
  try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch { return null }
  const { domainRules = [] } = await storageGet(['domainRules'])
  const rule = domainRules.find(entry => {
    const domain = String(entry.domain || '').replace(/^www\./, '').toLowerCase()
    return domain && (hostname === domain || hostname.endsWith(`.${domain}`))
  })
  return rule?.folderId ? Number(rule.folderId) : null
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Escape — close popup
  if (e.key === 'Escape') { window.close(); return }

  // Enter on save-current button area (not inside inputs or textareas)
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  // S — focus URL input
  if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    $('urlInput')?.focus()
    return
  }

  // N — open note section
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    const section = $('noteSection')
    if (section && !section.classList.contains('open')) {
      section.classList.add('open')
      $('noteText')?.focus()
    }
    return
  }

  // Enter — save current page (when nothing else is focused)
  if (e.key === 'Enter') {
    e.preventDefault()
    if (!currentUrlSaved && currentTab?.url) $('saveCurrentBtn')?.click()
    return
  }
})

// Ctrl/Cmd+Enter inside URL input → save
$('urlInput')?.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveFromInput() }
})

// ── Boot ──────────────────────────────────────────────────────────────────────
init()
