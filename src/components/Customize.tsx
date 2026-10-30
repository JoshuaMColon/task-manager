import { Check } from 'lucide-react'
import { useState } from 'react'
import { ACCENTS, AVATARS, SKIN_BY_ID, SKINS } from '../lib/skins'
import type { Profile } from '../lib/types'
import { Avatar } from './Avatar'
import { Modal } from './Modal'

export function Customize({ open, profile, onClose, onChange }: { open: boolean; profile: Profile; onClose(): void; onChange(p: Partial<Profile>): void }) {
  return (
    <Modal open={open} onClose={onClose} title="Customize player" wide>
      <CustomizeBody profile={profile} onChange={onChange} />
    </Modal>
  )
}

function CustomizeBody({ profile, onChange }: { profile: Profile; onChange(p: Partial<Profile>): void }) {
  const [name, setName] = useState(profile.display_name)
  const commitName = () => {
    const n = name.trim().slice(0, 32)
    if (n && n !== profile.display_name) onChange({ display_name: n })
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar avatar={profile.avatar} name={name || profile.display_name} size={64} />
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-bold text-muted">Player name</span>
          <input className="field" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => e.key === 'Enter' && commitName()} />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-muted">Avatar</legend>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          <AvatarChoice id="initials" label="Initials" profile={profile} onChange={onChange} />
          {AVATARS.map((a) => (
            <AvatarChoice key={a.id} id={a.id} label={a.label} profile={profile} onChange={onChange} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-muted">Skin</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SKINS.map((s) => (
            <label key={s.id} data-skin-preview={s.id} className={`relative cursor-pointer overflow-hidden rounded-skin-sm border-2 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${profile.skin === s.id ? 'border-accent' : 'border-line hover:border-line-strong'}`}>
              <input type="radio" name="skin" className="sr-only" checked={profile.skin === s.id} onChange={() => onChange({ skin: s.id })} />
              <SkinSwatch id={s.id} accent={s.accent} />
              <span className="mt-2 block font-bold">{s.name}</span>
              <span className="block text-xs text-muted">{s.tagline}</span>
              <span className="mt-1 block text-[11px] font-bold text-muted">{s.dark ? 'Dark' : 'Light'}{s.pair ? ` · pairs with ${SKIN_BY_ID[s.pair].name}` : ''}</span>
              {profile.skin === s.id && <Check className="absolute right-2 top-2 size-4 text-accent-ink" aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-muted">Accent color</legend>
        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${profile.accent === null ? 'border-accent text-accent-ink' : 'border-line'}`}>
            <input type="radio" name="accent" className="sr-only" checked={profile.accent === null} onChange={() => onChange({ accent: null })} />
            Skin default
          </label>
          {ACCENTS.map((c) => (
            <label key={c} className="relative grid size-8 cursor-pointer place-items-center rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink" style={{ background: c }}>
              <input type="radio" name="accent" className="sr-only" checked={profile.accent === c} onChange={() => onChange({ accent: c })} aria-label={`Accent ${c}`} />
              {profile.accent === c && <Check className="size-4 text-white drop-shadow" aria-hidden="true" />}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

function AvatarChoice({ id, label, profile, onChange }: { id: string; label: string; profile: Profile; onChange(p: Partial<Profile>): void }) {
  const on = profile.avatar === id
  return (
    <label title={label} className={`grid cursor-pointer place-items-center rounded-skin-sm border-2 p-1.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${on ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-surface-2'}`}>
      <input type="radio" name="avatar" className="sr-only" checked={on} onChange={() => onChange({ avatar: id })} aria-label={label} />
      <Avatar avatar={id} name={profile.display_name} size={40} />
    </label>
  )
}

const SWATCH: Record<string, [string, string, string]> = {
  forge: ['#14171b', '#262c34', '#3a424d'],
  alloy: ['#d4dae1', '#f5f7f9', '#9aa5b1'],
  bloom: ['#fbeaf3', '#ffffff', '#e9ddfb'],
  slate: ['#eef0f3', '#ffffff', '#dde1e6'],
}

function SkinSwatch({ id, accent }: { id: string; accent: string }) {
  const [bg, card, line] = SWATCH[id]
  return (
    <span aria-hidden="true" className="flex h-14 gap-1.5 rounded-md p-2" style={{ background: bg }}>
      <span className="w-1/3 rounded" style={{ background: card, border: `1px solid ${line}` }} />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="h-2 w-3/4 rounded-full" style={{ background: accent }} />
        <span className="h-2 rounded-full" style={{ background: line }} />
        <span className="h-2 w-1/2 rounded-full" style={{ background: line }} />
      </span>
    </span>
  )
}
