// ── Nav scroll effect ─────────────────────────────────────────────────────────

const nav = document.getElementById('nav')
window.addEventListener('scroll', () => {
  if (window.scrollY > 30) nav.classList.add('scrolled')
  else nav.classList.remove('scrolled')
}, { passive: true })

// ── Mobile menu ───────────────────────────────────────────────────────────────

const mobileBtn  = document.getElementById('mobileMenuBtn')
const mobileMenu = document.getElementById('mobileMenu')
mobileBtn?.addEventListener('click', () => mobileMenu?.classList.toggle('open'))

function closeMobileMenu() {
  mobileMenu?.classList.remove('open')
}

// Close on click outside
document.addEventListener('click', (e) => {
  if (!nav.contains(e.target)) closeMobileMenu()
})

// ── Scroll animations ─────────────────────────────────────────────────────────

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger children within the same parent
      const parent    = entry.target.parentElement
      const siblings  = [...parent.querySelectorAll('[data-animate]')]
      const idx       = siblings.indexOf(entry.target)
      entry.target.style.transitionDelay = `${idx * 80}ms`
      entry.target.classList.add('visible')
      observer.unobserve(entry.target)
    }
  })
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el))

// ── GitHub Releases API ───────────────────────────────────────────────────────

const REPO = 'XsharklinX/Hoard'

async function fetchLatestRelease() {
  const badge = document.getElementById('versionBadge')
  try {
    const res  = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) throw new Error('No release found')
    const data = await res.json()

    const version     = data.tag_name || 'latest'
    const assets      = data.assets   || []
    const releaseUrl  = data.html_url

    // Update badge
    badge.innerHTML = `
      <div class="version-badge">
        🏷 Version ${version}
        &nbsp;·&nbsp;
        <a href="${releaseUrl}" target="_blank" style="color:inherit;text-decoration:underline;underline-offset:2px">View release notes →</a>
      </div>`

    // Map asset filenames to platform download buttons
    const platformMap = {
      windows: assets.find(a => a.name.match(/\.exe$|Setup\.exe$|windows/i)),
      mac:     assets.find(a => a.name.match(/\.dmg$|mac|darwin/i)),
      linux:   assets.find(a => a.name.match(/\.AppImage$|linux|\.deb$/i))
    }

    for (const [platform, asset] of Object.entries(platformMap)) {
      const btn = document.getElementById(`${platform}Btn`)
      if (btn && asset) {
        btn.href = asset.browser_download_url
        const size = (asset.size / 1024 / 1024).toFixed(1)
        const hint = btn.closest('.download-card')?.querySelector('.download-hint')
        if (hint) hint.textContent = `${asset.name} · ${size} MB`
      } else if (btn) {
        // Fallback to releases page
        btn.href = releaseUrl
      }
    }

    // Auto-detect platform and highlight
    highlightPlatform()

  } catch (err) {
    badge.innerHTML = `
      <div style="font-size:13px;color:var(--text-3)">
        <a href="https://github.com/${REPO}/releases" target="_blank" style="color:var(--gold)">
          View all releases on GitHub →
        </a>
      </div>`
    // Set fallback links
    ;['win','mac','linux'].forEach(p => {
      const btn = document.getElementById(`${p}Btn`)
      if (btn) btn.href = `https://github.com/${REPO}/releases`
    })
  }
}

function highlightPlatform() {
  const ua = navigator.userAgent
  let platform = 'win'
  if (/Mac/.test(ua))   platform = 'mac'
  if (/Linux/.test(ua)) platform = 'linux'

  const card = document.getElementById(`${platform}Card`)
  if (card) {
    card.style.borderColor = 'rgba(201,149,42,.5)'
    card.style.boxShadow   = '0 0 24px rgba(201,149,42,.12)'
    const badge = document.createElement('div')
    badge.style.cssText = 'font-size:11px;font-weight:700;color:var(--gold);text-align:center;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em'
    badge.textContent = '⭐ Recommended for your system'
    card.insertBefore(badge, card.firstChild)
  }
}

fetchLatestRelease()

// ── Copy code ─────────────────────────────────────────────────────────────────

function copyCode(btn) {
  const code = btn.dataset.code
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.textContent
    btn.textContent = '✓ Copied!'
    btn.style.color = 'var(--green)'
    setTimeout(() => { btn.textContent = orig; btn.style.color = '' }, 2000)
  })
}

// ── Smooth cursor blink for search demo ──────────────────────────────────────

const cursor = document.querySelector('.search-cursor')
if (cursor) {
  setInterval(() => {
    cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0'
  }, 500)
}

// ── Animate counter numbers ───────────────────────────────────────────────────

function animateNumber(el, target, duration = 1200) {
  const start     = 0
  const startTime = performance.now()
  const update    = (now) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased   = 1 - Math.pow(1 - progress, 3)
    el.textContent = Math.round(start + (target - start) * eased).toLocaleString()
    if (progress < 1) requestAnimationFrame(update)
  }
  requestAnimationFrame(update)
}

// Animate sidebar counts when hero is visible
const heroObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    document.querySelectorAll('.sidebar-count').forEach(el => {
      const target = parseInt(el.textContent.replace(',', ''))
      if (!isNaN(target)) animateNumber(el, target)
    })
    heroObserver.disconnect()
  }
}, { threshold: 0.3 })

const mockup = document.querySelector('.hero-mockup')
if (mockup) heroObserver.observe(mockup)

// ── Keyboard shortcut easter egg ──────────────────────────────────────────────

let keys = ''
document.addEventListener('keydown', (e) => {
  keys += e.key.toLowerCase()
  if (keys.endsWith('hoard')) {
    document.querySelectorAll('.gradient-text').forEach(el => {
      el.style.animation = 'none'
      el.style.background = 'linear-gradient(135deg, #f472b6, #c9952a, #4ade80)'
      el.style.webkitBackgroundClip = 'text'
      el.style.webkitTextFillColor = 'transparent'
      setTimeout(() => {
        el.style.background = ''
        el.style.webkitBackgroundClip = ''
        el.style.webkitTextFillColor = ''
      }, 3000)
    })
    keys = ''
  }
  if (keys.length > 10) keys = keys.slice(-10)
})
