const API = 'http://127.0.0.1:43210'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'hoard-save-page',  title: 'Save Page to Hoard',       contexts: ['page'] })
  chrome.contextMenus.create({ id: 'hoard-save-link',  title: 'Save Link to Hoard',        contexts: ['link'] })
  chrome.contextMenus.create({ id: 'hoard-save-image', title: 'Save Image to Hoard',       contexts: ['image'] })
  chrome.contextMenus.create({ id: 'hoard-save-video', title: 'Save Video Page to Hoard',  contexts: ['video'] })
})

// Read selected vault from persistent storage
async function getSelectedVaultId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['selectedVaultId'], (result) => {
      resolve(result.selectedVaultId || null)
    })
  })
}

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
      chrome.action?.setBadgeText({ text: '✓' })
      chrome.action?.setBadgeBackgroundColor({ color: '#c9952a' })
      setTimeout(() => chrome.action?.setBadgeText({ text: '' }), 2000)
    } else {
      console.error('Hoard server error:', response.statusText)
    }
  } catch (err) {
    console.error('Hoard is not running or unreachable:', err)
  }
}

// ── Omnibox — "hoard <query>" in the address bar ─────────────────────────────
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'hoard-save-page') {
    await sendToHoard({ type: 'link', url: info.pageUrl, title: tab?.title || info.pageUrl })

  } else if (info.menuItemId === 'hoard-save-link') {
    await sendToHoard({ type: 'link', url: info.linkUrl, title: info.linkText || info.linkUrl })

  } else if (info.menuItemId === 'hoard-save-image') {
    await sendToHoard({ type: 'image', srcUrl: info.srcUrl })

  } else if (info.menuItemId === 'hoard-save-video') {
    await sendToHoard({ type: 'link', url: info.pageUrl, title: tab?.title || info.pageUrl })
  }
})
