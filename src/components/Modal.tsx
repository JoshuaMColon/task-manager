import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Native <dialog> (focus trap, Esc, inert background) with skin styling. */
export function Modal({ open, onClose, title, children, wide, top }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; top?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`anim-toast m-auto w-[calc(100%-1.5rem)] ${wide ? 'max-w-2xl' : 'max-w-lg'} ${top ? 'mt-[10vh]' : ''} rounded-skin border border-line bg-surface p-0 text-ink shadow-2xl`}
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="display text-lg font-extrabold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
