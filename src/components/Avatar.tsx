import { AVATARS, initials } from '../lib/skins'

export function Avatar({ avatar, name, size = 56, level }: { avatar: string; name: string; size?: number; level?: number }) {
  const found = AVATARS.find((a) => a.id === avatar)
  const Icon = found?.icon
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="hex absolute inset-0 bg-accent" />
      <div className="hex absolute inset-[3px] grid place-items-center bg-surface-2 text-accent-ink">
        {Icon ? <Icon style={{ width: size * 0.45, height: size * 0.45 }} aria-hidden="true" /> : <span className="display font-extrabold" style={{ fontSize: size * 0.34 }}>{initials(name)}</span>}
      </div>
      {level !== undefined && (
        <span className="display absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-skin-sm bg-accent px-1.5 text-[11px] font-extrabold leading-4 text-on-accent" aria-hidden="true">
          {level}
        </span>
      )}
    </div>
  )
}
