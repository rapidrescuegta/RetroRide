'use client'

/**
 * Guard for the "reload the page when a new service worker takes over" flow.
 *
 * `controllerchange` fires in two very different situations, and the app used
 * to treat them the same:
 *
 *  1. **The very first install.** The new worker calls `clients.claim()`, so it
 *     becomes the controller of a page that is already open — which fires
 *     `controllerchange`. Reloading there bounced every first-time visitor
 *     and threw away whatever they had already typed. It broke the purchase
 *     funnel outright: on `/family`, clicking "Send Code" made the code prompt
 *     vanish a second later (the email had been sent, the UI state was gone),
 *     so the visitor had to start over.
 *
 *  2. **A genuine update** — the new worker skips waiting and takes over.
 *     Here the reload is wanted: the page is still running the previous
 *     JavaScript, and the new worker has already purged the old asset cache,
 *     so a client-side navigation could request a chunk that no longer exists.
 *
 * So: reload on a real update, but never on the first install, and never while
 * the visitor is typing into a form.
 */

/** Set when the visitor explicitly asked to update (the toast's button). */
let userRequested = false

/** Makes sure the page is reloaded at most once per navigation. */
let reloaded = false

/** True when the visitor currently has focus in a text field. */
function isTyping(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(type)
}

/**
 * Whether the page may be reloaded after a service-worker takeover.
 *
 * @param hadController Whether the page was already controlled by a service
 *   worker BEFORE the new one took over. Capture it at mount time — by the
 *   time `controllerchange` fires, the new worker is already the controller.
 */
export function canReloadOnSwUpdate(hadController: boolean): boolean {
  if (typeof window === 'undefined') return false
  if (userRequested) return true
  // First install: the worker just claimed the page. Never bounce the visitor.
  if (!hadController) return false
  // The visitor is mid-word in a form — a reload would discard their input.
  if (isTyping()) return false
  return true
}

/** Records that the visitor explicitly asked to apply the update. */
export function requestSwReload(): void {
  userRequested = true
}

/** Reloads the page, at most once. */
export function reloadNow(): void {
  if (reloaded || typeof window === 'undefined') return
  reloaded = true
  window.location.reload()
}
