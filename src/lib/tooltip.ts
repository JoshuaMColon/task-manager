/**
 * Hover/focus tooltips for icon-only buttons (and anything with data-tip).
 *
 * One delegated listener set and one tooltip element for the whole app, so every icon button gets
 * a label pop-up from its aria-label without wrapping components. Timing mirrors the native title
 * tooltip (≈0.5s on hover, placed below), but it also shows on keyboard focus, Esc dismisses it,
 * and touch never triggers it (no sticky tooltip after a tap).
 *
 * Opt in with data-tip="Text" (also for controls with visible text that need a hint);
 * opt out with data-tip-off. Controls that already carry a native title are left alone.
 */
const SHOW_DELAY = 500
const FOCUS_DELAY = 150
const WARM_DELAY = 60
const WARM_WINDOW = 500
const GAP = 8
const MARGIN = 8
const CANDIDATES = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], summary, [data-tip]'

let tip: HTMLDivElement | null = null
let current: HTMLElement | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastHidden = 0
let lastTouch = 0
let suppressed: HTMLElement | null = null
let pending: HTMLElement | null = null

function hasVisibleText(el: HTMLElement): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue
    let p = n.parentElement
    // Decorative glyphs (aria-hidden) aren't a label: an icon + ▼ chip still needs a tooltip.
    let visible = !!p && !p.closest('[aria-hidden="true"]')
    while (p && visible) {
      const cs = getComputedStyle(p)
      if (cs.display === 'none' || cs.visibility === 'hidden' || (p.clientWidth <= 1 && p.clientHeight <= 1 && cs.overflow !== 'visible')) visible = false
      if (p === el) break
      p = p.parentElement
    }
    if (visible) return true
  }
  return false
}

function labelOf(el: HTMLElement): string {
  const by = el.getAttribute('aria-labelledby')
  if (by) {
    const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim()
    if (t) return t
  }
  return el.getAttribute('aria-label')?.trim() ?? ''
}

/** The tooltip text for a control, or null when it shouldn't get one. */
export function tipFor(el: HTMLElement): string | null {
  if (el.closest('[data-tip-off]')) return null
  const explicit = el.getAttribute('data-tip')?.trim()
  if (explicit) return explicit
  if (el.hasAttribute('title')) return null // already has the native tooltip
  if (hasVisibleText(el)) return null // the visible label says it already
  return labelOf(el) || null
}

function target(from: EventTarget | null): HTMLElement | null {
  if (!(from instanceof Element)) return null
  const el = from.closest<HTMLElement>(CANDIDATES)
  return el && tipFor(el) ? el : null
}

function ensureTip(): HTMLDivElement {
  if (tip) return tip
  tip = document.createElement('div')
  tip.id = 'app-tooltip'
  tip.className = 'app-tooltip'
  tip.setAttribute('role', 'tooltip')
  tip.dataset.state = 'closed'
  tip.hidden = true
  document.body.appendChild(tip)
  return tip
}

function place(el: HTMLElement, t: HTMLDivElement) {
  // Fixed-position, but a transformed ancestor (e.g. an animating dialog) can move the origin.
  t.style.left = '0px'
  t.style.top = '0px'
  const origin = t.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const w = t.offsetWidth
  const h = t.offsetHeight
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  let side: 'bottom' | 'top' = 'bottom'
  let y = r.bottom + GAP
  if (y + h > vh - MARGIN && r.top - GAP - h >= MARGIN) {
    side = 'top'
    y = r.top - GAP - h
  }
  const x = Math.min(Math.max(r.left + r.width / 2 - w / 2, MARGIN), vw - w - MARGIN)
  t.dataset.side = side
  t.style.setProperty('--tip-arrow-x', `${Math.round(r.left + r.width / 2 - x)}px`)
  t.style.left = `${Math.round(x - origin.left)}px`
  t.style.top = `${Math.round(y - origin.top)}px`
}

function show(el: HTMLElement) {
  const text = tipFor(el)
  if (!text || !el.isConnected) return
  const t = ensureTip()
  // Inside a modal <dialog> or popover the tooltip must join the same top layer to be visible.
  const host = el.closest<HTMLElement>('dialog[open], [popover]') ?? document.body
  if (t.parentElement !== host) host.appendChild(t)
  t.textContent = text
  t.hidden = false
  place(el, t)
  current = el
  // Only describe when the tooltip adds something the accessible name doesn't already say.
  if (!labelOf(el).toLowerCase().includes(text.toLowerCase())) {
    const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    if (!ids.includes(t.id)) el.setAttribute('aria-describedby', [...ids, t.id].join(' '))
  }
  requestAnimationFrame(() => {
    if (current === el) t.dataset.state = 'open'
  })
}

export function hideTooltip() {
  clearTimeout(timer)
  pending = null
  if (!current || !tip) return
  const ids = (current.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== tip!.id)
  if (ids.length) current.setAttribute('aria-describedby', ids.join(' '))
  else current.removeAttribute('aria-describedby')
  current = null
  lastHidden = Date.now()
  tip.dataset.state = 'closed'
  tip.hidden = true
}

function schedule(el: HTMLElement, delay: number) {
  if (el === current || el === pending || el === suppressed) return
  if (current) hideTooltip()
  clearTimeout(timer)
  pending = el
  const warm = Date.now() - lastHidden < WARM_WINDOW
  timer = setTimeout(() => {
    pending = null
    show(el)
  }, warm ? WARM_DELAY : delay)
}

/** Install once at startup; returns a cleanup function. */
export function installTooltips(): () => void {
  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    const el = target(e.target)
    if (el) schedule(el, SHOW_DELAY)
  }
  const onOut = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(CANDIDATES)
    if (!el || (e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) return
    if (el === suppressed) suppressed = null
    if (el === current || el === pending) hideTooltip()
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') lastTouch = Date.now()
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(CANDIDATES) ?? null
    suppressed = el // like the native tooltip: no pop-up again until the pointer leaves
    hideTooltip()
  }
  const onFocusIn = (e: FocusEvent) => {
    const el = target(e.target)
    if (!el || Date.now() - lastTouch < 800) return
    let keyboard = true
    try {
      keyboard = el.matches(':focus-visible')
    } catch {
      /* old browsers */
    }
    if (keyboard) {
      suppressed = null
      schedule(el, FOCUS_DELAY)
    }
  }
  const onFocusOut = (e: FocusEvent) => {
    if (e.target === current) hideTooltip()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && current) {
      suppressed = current
      hideTooltip()
    }
  }
  const onScroll = () => hideTooltip()
  const opts = { capture: true, passive: true } as const
  document.addEventListener('pointerover', onOver, opts)
  document.addEventListener('pointerout', onOut, opts)
  document.addEventListener('pointerdown', onDown, opts)
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('focusout', onFocusOut, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('scroll', onScroll, opts)
  window.addEventListener('resize', onScroll, opts)
  window.addEventListener('blur', onScroll)
  return () => {
    hideTooltip()
    document.removeEventListener('pointerover', onOver, opts)
    document.removeEventListener('pointerout', onOut, opts)
    document.removeEventListener('pointerdown', onDown, opts)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('focusout', onFocusOut, true)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('scroll', onScroll, opts)
    window.removeEventListener('resize', onScroll, opts)
    window.removeEventListener('blur', onScroll)
    tip?.remove()
    tip = null
  }
}
