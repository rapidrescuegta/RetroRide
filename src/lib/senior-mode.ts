// ─── Senior-friendly display mode ───────────────────────────────────────────
//
// A large-type, high-contrast presentation for care centres and classrooms.
// It is a Care Center / Classroom entitlement, but the switch itself is a
// local display preference: it lives in this device's localStorage and applies
// a class to <html>, so it takes effect immediately and works offline.
//
// The class is also applied by a tiny inline script in the root layout, so a
// returning user never sees the normal-size page flash first.

export const SENIOR_MODE_KEY = 'retroride-senior-mode'

export function isSeniorMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SENIOR_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function applySeniorMode(): boolean {
  if (typeof document === 'undefined') return false
  const on = isSeniorMode()
  document.documentElement.classList.toggle('senior-mode', on)
  return on
}

export function setSeniorMode(on: boolean): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (on) window.localStorage.setItem(SENIOR_MODE_KEY, '1')
    else window.localStorage.removeItem(SENIOR_MODE_KEY)
  } catch {
    // Private mode / storage disabled — still apply for this page view.
  }
  return applySeniorMode()
}

/**
 * The inline snippet that applies the class before first paint. Kept here so
 * the layout and the toggle can never drift apart.
 */
export const SENIOR_MODE_BOOTSTRAP = `(function(){try{if(localStorage.getItem('${SENIOR_MODE_KEY}')==='1'){document.documentElement.classList.add('senior-mode')}}catch(e){}})()`
