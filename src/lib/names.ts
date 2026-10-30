/**
 * Default player name from an email address: the local part without any +tag, split on . _ -
 * and capitalized ("jane.doe+xplan@x.com" → "Jane Doe"). Mirrors xplan.name_from_email in SQL.
 */
export function nameFromEmail(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0].split('+')[0]
  const words = local.split(/[._-]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  return words.join(' ').slice(0, 32).trim() || 'Player'
}
