import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  ChartNoAxesCombined,
  Leaf,
  Map,
  Menu,
  Pin,
  PinOff,
  Settings2,
  Sprout,
  X,
} from 'lucide-react'
import { usePreferences } from '../../app/preferences'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

const links = [
  { to: '/map', label: 'Bản đồ quan trắc', icon: Map },
  { to: '/history', label: 'Lịch sử đo', icon: ChartNoAxesCombined },
  { to: '/alerts', label: 'Cảnh báo', icon: Bell },
  { to: '/settings', label: 'Cài đặt', icon: Settings2 },
]
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="nav-links" aria-label="Điều hướng chính">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end onClick={onNavigate} title={label}>
          <Icon size={22} aria-hidden="true" />
          <span className="nav-text">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
function MobileDrawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.body.style.overflow = oldOverflow
      previous?.focus()
    }
  }, [])
  return (
    <div
      className="drawer-backdrop"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
        if (event.key !== 'Tab') return
        const items = ref.current?.querySelectorAll<HTMLElement>('button, a[href]')
        const first = items?.[0]
        const last = items?.[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      <button
        className="drawer-close-area"
        aria-label="Đóng nền menu"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
        ref={ref}
      >
        <div className="drawer-top">
          <strong>Khu vườn PAW</strong>
          <button className="icon-button" aria-label="Đóng menu" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <Navigation onNavigate={onClose} />
      </div>
    </div>
  )
}
export function AppShell() {
  const { mode } = usePreferences()
  const fieldMap = ['/', '/map', '/field-map'].includes(useLocation().pathname)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [opened, setOpened] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const expanded = pinned || hovered || opened
  return (
    <div className={pinned ? 'sidebar-pinned' : ''}>
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="app-header">
        <button
          className="icon-button mobile-menu"
          aria-label="Mở menu"
          onClick={() => setDrawer(true)}
        >
          <Menu size={21} />
        </button>
        <Link to="/" className="brand" aria-label="PAW — Trang chủ">
          <span className="brand-mark">
            <Leaf size={25} />
          </span>
          <span>
            <strong>PAW</strong>
            <small>NÔNG NGHIỆP THÔNG MINH</small>
          </span>
        </Link>
        <div className="header-title">
          <strong>Khu vườn PAW</strong>
          <span>Giám sát môi trường nông nghiệp</span>
        </div>
        <div className="header-actions">
          <span className="badge">
            <Sprout size={16} />{' '}
            {fieldMap
              ? 'Nội bộ PAW'
              : mode === 'DEMO'
                ? 'DEMO · Chưa kết nối API'
                : 'LIVE · Chưa xác minh kết nối'}
          </span>
          <Link className="icon-button notification-link" to="/alerts" aria-label="Xem cảnh báo">
            <Bell size={21} />
          </Link>
        </div>
      </header>
      <aside
        className={`sidebar desktop-sidebar ${expanded ? 'expanded' : ''}`}
        aria-label="Thanh điều hướng"
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <p className="eyebrow">Không gian làm việc</p>
        <Navigation />
        <div className="sidebar-footer">
          <button
            className="icon-button"
            aria-label={opened ? 'Thu gọn điều hướng' : 'Mở rộng điều hướng'}
            aria-expanded={expanded}
            onClick={() => {
              setOpened(!opened)
              setHovered(false)
            }}
          >
            <Menu size={20} />
          </button>
          {expanded && (
            <>
              <button
                className="button"
                aria-pressed={pinned}
                onClick={() => {
                  setPinned(!pinned)
                  setOpened(false)
                  setHovered(false)
                }}
              >
                {pinned ? <PinOff size={17} /> : <Pin size={17} />}
                {pinned ? 'Bỏ ghim menu' : 'Ghim menu'}
              </button>
              <span className="muted">PAW · Quan trắc môi trường</span>
            </>
          )}
        </div>
      </aside>
      <main id="main-content" className="content" tabIndex={-1}>
        <Outlet />
      </main>
      {drawer && <MobileDrawer onClose={() => setDrawer(false)} />}
    </div>
  )
}
