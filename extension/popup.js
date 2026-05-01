const API = 'http://127.0.0.1:43210'

const $ = (id) => document.getElementById(id)

// ── State ───────────────────────────────────────────────────────────────────
let currentTab = null
let isOnline   = false

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab

  if (tab) {
    const favicon = `https://www.google.com/s2/favicons?domain=${new URL(tab.url || 'about:blank').hostname}&sz=32`
    $('pageFavicon').src = favicon
    $('pageTitle').textContent = tab.title || tab.url || 'Current page'
  }

  // Check if Hoard is running
  await checkStatus()

  if (isOnline) {
    loadRecent()
  }
}

async function checkStatus() {
  try {
    const res = await fetch(`${API}/status`, { signal: AbortSignal.timeout(2000) })
    isOnline = res.ok
  } catch {
    isOnline = false
  }

  $('statusDot').className   = `status-dot ${isOnline ? 'online' : 'offline'}`
  $('onlineView').style.display  = isOnline ? 'block' : 'none'
  $('offlineView').style.display = isOnline ? 'none'  : 'block'
}

// ── Save current page ────────────────────────────────────────────────────────
$('saveCurrentBtn').addEventListener('click', async () => {
  if (!currentTab?.url) return
  await saveLink(currentTab.url, currentTab.title)
})

// ── Save manual URL ──────────────────────────────────────────────────────────
$('saveUrlBtn').addEventListener('click', () => saveFromInput())
$('urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveFromInput() })

async function saveFromInput() {
  const raw = $('urlInput').value.trim()
  if (!raw) return

  let url = raw
  if (!url.startsWith('http')) url = 'https://' + url

  try { new URL(url) } catch {
    showToast('Invalid URL', 'error')
    return
  }

  $('urlInput').value = ''
  await saveLink(url)
}

async function saveLink(url, title = '') {
  const btn = $('saveUrlBtn')
  const saveBtn = $('saveCurrentBtn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span>'
  saveBtn.style.opacity = '0.5'
  saveBtn.style.pointerEvents = 'none'

  try {
    const res = await fetch(`${API}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'link', url, title }),
      signal: AbortSignal.timeout(5000)
    })

    if (res.ok) {
      showToast('✓ Saved to Hoard! Enriching in background…', 'success')
      await loadRecent()
    } else {
      showToast('Failed to save — check the app', 'error')
    }
  } catch (err) {
    if (isOnline) {
      showToast('Save failed — is Hoard running?', 'error')
    }
  } finally {
    btn.disabled = false
    btn.textContent = 'Save'
    saveBtn.style.opacity = ''
    saveBtn.style.pointerEvents = ''
  }
}

// ── Load recent items ────────────────────────────────────────────────────────
async function loadRecent() {
  try {
    const res = await fetch(`${API}/recent`, { signal: AbortSignal.timeout(2000) })
    const { items } = await res.json()
    renderRecent(items || [])
  } catch {
    $('recentList').innerHTML = ''
  }
}

function renderRecent(items) {
  const list = $('recentList')
  if (!items.length) {
    list.innerHTML = '<div style="padding:8px 14px;color:#555568;font-size:12px">Nothing saved yet</div>'
    return
  }

  list.innerHTML = items.map(item => {
    const dotClass = `type-dot dot-${item.type}`
    const favicon  = item.favicon
      ? `<img src="${escHtml(item.favicon)}" alt="" style="width:14px;height:14px;object-fit:contain;" onerror="this.style.display='none'">`
      : `<span class="${dotClass}"></span>`

    const title = escHtml(item.title || item.url || 'Untitled')
    const meta  = item.url ? escHtml(getDomain(item.url)) : escHtml(item.type)
    const url   = item.url ? escHtml(item.url) : ''

    return `
      <div class="recent-item" data-url="${url}" title="${title}">
        <div class="recent-icon">${favicon}</div>
        <div class="recent-info">
          <div class="recent-title">${title}</div>
          <div class="recent-meta">${meta}</div>
        </div>
      </div>`
  }).join('')

  // Click to open URL
  list.querySelectorAll('.recent-item[data-url]').forEach(el => {
    el.addEventListener('click', () => {
      const url = el.getAttribute('data-url')
      if (url) chrome.tabs.create({ url })
    })
  })
}

// ── Open app ─────────────────────────────────────────────────────────────────
$('openAppBtn').addEventListener('click', () => {
  // There's no way to "focus" a native app from the browser extension.
  // The best we can do is tell the user, or try a custom protocol if you set one up.
  chrome.tabs.create({ url: 'http://127.0.0.1:43210/status' })
})

// ── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null
function showToast(msg, type = 'success') {
  const el = $('toast')
  el.textContent = msg
  el.className   = `toast ${type}`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.className = 'toast' }, 3500)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
init()
