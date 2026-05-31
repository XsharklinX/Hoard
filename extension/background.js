import { saveItem, getUnsyncedItems, markItemsSynced, markItemSyncFailed, getTodayCount } from './db.js'
import { apiFetch, getAppStatus } from './api.js'
import { pushPendingItems } from './sync-core.js'

const API = 'http://127.0.0.1:43210'
const msg = (key, fallback) => chrome.i18n?.getMessage(key) || fallback

// ── App connection state ─────────────────────────────────────────────────────

let _appOnline = false

async function checkAppStatus() {
  try {
    await getAppStatus()
    _appOnline = true
  } catch {
    _appOnline = false
  }
  return _appOnline
}

// ── Context menus ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'hoard-save-page',           title: msg('savePage', 'Save Page to Hoard'), contexts: ['page'] })
    chrome.contextMenus.create({ id: 'hoard-save-link',           title: msg('saveLink', 'Save Link to Hoard'), contexts: ['link'] })
    chrome.contextMenus.create({ id: 'hoard-save-image',          title: msg('saveImage', 'Save Image to Hoard'), contexts: ['image'] })
    chrome.contextMenus.create({ id: 'hoard-save-video',          title: msg('saveVideo', 'Save Video to Hoard'), contexts: ['video'] })
    chrome.contextMenus.create({ id: 'hoard-save-selection',      title: msg('saveQuote', 'Save as Quote to Hoard'), contexts: ['selection'] })
    chrome.contextMenus.create({ id: 'hoard-save-selection-note', title: msg('saveNote', 'Save as Note to Hoard'), contexts: ['selection'] })
  })
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') })
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('hoard-sync', { periodInMinutes: 5 })
})

// ── Badge helpers ─────────────────────────────────────────────────────────────

async function refreshBadge() {
  try {
    const count = await getTodayCount()
    if (count > 0) {
      const label = count >= 100 ? '99+' : String(count)
      chrome.action?.setBadgeText({ text: label })
      chrome.action?.setBadgeBackgroundColor({ color: '#c9952a' })
    } else {
      chrome.action?.setBadgeText({ text: '' })
    }
  } catch { chrome.action?.setBadgeText({ text: '' }) }
}

chrome.runtime.onStartup?.addListener(refreshBadge)
chrome.runtime.onInstalled.addListener(refreshBadge)

// ── Core save — saves locally FIRST, then tries to push to app ───────────────

async function sendToHoard(payload) {
  const prepared = await applySavePreferences(payload)
  const saved = await saveItem(prepared)

  if (saved.duplicateAction === 'skipped') return saved

  // 2. Update badge
  await refreshBadge()

  // 3. Flash ✓ badge for 1.5s
  chrome.action?.setBadgeText({ text: '✓' })
  chrome.action?.setBadgeBackgroundColor({ color: '#34d399' })
  setTimeout(refreshBadge, 1500)

  // 4. Try to push to the app right now (fire and forget)
  pushToApp([saved]).catch(() => { /* app offline, will sync later */ })
  return saved
}

async function applySavePreferences(payload) {
  const stored = await chrome.storage.local.get(['duplicatePolicy', 'domainRules'])
  const prepared = { ...payload, duplicatePolicy: stored.duplicatePolicy || 'skip' }
  if (!prepared.url) return prepared

  let hostname = ''
  try { hostname = new URL(prepared.url).hostname.replace(/^www\./, '') } catch { return prepared }
  const rules = Array.isArray(stored.domainRules) ? stored.domainRules : []
  const rule = rules.find((entry) => {
    const domain = String(entry.domain || '').replace(/^www\./, '').toLowerCase()
    return domain && (hostname === domain || hostname.endsWith(`.${domain}`))
  })
  if (!rule) return prepared

  if (!prepared.folderId && rule.folderId) prepared.folderId = Number(rule.folderId)
  if ((!prepared.tagIds || !prepared.tagIds.length) && Array.isArray(rule.tagIds)) {
    prepared.tagIds = rule.tagIds.map(Number).filter(Boolean)
  }
  return prepared
}

async function pushToApp(items) {
  const online = await checkAppStatus()
  if (!online || !items.length) return []

  const storedVaultId = (await chrome.storage.local.get(['selectedVaultId'])).selectedVaultId

  return pushPendingItems({
    items: items.map((item) => ({ ...item, vaultId: item.vaultId ?? storedVaultId })),
    postItem: (payload) => apiFetch('/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(5000)
      }),
    markSynced: markItemsSynced,
    markFailed: markItemSyncFailed
  })
}

// ── Sync unsynced items to app ─────────────────────────────────────────────────

async function syncPending() {
  const pending = await getUnsyncedItems()
  if (!pending.length) return
  const pushedIds = await pushToApp(pending)
  if (pushedIds.length > 0) {
    chrome.runtime.sendMessage({ action: 'hoard:synced', count: pushedIds.length }).catch(() => {})
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'hoard-sync') syncPending().catch(console.error)
})

chrome.runtime.onStartup?.addListener(() => {
  chrome.alarms.create('hoard-sync', { periodInMinutes: 5 })
  syncPending().catch(console.error)
})

// ── Quick capture keyboard command ─────────────────────────────────────────────

chrome.commands?.onCommand.addListener(async (command) => {
  if (command === 'quick-capture') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url || !tab.url.startsWith('http')) return
    await sendToHoard({ type: 'link', url: tab.url, title: tab.title || tab.url })
  }
  if (command === 'open-side-panel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.windowId) {
      chrome.sidePanel?.open({ windowId: tab.windowId }).catch(() => {
        // Fallback: open as tab
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') })
      })
    }
  }
})

// ── Omnibox ───────────────────────────────────────────────────────────────────

chrome.omnibox?.onInputChanged.addListener(async (text, suggest) => {
  if (!text.trim()) return
  try {
    const { searchItems } = await import('./db.js')
    const items = await searchItems(text, 6)
    if (items.length) {
      suggest(items.map(item => ({
        content:     item.url || item.title || '',
        description: `<match>${escapeXml(item.title || item.url || 'Untitled')}</match> <dim>${escapeXml(item.url || item.type || '')}</dim>`
      })).filter(s => s.content))
      return
    }
    // Fallback to app search
    const online = await checkAppStatus()
    if (!online) return
    const { selectedVaultId } = await chrome.storage.local.get(['selectedVaultId'])
    const res = await fetch(`${API}/search?q=${encodeURIComponent(text)}&limit=6${selectedVaultId ? `&vaultId=${selectedVaultId}` : ''}`)
    if (!res.ok) return
    const { items: appItems } = await res.json()
    suggest((appItems || []).map(item => ({
      content:     item.url || item.title || '',
      description: `<match>${escapeXml(item.title || item.url || 'Untitled')}</match> <dim>${escapeXml(item.url || item.type || '')}</dim>`
    })).filter(s => s.content))
  } catch { /* ignore */ }
})

chrome.omnibox?.onInputEntered.addListener((text, disposition) => {
  if (!text.startsWith('http://') && !text.startsWith('https://')) return
  const open = (u) => {
    if (disposition === 'currentTab') chrome.tabs.update({ url: u })
    else chrome.tabs.create({ url: u })
  }
  open(text)
})

function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Context menus ─────────────────────────────────────────────────────────────

// ── Article text extraction (for context menu saves) ─────────────────────────

async function extractTabContent(tabId) {
  if (!tabId) return ''
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const noise = document.querySelectorAll('nav,header,footer,aside,script,style,noscript')
        noise.forEach(el => el.remove())
        const article = document.querySelector('article,[role="main"],main,.post-content,.article-body,.entry-content')
        const source  = article || document.body
        return source.innerText?.replace(/\s{3,}/g, '\n\n').trim().slice(0, 15000) || ''
      }
    })
    return results?.[0]?.result || ''
  } catch { return '' }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'hoard-save-page') {
    // Capture full article text in background
    const content = await extractTabContent(tab?.id)
    await sendToHoard({
      type: 'link', url: info.pageUrl, title: tab?.title || info.pageUrl,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(info.pageUrl).hostname}&sz=32`,
      content: content || undefined
    })

  } else if (info.menuItemId === 'hoard-save-link') {
    await sendToHoard({ type: 'link', url: info.linkUrl, title: info.linkText || info.linkUrl })

  } else if (info.menuItemId === 'hoard-save-image') {
    await sendToHoard({ type: 'image', url: info.srcUrl })

  } else if (info.menuItemId === 'hoard-save-video') {
    await sendToHoard({ type: 'link', url: info.pageUrl, title: tab?.title || info.pageUrl })

  } else if (info.menuItemId === 'hoard-save-selection' && info.selectionText) {
    const text = info.selectionText.trim()
    await sendToHoard({
      type: 'quote', content: text,
      attribution: tab?.title || info.pageUrl,
      url: info.pageUrl,
      title: text.slice(0, 80) + (text.length > 80 ? '…' : '')
    })

  } else if (info.menuItemId === 'hoard-save-selection-note' && info.selectionText) {
    const text = info.selectionText.trim()
    await sendToHoard({
      type: 'note', content: text,
      title: text.slice(0, 80) + (text.length > 80 ? '…' : '')
    })
  }
})

// ── Message from content script (selection bubble) ────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== 'hoard:save-selection') return
  const text      = msg.text       || ''
  const pageUrl   = msg.pageUrl    || ''
  const pageTitle = msg.pageTitle  || pageUrl
  const codeLang  = msg.codeLang   || null
  const isCode    = msg.isCode     || false
  const saveAsNote = msg.saveAsNote || false
  const snippet   = text.slice(0, 80) + (text.length > 80 ? '…' : '')

  if (isCode) {
    sendToHoard({ type: 'code', content: text, title: snippet, codeLang })
  } else if (saveAsNote) {
    sendToHoard({ type: 'note', content: text, title: snippet })
  } else {
    sendToHoard({ type: 'quote', content: text, attribution: pageTitle, url: pageUrl, title: snippet })
  }
})

// ── Export trigger ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'hoard:save-item') {
    sendToHoard(msg.payload)
      .then((item) => sendResponse({ ok: true, item }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }
  if (msg.action === 'hoard:export') {
    import('./db.js')
      .then(({ exportAll }) => exportAll())
      .then((data) => sendResponse({ data }))
      .catch((error) => sendResponse({ error: String(error) }))
    return true
  }
  if (msg.action === 'hoard:sync-now') {
    syncPending()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }))
    return true
  }
  if (msg.action === 'hoard:app-status') {
    checkAppStatus()
      .then((online) => sendResponse({ online }))
      .catch(() => sendResponse({ online: false }))
    return true
  }

  // ── "Already saved" check from content.js ───────────────────────────────
  if (msg.action === 'hoard:check-url') {
    import('./db.js')
      .then(({ findItemByUrl }) => findItemByUrl(msg.url))
      .then((item) => sendResponse({ exists: !!item, item: item || null }))
      .catch(() => sendResponse({ exists: false, item: null }))
    return true
  }

  // ── Open side panel from content.js toast click ──────────────────────────
  if (msg.action === 'hoard:open-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const win = tabs[0]?.windowId
      if (win) {
        chrome.sidePanel?.open({ windowId: win }).catch(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') })
        })
      }
    })
    sendResponse({ ok: true })
    return true
  }
})
