const LOCAL_LOGOUT_CHANNEL = 'auth_local_logout_channel'
const LOCAL_LOGOUT_STORAGE_KEY = 'auth:local-logout'

type LocalLogoutPayload = {
  id: string
  reason: 'logout'
  createdAt: number
}

const createPayload = (): LocalLogoutPayload => ({
  id: crypto.randomUUID(),
  reason: 'logout',
  createdAt: Date.now()
})

export const publishLocalLogout = () => {
  const payload = createPayload()

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(LOCAL_LOGOUT_CHANNEL)
    channel.postMessage(payload)
    channel.close()
  }

  try {
    localStorage.setItem(LOCAL_LOGOUT_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Best-effort fallback only.
  }
}

export const subscribeToLocalLogout = (onLogout: () => void) => {
  let channel: BroadcastChannel | null = null

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(LOCAL_LOGOUT_CHANNEL)
    channel.onmessage = () => onLogout()
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== LOCAL_LOGOUT_STORAGE_KEY || !event.newValue) return
    onLogout()
  }

  window.addEventListener('storage', handleStorage)

  return () => {
    channel?.close()
    window.removeEventListener('storage', handleStorage)
  }
}
