export const APP_NAVIGATION_EVENT = 'app:navigate'

const isInternalUrl = (url: string) => {
  try {
    const target = new URL(url, window.location.origin)
    return target.origin === window.location.origin
  } catch {
    return false
  }
}

export const redirectTo = (url: string) => {
  if (!isInternalUrl(url)) {
    window.location.assign(url)
    return
  }

  const target = new URL(url, window.location.origin)
  const nextPath = `${target.pathname}${target.search}${target.hash}`

  window.dispatchEvent(
    new CustomEvent(APP_NAVIGATION_EVENT, {
      detail: { to: nextPath }
    })
  )
}
