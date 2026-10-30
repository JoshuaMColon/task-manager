import { CalendarCheck, Flame, Gauge, Sparkles, Target } from 'lucide-react'
import type { Profile, Stats } from '../lib/types'
import { rankTitle } from '../lib/xp'
import { Avatar } from './Avatar'

export function XpBar({ stats, label = true }: { stats: Stats; label?: boolean }) {
  const into = stats.total_xp - stats.level_floor
  const need = stats.level_next - stats.level_floor
  const pct = Math.max(0, Math.min(100, (into / need) * 100))
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between text-xs font-semibold text-muted">
          <span>
            <span className="display text-sm font-extrabold text-ink">{into.toLocaleString()}</span> / {need.toLocaleString()} XP
          </span>
          <span>{(stats.level_next - stats.total_xp).toLocaleString()} to Lv {stats.level + 1}</span>
        </div>
      )}
      <div className="xp-bar" role="progressbar" aria-label={`Level ${stats.level} progress`} aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function PlayerCard({ profile, stats, onCustomize }: { profile: Profile; stats: Stats; onCustomize: () => void }) {
  const tiles = [
    { icon: Flame, label: 'Combo', value: stats.current_streak ? `×${stats.current_streak}` : '—', hint: `Best ×${stats.best_streak}`, hot: stats.current_streak >= 3 },
    { icon: Target, label: 'Clear rate', value: stats.clear_rate === null ? '—' : `${stats.clear_rate}%`, hint: 'Last 30 days' },
    { icon: CalendarCheck, label: 'On time', value: stats.on_time_pct === null ? '—' : `${stats.on_time_pct}%`, hint: 'Of dated quests' },
    { icon: Sparkles, label: 'XP today', value: `+${stats.xp_today}`, hint: `${stats.done_today} cleared` },
  ]
  return (
    <section aria-labelledby="player-name" className="card framed relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <button type="button" onClick={onCustomize} className="rounded-full" aria-label="Customize player">
          <Avatar avatar={profile.avatar} name={profile.display_name} size={72} level={stats.level} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="display text-xs font-bold text-accent-ink">
            {rankTitle(stats.level)} · Level {stats.level}
          </p>
          <h2 id="player-name" className="display truncate text-2xl font-extrabold leading-tight">
            {profile.display_name}
          </h2>
          <p className="text-xs font-semibold text-muted">
            {stats.total_xp.toLocaleString()} XP total · {stats.done} quests cleared
          </p>
        </div>
        <Gauge className="hidden size-5 text-muted sm:block" aria-hidden="true" />
      </div>
      <div className="relative mt-4">
        <XpBar stats={stats} />
      </div>
      <dl className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-skin-sm border border-line bg-surface-2 px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              <t.icon className={`size-3.5 ${t.hot ? 'text-accent-ink' : ''}`} aria-hidden="true" />
              {t.label}
            </dt>
            <dd className={`display mt-0.5 text-xl font-extrabold ${t.hot ? 'text-accent-ink' : ''}`}>{t.value}</dd>
            <dd className="text-[11px] text-muted">{t.hint}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
