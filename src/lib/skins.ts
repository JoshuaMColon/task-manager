import type { LucideIcon } from 'lucide-react'
import { Bird, Bot, Cat, Crown, Flame, Gem, Ghost, Leaf, Moon, Rocket, Shield, Swords, Wand2, Zap } from 'lucide-react'
import type { SkinId } from './types'

export interface Skin {
  id: SkinId
  name: string
  tagline: string
  accent: string
  dark: boolean
  /** Card surface colour, used to keep accent-coloured text readable. */
  surface: string
  /** Page background, used for the browser theme colour. */
  bg: string
  /** The same skin in the opposite light/dark mode, if it has one. */
  pair?: SkinId
}

export const SKINS: Skin[] = [
  { id: 'forge', name: 'Forge', tagline: 'Gunmetal steel, molten orange', accent: '#ff7a1a', dark: true, surface: '#1f242b', bg: '#14171b', pair: 'alloy' },
  { id: 'alloy', name: 'Alloy', tagline: 'Forge in daylight: brushed steel, molten orange', accent: '#ff7a1a', dark: false, surface: '#f5f7f9', bg: '#dde2e8', pair: 'forge' },
  { id: 'bloom', name: 'Bloom', tagline: 'Soft rose and violet', accent: '#c2367f', dark: false, surface: '#ffffff', bg: '#fbf3f7' },
  { id: 'slate', name: 'Slate', tagline: 'Clean, neutral, calm', accent: '#3b63d1', dark: false, surface: '#ffffff', bg: '#f3f4f6' },
]

/** Skins that share a look but differ in light/dark mode (Forge <-> Alloy). */
export function pairedSkin(id: SkinId): SkinId | undefined {
  return SKIN_BY_ID[id]?.pair
}

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s])) as Record<SkinId, Skin>

export const ACCENTS = ['#ff7a1a', '#e8b100', '#22a06b', '#0f9fb5', '#3b63d1', '#7c5cff', '#c2367f', '#e5484d']

export const AVATARS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'sword', label: 'Knight', icon: Swords },
  { id: 'shield', label: 'Guardian', icon: Shield },
  { id: 'wand', label: 'Mage', icon: Wand2 },
  { id: 'crown', label: 'Monarch', icon: Crown },
  { id: 'flame', label: 'Firebrand', icon: Flame },
  { id: 'zap', label: 'Storm', icon: Zap },
  { id: 'gem', label: 'Jeweler', icon: Gem },
  { id: 'leaf', label: 'Ranger', icon: Leaf },
  { id: 'moon', label: 'Night', icon: Moon },
  { id: 'rocket', label: 'Pilot', icon: Rocket },
  { id: 'bot', label: 'Droid', icon: Bot },
  { id: 'cat', label: 'Cat', icon: Cat },
  { id: 'bird', label: 'Falcon', icon: Bird },
  { id: 'ghost', label: 'Phantom', icon: Ghost },
]

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

function mix(hex: string, toward: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  return '#' + [1, 3, 5].map((i) => Math.round(ch(hex, i) + (ch(toward, i) - ch(hex, i)) * t).toString(16).padStart(2, '0')).join('')
}

/** The accent nudged darker (light skins) or lighter (dark skins) until it reads as text (4.5:1). */
export function accentInk(accent: string, surface: string, dark: boolean): string {
  let c = accent
  for (let t = 0.08; contrast(c, surface) < 4.6 && t <= 1; t += 0.08) c = mix(accent, dark ? '#ffffff' : '#000000', t)
  return c
}

/** Readable text colour on top of the accent (WCAG contrast). */
export function onAccent(hex: string): string {
  const L = luminance(hex)
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#14110f' : '#ffffff'
}

/** Applies skin + accent to <html> as data attributes / CSS custom properties. */
export function applySkin(skin: SkinId, accent: string | null) {
  const root = document.documentElement
  const s = SKIN_BY_ID[skin] ?? SKINS[0]
  const a = accent ?? s.accent
  root.dataset.skin = s.id
  root.style.setProperty('--accent', a)
  root.style.setProperty('--on-accent', onAccent(a))
  root.style.setProperty('--accent-ink', accentInk(a, s.surface, s.dark))
  root.style.colorScheme = s.dark ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', s.bg)
  try {
    localStorage.setItem('xplan:skin', JSON.stringify({ skin: s.id, accent }))
  } catch {
    /* ignore */
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? 'P') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
