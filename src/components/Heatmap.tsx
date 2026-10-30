import { addDays, isoDow } from '../lib/dates'
import type { Stats } from '../lib/types'

/** 26-week completion heatmap (GitHub style), Monday-first columns. */
export function Heatmap({ stats, weeks = 26 }: { stats: Stats; weeks?: number }) {
  const counts = new Map(stats.heatmap.map((h) => [h.d, h.n]))
  const end = stats.today
  const start = addDays(addDays(end, -(isoDow(end) - 1)), -(weeks - 1) * 7)
  const days: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  const max = Math.max(1, ...stats.heatmap.map((h) => h.n))
  const active = stats.heatmap.filter((h) => h.n > 0).length
  const total = stats.heatmap.reduce((a, h) => a + h.n, 0)
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)))
  const shade = ['var(--bar-track)', 'color-mix(in oklab, var(--accent) 30%, var(--bar-track))', 'color-mix(in oklab, var(--accent) 55%, var(--bar-track))', 'color-mix(in oklab, var(--accent) 80%, var(--bar-track))', 'var(--accent)']
  return (
    <figure>
      <div
        role="img"
        aria-label={`${total} quests cleared on ${active} of the last ${days.length} days`}
        className="grid grid-flow-col grid-rows-7 gap-[2px] sm:gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, maxWidth: weeks * 17 }}
      >
        {days.map((d) => (
          <span key={d} title={`${d}: ${counts.get(d) ?? 0} cleared`} className="aspect-square w-full rounded-[2px] sm:rounded-[3px]" style={{ background: shade[level(counts.get(d) ?? 0)] }} />
        ))}
      </div>
      <figcaption className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{total} cleared · {active} active days</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          Less {shade.map((s, i) => <span key={i} className="size-2.5 rounded-[2px]" style={{ background: s }} />)} More
        </span>
      </figcaption>
    </figure>
  )
}
