// Default name for a new profile. I drop the +tag so jane.doe+xplan doesn't
// become "Jane Doe Xplan", then cap at 32 to match the profile check.
// xplan.name_from_email does the same in SQL. Bootstrap only writes the name
// on insert, so a name the player has set is never replaced by this.
export function nameFromEmail(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0].split('+')[0]
  const words = local.split(/[._-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  return words.join(' ').slice(0, 32).trim() || 'Player'
}
