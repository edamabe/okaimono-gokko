import type { Screen } from '../App'
import { MAX_CART_ITEMS, type Shop } from '../types'

interface Props {
  shop: Shop
  screen: Screen
  cartCount: number
  sound: boolean
  onSound: () => void
  onGo: (s: Screen) => void
}

export function TopBar({ shop, screen, cartCount, sound, onSound, onGo }: Props) {
  const kidsRoom = `http://${location.hostname}:3010/kids.html`
  const isFull = cartCount >= MAX_CART_ITEMS
  return (
    <header className="topbar">
      <a className="round-btn home" href={kidsRoom} title="こどものへやに もどる">🏠</a>
      <nav className="tabs">
        {shop.corners.map((c, i) => {
          const active = screen.type === 'corner' && screen.index === i
          return (
            <button key={c.id} className={`tab ${active ? 'active' : ''}`}
              style={{ '--tab': c.color } as React.CSSProperties}
              onClick={() => onGo({ type: 'corner', index: i })}>
              <span className="tab-emoji">{c.emoji}</span>
              <span className="tab-label">{c.name}</span>
            </button>
          )
        })}
        <button className={`tab ${screen.type === 'checkout' ? 'active' : ''} ${isFull ? 'full-guide' : ''}`}
          style={{ '--tab': '#ef4444' } as React.CSSProperties}
          onClick={() => onGo({ type: 'checkout' })}>
          <span className="tab-emoji">🧾</span>
          <span className="tab-label">おかいけい</span>
          {cartCount > 0 && <span className={`badge ${isFull ? 'full' : ''}`}>{isFull ? `${cartCount} まんたん!` : cartCount}</span>}
        </button>
      </nav>
      <button className="round-btn" onClick={onSound} title="おと">{sound ? '🔊' : '🔇'}</button>
    </header>
  )
}
