// Guard against double-injection
if (!window.__hoardContentLoaded) {
  window.__hoardContentLoaded = true

  const IS_PINTEREST = location.hostname.includes('pinterest.')
  const SCROLL_DELAY  = IS_PINTEREST ? 2200 : 1500
  const MAX_ROUNDS    = IS_PINTEREST ? 60   : 25
  const MIN_DIMENSION = 150

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

  function suggestFolderName() {
    try {
      const parts = location.pathname.split('/').filter(Boolean)
      if (IS_PINTEREST && parts.length >= 2) {
        return parts[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }
      const title = document.title
        .replace(/\s*[\|\-–—].*$/, '')
        .replace(/\s*on\s+\w+$/, '')
        .trim()
      return title.slice(0, 60) || parts.pop() || ''
    } catch { return '' }
  }

  function upgradePinterestUrl(url) {
    return url.replace(/\/(?:60x60|236x|474x|564x)\//, '/736x/')
  }

  function getBestSrc(img) {
    let best = img.src || ''
    if (img.srcset) {
      const candidates = img.srcset.split(',')
        .map(s => {
          const [u, w] = s.trim().split(/\s+/)
          return { url: u || '', w: parseInt(w) || 0 }
        })
        .filter(c => c.url.startsWith('http'))
      if (candidates.length) {
        candidates.sort((a, b) => b.w - a.w)
        best = candidates[0].url
      }
    }
    const dataSrc = img.dataset?.src || img.getAttribute('data-original') || ''
    if (dataSrc.startsWith('http') && dataSrc.length > best.length) best = dataSrc
    if (best.includes('pinimg.com')) best = upgradePinterestUrl(best)
    return best
  }

  function harvest(seen, collected) {
    document.querySelectorAll('img').forEach(img => {
      const url = getBestSrc(img)
      if (!url || !url.startsWith('http') || seen.has(url)) return
      const w = img.naturalWidth  || img.width  || img.clientWidth  || 0
      const h = img.naturalHeight || img.height || img.clientHeight || 0
      if (w < MIN_DIMENSION && h < MIN_DIMENSION) return
      if (url.match(/\/(icon|logo|avatar|sprite|pixel|badge|button)[^/]*\.\w+/i)) return
      seen.add(url)
      const title = img.alt || img.title || document.title || ''
      collected.push({ url, title: title.slice(0, 200) })
    })
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'hoard:scrape') return

    ;(async () => {
      const seen      = new Set()
      const collected = []
      let prevHeight  = -1
      let stableRounds = 0

      for (let round = 0; round < MAX_ROUNDS; round++) {
        harvest(seen, collected)
        chrome.runtime.sendMessage({
          action: 'hoard:scrape-progress',
          found:  collected.length,
          round:  round + 1,
          max:    MAX_ROUNDS
        })
        const currentHeight = document.documentElement.scrollHeight
        window.scrollTo({ top: currentHeight, behavior: 'smooth' })
        await sleep(SCROLL_DELAY)
        const newHeight = document.documentElement.scrollHeight
        if (newHeight === prevHeight) {
          stableRounds++
          if (stableRounds >= 3) break
        } else {
          stableRounds = 0
        }
        prevHeight = newHeight
      }

      harvest(seen, collected)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const folderName = suggestFolderName()
      sendResponse({ images: collected, folderName })
    })()

    return true
  })

  // ── Selection bubble ─────────────────────────────────────────────────────────

  let _bubble   = null
  let _savedEl  = null
  let _hideTimer = null
  let _savedTimer = null

  function getBubble() {
    if (_bubble) return _bubble

    const iconUrl = chrome.runtime.getURL('icon.png')
    const host    = location.hostname.replace(/^www\./, '')

    _bubble = document.createElement('div')
    _bubble.setAttribute('data-hoard', 'bubble')

    // Shadow DOM so page styles don't bleed in
    const shadow = _bubble.attachShadow({ mode: 'open' })

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap {
          display: none;
          flex-direction: column;
          gap: 0;
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          width: 220px;
          overflow: hidden;
          user-select: none;
          pointer-events: all;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 11px 7px;
          border-bottom: 1px solid #1e1e1e;
        }
        .icon {
          width: 16px; height: 16px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .title {
          font-size: 12px;
          font-weight: 700;
          color: #e4e4e4;
          letter-spacing: .01em;
          flex: 1;
        }
        .source {
          font-size: 10px;
          color: #555;
          padding: 0 11px 0;
          line-height: 1;
          height: 0;
          overflow: hidden;
          transition: height .15s, padding .15s;
        }
        .preview {
          font-size: 11px;
          color: #666;
          padding: 7px 11px 0;
          line-height: 1.4;
          max-height: 46px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .actions {
          display: flex;
          gap: 6px;
          padding: 8px 11px 9px;
          margin-top: 4px;
        }
        .btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 5px 0;
          border-radius: 6px;
          border: 1px solid #282828;
          background: #1c1c1c;
          color: #aaa;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all .12s;
          font-family: inherit;
        }
        .btn:hover { background: #242424; color: #e4e4e4; border-color: #333; }
        .btn.primary {
          background: rgba(201,149,42,.12);
          border-color: rgba(201,149,42,.3);
          color: #c9952a;
        }
        .btn.primary:hover {
          background: rgba(201,149,42,.2);
          border-color: rgba(201,149,42,.5);
          color: #e0aa40;
        }
        .btn.saved {
          background: rgba(52,211,153,.1);
          border-color: rgba(52,211,153,.3);
          color: #34d399;
          pointer-events: none;
        }
        .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
      </style>
      <div class="wrap" id="wrap">
        <div class="header">
          <img class="icon" src="${iconUrl}" />
          <span class="title">Save to Hoard</span>
        </div>
        <div class="preview" id="preview"></div>
        <div class="actions">
          <button class="btn" id="btnNote" title="Save as note">
            <span class="dot" style="background:#6ee7b7"></span>Note
          </button>
          <button class="btn primary" id="btnQuote" title="Save as quote with source">
            Save ↗
          </button>
        </div>
      </div>
    `

    const wrap    = shadow.getElementById('wrap')
    const preview = shadow.getElementById('preview')
    const btnNote = shadow.getElementById('btnNote')
    const btnQuote = shadow.getElementById('btnQuote')

    function doSave(withSource) {
      const sel  = window.getSelection()
      const text = sel ? sel.toString().trim() : ''
      if (!text) return

      const content = withSource
        ? `${text}\n\n— [${document.title || host}](${location.href})`
        : text

      btnQuote.textContent = '✓ Saved'
      btnQuote.className   = 'btn saved'
      btnNote.className    = 'btn saved'
      btnNote.textContent  = '✓'

      chrome.runtime.sendMessage({
        action:    'hoard:save-selection',
        text:      content,
        pageUrl:   location.href,
        pageTitle: document.title
      })

      clearTimeout(_savedTimer)
      _savedTimer = setTimeout(() => hideBubble(), 900)
    }

    btnNote.addEventListener('mousedown',  (e) => { e.preventDefault(); e.stopPropagation(); doSave(false) })
    btnQuote.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); doSave(true) })

    // Store refs
    _bubble._wrap    = wrap
    _bubble._preview = preview

    Object.assign(_bubble.style, {
      all:      'initial',
      position: 'fixed',
      zIndex:   '2147483647',
      display:  'block',
    })

    document.documentElement.appendChild(_bubble)
    return _bubble
  }

  function showBubble(x, y, selectedText) {
    const b = getBubble()
    const wrap    = b._wrap
    const preview = b._preview

    // Update preview text
    preview.textContent = selectedText.slice(0, 120) + (selectedText.length > 120 ? '…' : '')

    // Reset buttons in case they were in saved state
    const btnNote  = b.shadowRoot.getElementById('btnNote')
    const btnQuote = b.shadowRoot.getElementById('btnQuote')
    btnNote.className  = 'btn'
    btnNote.innerHTML  = '<span class="dot" style="background:#6ee7b7"></span>Note'
    btnQuote.className = 'btn primary'
    btnQuote.textContent = 'Save ↗'

    wrap.style.display = 'flex'

    // Measure actual rendered width
    const bw = 220
    const bh = 130

    const vw = window.innerWidth
    const left = Math.max(6, Math.min(x - bw / 2, vw - bw - 6))
    const top  = Math.max(6, y - bh - 10)

    b.style.left = `${left}px`
    b.style.top  = `${top}px`
  }

  function hideBubble() {
    if (_bubble && _bubble._wrap) {
      _bubble._wrap.style.display = 'none'
    }
  }

  document.addEventListener('mouseup', (e) => {
    if (e.target && e.target.closest && e.target.closest('[data-hoard="bubble"]')) return
    // Also check shadow host
    if (_bubble && e.composedPath && e.composedPath().includes(_bubble)) return

    clearTimeout(_hideTimer)
    _hideTimer = setTimeout(() => {
      const sel  = window.getSelection()
      const text = sel ? sel.toString().trim() : ''

      if (text.length < 5) { hideBubble(); return }

      showBubble(e.clientX, e.clientY, text)
    }, 15)
  })

  document.addEventListener('mousedown', (e) => {
    if (_bubble && e.composedPath && e.composedPath().includes(_bubble)) return
    hideBubble()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideBubble()
  })

  document.addEventListener('selectionchange', () => {
    const sel  = window.getSelection()
    const text = sel ? sel.toString().trim() : ''
    if (!text) hideBubble()
  })
}
