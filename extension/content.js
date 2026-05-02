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
      // Pinterest: pinterest.com/username/board-name
      if (IS_PINTEREST && parts.length >= 2) {
        return parts[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }
      // General: clean up page title
      const title = document.title
        .replace(/\s*[\|\-–—].*$/, '')   // strip "| Site Name"
        .replace(/\s*on\s+\w+$/, '')      // strip "on Pinterest"
        .trim()
      return title.slice(0, 60) || parts.pop() || ''
    } catch { return '' }
  }

  function upgradePinterestUrl(url) {
    // Upgrade small Pinterest CDN sizes to 736x (highest non-original)
    return url.replace(/\/(?:60x60|236x|474x|564x)\//, '/736x/')
  }

  function getBestSrc(img) {
    let best = img.src || ''

    // Prefer srcset highest-width candidate
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

    // Also try data-src (lazy-load pattern)
    const dataSrc = img.dataset?.src || img.getAttribute('data-original') || ''
    if (dataSrc.startsWith('http') && dataSrc.length > best.length) best = dataSrc

    if (best.includes('pinimg.com')) best = upgradePinterestUrl(best)
    return best
  }

  function harvest(seen, collected) {
    document.querySelectorAll('img').forEach(img => {
      const url = getBestSrc(img)
      if (!url || !url.startsWith('http') || seen.has(url)) return

      // Size check — use naturalWidth if available, fall back to layout width
      const w = img.naturalWidth  || img.width  || img.clientWidth  || 0
      const h = img.naturalHeight || img.height || img.clientHeight || 0
      if (w < MIN_DIMENSION && h < MIN_DIMENSION) return

      // Skip obvious non-content images (tiny icons, 1px trackers)
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
        // Collect before scrolling so off-screen images aren't missed
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
          if (stableRounds >= 3) break   // reached the bottom
        } else {
          stableRounds = 0
        }
        prevHeight = newHeight
      }

      // Final pass after last scroll
      harvest(seen, collected)

      // Scroll back to top
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Suggest a folder name from the URL / page title
      const folderName = suggestFolderName()

      sendResponse({ images: collected, folderName })
    })()

    return true  // keep message channel open for async response
  })
}
