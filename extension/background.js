const API = 'http://127.0.0.1:43210'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'hoard-save-page',      title: 'Save Page to Hoard',           contexts: ['page'] })
  chrome.contextMenus.create({ id: 'hoard-save-link',      title: 'Save Link to Hoard',            contexts: ['link'] })
  chrome.contextMenus.create({ id: 'hoard-save-image',     title: 'Save Image to Hoard',           contexts: ['image'] })
  chrome.contextMenus.create({ id: 'hoard-save-video',     title: 'Save Video Page to Hoard',      contexts: ['video'] })
  chrome.contextMenus.create({ id: 'hoard-save-selection', title: 'Save Selection to Hoard',       contexts: ['selection'] })
})

// ── Persistent storage helpers ─────────────────────────────────────────────────

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve))
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve))
}

async function getSelectedVaultId() {
  const r = await storageGet(['selectedVaultId'])
  return r.selectedVaultId || null
}

// ── Daily badge counter ────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10)  // 'YYYY-MM-DD'
}

async function incrementDailyCount() {
  const { dailyCount = 0, dailyDate = '' } = await storageGet(['dailyCount', 'dailyDate'])
  const today = todayKey()
  const next  = dailyDate === today ? dailyCount + 1 : 1
  await storageSet({ dailyCount: next, dailyDate: today })
  return next
}

async function refreshBadge() {
  const { dailyCount = 0, dailyDate = '' } = await storageGet(['dailyCount', 'dailyDate'])
  const today = todayKey()
  if (dailyDate !== today) {
    chrome.action?.setBadgeText({ text: '' })
    return
  }
  if (dailyCount > 0) {
    const label = dailyCount >= 100 ? '99+' : String(dailyCount)
    chrome.action?.setBadgeText({ text: label })
    chrome.action?.setBadgeBackgroundColor({ color: '#c9952a' })
  } else {
    chrome.action?.setBadgeText({ text: '' })
  }
}

// Restore badge on startup/install
chrome.runtime.onStartup?.addListener(refreshBadge)
chrome.runtime.onInstalled.addListener(refreshBadge)

// ── Core save ─────────────────────────────────────────────────────────────────

async function sendToHoard(payload) {
  const vaultId = await getSelectedVaultId()
  if (vaultId) payload.vaultId = vaultId

  try {
    const response = await fetch(`${API}/add`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    })

    if (response.ok) {
      const count = await incrementDailyCount()
      const label = count >= 100 ? '99+' : String(count)
      chrome.action?.setBadgeText({ text: label })
      chrome.action?.setBadgeBackgroundColor({ color: '#c9952a' })
      // Flash a ✓ tick for 2 s, then restore the count
      chrome.action?.setBadgeText({ text: '✓' })
      chrome.action?.setBadgeBackgroundColor({ color: '#34d399' })
      setTimeout(async () => {
        const { dailyCount: c = 0, dailyDate: d = '' } = await storageGet(['dailyCount', 'dailyDate'])
        if (d === todayKey() && c > 0) {
          chrome.action?.setBadgeText({ text: c >= 100 ? '99+' : String(c) })
          chrome.action?.setBadgeBackgroundColor({ color: '#c9952a' })
        } else {
          chrome.action?.setBadgeText({ text: '' })
        }
      }, 2000)
    } else {
      console.error('Hoard server error:', response.statusText)
    }
  } catch (err) {
    console.error('Hoard is not running or unreachable:', err)
  }
}

// ── Quick Capture keyboard command ─────────────────────────────────────────────

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'quick-capture') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !tab.url.startsWith('http')) return
  await sendToHoard({ type: 'link', url: tab.url, title: tab.title || tab.url })
})

// ── Omnibox ───────────────────────────────────────────────────────────────────

chrome.omnibox?.onInputChanged.addListener(async (text, suggest) => {
  if (!text.trim()) return
  try {
    const vaultId = await getSelectedVaultId()
    const url = `${API}/search?q=${encodeURIComponent(text)}&limit=6${vaultId ? `&vaultId=${vaultId}` : ''}`
    const res = await fetch(url)
    if (!res.ok) return
    const { items } = await res.json()
    suggest(items.map((item) => ({
      content: item.url || item.title || '',
      description: `<match>${escapeXml(item.title || item.url || 'Untitled')}</match> <dim>${escapeXml(item.url || item.type || '')}</dim>`
    })).filter((s) => s.content))
  } catch { /* app offline */ }
})

chrome.omnibox?.onInputEntered.addListener((text, disposition) => {
  let url = text
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://127.0.0.1:43210/status`
  }
  const open = (u) => {
    if (disposition === 'currentTab') chrome.tabs.update({ url: u })
    else chrome.tabs.create({ url: u })
  }
  open(url)
})

function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Context menus ──────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'hoard-save-page') {
    await sendToHoard({ type: 'link', url: info.pageUrl, title: tab?.title || info.pageUrl })

  } else if (info.menuItemId === 'hoard-save-link') {
    await sendToHoard({ type: 'link', url: info.linkUrl, title: info.linkText || info.linkUrl })

  } else if (info.menuItemId === 'hoard-save-image') {
    await sendToHoard({ type: 'image', srcUrl: info.srcUrl })

  } else if (info.menuItemId === 'hoard-save-video') {
    await sendToHoard({ type: 'link', url: info.pageUrl, title: tab?.title || info.pageUrl })

  } else if (info.menuItemId === 'hoard-save-selection' && info.selectionText) {
    const snippet = info.selectionText.trim().slice(0, 200)
    const fullTitle = snippet.slice(0, 80) + (snippet.length > 80 ? '…' : '')
    await sendToHoard({
      type: 'note',
      content: `${info.selectionText.trim()}\n\n— [${tab?.title || info.pageUrl}](${info.pageUrl})`,
      title: fullTitle
    })
  }
})

// ── Message from content script (selection bubble click) ─────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== 'hoard:save-selection') return
  const text      = msg.text    || ''
  const pageUrl   = msg.pageUrl || ''
  const pageTitle = msg.pageTitle || pageUrl
  const codeLang  = msg.codeLang || null
  const isCode    = msg.isCode   || false

  const snippet = text.slice(0, 80) + (text.length > 80 ? '…' : '')

  if (isCode) {
    sendToHoard({
      type:    'code',
      content: text,
      title:   snippet,
      codeLang
    })
  } else {
    sendToHoard({
      type:    'note',
      content: `${text}\n\n— [${pageTitle}](${pageUrl})`,
      title:   snippet
    })
  }
})
