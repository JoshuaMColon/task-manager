import { Modal } from './Modal'

const ROWS: [string[], string][] = [
  [['Ctrl/⌘', 'K'], 'Command palette'],
  [['N'], 'New quest (quick add)'],
  [['/'], 'Search'],
  [['J', 'K'], 'Next / previous quest'],
  [['X'], 'Complete / reopen selected'],
  [['E'], 'Edit selected (or Enter)'],
  [['1–4'], 'Set priority P1–P4'],
  [['S'], 'Snooze to tomorrow'],
  [['Del'], 'Delete (with undo)'],
  [['G', 'H'], 'Go to HQ'],
  [['G', 'T'], 'Go to Daily missions'],
  [['G', 'U'], 'Go to Upcoming'],
  [['G', 'I'], 'Go to Inbox'],
  [['G', 'O'], 'Go to Overdue'],
  [['G', 'L'], 'Go to Quest log'],
  [['G', 'A'], 'Go to Trophies'],
  [['?'], 'This help'],
]

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {ROWS.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="kbd">{k}</kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted">On touch screens, swipe a quest right to complete it or left to snooze it to tomorrow.</p>
    </Modal>
  )
}
