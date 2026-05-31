const API = 'http://127.0.0.1:43210'

let pairingToken = null

async function rememberToken(token) {
  if (!token) return
  pairingToken = token
  await chrome.storage.local.set({ pairingToken: token })
}

export async function getAppStatus() {
  const res = await fetch(`${API}/status`, { signal: AbortSignal.timeout(2000) })
  if (!res.ok) throw new Error(`Desktop app returned ${res.status}`)
  const data = await res.json()
  await rememberToken(data.pairingToken)
  return data
}

async function getPairingToken() {
  if (pairingToken) return pairingToken
  const stored = await chrome.storage.local.get(['pairingToken'])
  if (stored.pairingToken) {
    pairingToken = stored.pairingToken
    return pairingToken
  }
  const status = await getAppStatus()
  return status.pairingToken
}

export async function apiFetch(path, options = {}) {
  const method = options.method || 'GET'
  if (method === 'GET') return fetch(`${API}${path}`, options)

  const token = await getPairingToken()
  const headers = { ...(options.headers || {}), 'X-Hoard-Token': token }
  let res = await fetch(`${API}${path}`, { ...options, headers })
  if (res.status === 401) {
    pairingToken = null
    await chrome.storage.local.remove(['pairingToken'])
    const refreshedToken = (await getAppStatus()).pairingToken
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), 'X-Hoard-Token': refreshedToken }
    })
  }
  return res
}
