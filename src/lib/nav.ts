import { CalendarClock, CalendarDays, Gamepad2, Inbox, ScrollText, Siren, Trophy } from 'lucide-react'
import type { ViewId } from './views'

export const NAV: { view: Exclude<ViewId, 'project'>; label: string; icon: typeof Inbox; key: string }[] = [
  { view: 'hq', label: 'HQ', icon: Gamepad2, key: 'H' },
  { view: 'today', label: 'Daily missions', icon: CalendarDays, key: 'T' },
  { view: 'upcoming', label: 'Upcoming', icon: CalendarClock, key: 'U' },
  { view: 'inbox', label: 'Inbox', icon: Inbox, key: 'I' },
  { view: 'overdue', label: 'Overdue', icon: Siren, key: 'O' },
  { view: 'log', label: 'Quest log', icon: ScrollText, key: 'L' },
  { view: 'trophies', label: 'Trophies', icon: Trophy, key: 'A' },
]
