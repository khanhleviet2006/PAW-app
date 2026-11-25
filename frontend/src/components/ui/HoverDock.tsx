import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import { Pin, PinOff } from 'lucide-react'
export function HoverDock({
  label,
  position,
  children,
  open,
  onOpenChange,
}: PropsWithChildren<{
  label: string
  position: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>) {
  const [localOpen, setLocalOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const revealed = open ?? localOpen
  const setOpen = onOpenChange ?? setLocalOpen
  return (
    <section
      className={`hover-dock dock-${position}`}
      data-open={revealed || pinned}
      aria-label={label}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!pinned && !event.currentTarget.contains(document.activeElement)) setOpen(false)
      }}
      onBlur={(event) => {
        if (!pinned && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setPinned(false)
          setOpen(false)
          event.stopPropagation()
          event.currentTarget.querySelector<HTMLButtonElement>('.dock-trigger')?.focus()
        }
      }}
    >
      <button
        className="button dock-trigger"
        aria-expanded={revealed || pinned}
        onClick={() => {
          if (pinned) setPinned(false)
          setOpen(true)
        }}
      >
        {label}
      </button>
      <div className="dock-content">
        <button
          className="button"
          onClick={(event) => {
            event.currentTarget
              .closest('section')
              ?.querySelector<HTMLButtonElement>('.dock-trigger')
              ?.focus()
            setPinned(false)
            setOpen(false)
          }}
        >
          Thu gọn {label}
        </button>
        <button
          className="button dock-pin"
          aria-label={`Ghim ${label}`}
          aria-pressed={pinned}
          onClick={() => setPinned(!pinned)}
        >
          {pinned ? <PinOff size={15} /> : <Pin size={15} />}
          {pinned ? 'Bỏ ghim' : 'Ghim'}
        </button>
        {children}
      </div>
    </section>
  )
}
