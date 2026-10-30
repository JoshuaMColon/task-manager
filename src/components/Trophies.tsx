import { Lock } from 'lucide-react'
import { ACHIEVEMENTS } from '../lib/achievements'
import type { Achievement, Stats } from '../lib/types'
import { Heatmap } from './Heatmap'

export function Trophies({ achievements, stats }: { achievements: Achievement[]; stats: Stats }) {
  const have = new Map(achievements.map((a) => [a.code, a.unlocked_at]))
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return (
    <div className="space-y-6">
      <section className="card p-5" aria-labelledby="activity-h">
        <h2 id="activity-h" className="display mb-3 text-sm font-extrabold">Activity · 26 weeks</h2>
        <Heatmap stats={stats} />
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Total XP', stats.total_xp.toLocaleString()],
            ['Best combo', `×${stats.best_streak}`],
            ['Quests cleared', stats.done.toLocaleString()],
            ['Open quests', stats.open.toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="rounded-skin-sm bg-surface-2 px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{k}</dt>
              <dd className="display text-lg font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="trophies-h">
        <h2 id="trophies-h" className="display mb-3 text-sm font-extrabold">
          Trophies · {have.size}/{ACHIEVEMENTS.length}
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const at = have.get(a.code)
            return (
              <li key={a.code} className={`card flex items-center gap-3 p-4 ${at ? '' : 'opacity-70'}`}>
                <span className={`hex grid size-12 shrink-0 place-items-center ${at ? 'bg-gold text-surface' : 'bg-surface-2 text-muted'}`}>
                  {at ? <a.icon className="size-5" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <p className="font-bold">{a.name}</p>
                  <p className="text-xs text-muted">{a.desc}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-muted">{at ? `Unlocked ${fmt.format(new Date(at))}` : 'Locked'}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
