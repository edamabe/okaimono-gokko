import { useEffect, useRef, useState } from 'react'
import type { Screen } from '../App'
import { MAX_CART_ITEMS, type CartItem, type Corner, type Product, type Shop } from '../types'
import { img, voiceUrl } from '../lib/assets'
import { playVoice, playVoiceIfIdle, sfx } from '../lib/audio'
import { useDrag, useDragHandlers, type DragPayload } from '../lib/drag'
import { Cart } from '../components/Cart'
import { BurgerLayout } from './layouts/BurgerLayout'
import { FryerLayout } from './layouts/FryerLayout'
import { DrinkLayout } from './layouts/DrinkLayout'

interface Props {
  shop: Shop
  index: number
  cart: CartItem[]
  onAdd: (p: Product) => void
  onRemove: (uid: string) => void
  onGo: (s: Screen) => void
}

/** レイアウト固有のドラッグ処理。処理したら true を返す */
export interface LayoutHandlers {
  start?: (p: DragPayload) => boolean
  drop?: (p: DragPayload, target: string | null) => boolean
}

export interface LayoutProps {
  shop: Shop
  corner: Corner
  /** カート（トレー）に入れる（効果音・リアクション付き） */
  onAdd: (p: Product) => void
  handlers: React.MutableRefObject<LayoutHandlers>
  cartCount: number
}

export function CornerScreen({ shop, index, cart, onAdd, onRemove, onGo }: Props) {
  const corner = shop.corners[index]
  const [talking, setTalking] = useState(true)
  const [talkText, setTalkText] = useState<string | null>(null)
  const talkTimerRef = useRef<number | null>(null)
  const handlers = useRef<LayoutHandlers>({})

  useEffect(() => {
    setTalking(true)
    setTalkText(null)
    if (talkTimerRef.current) window.clearTimeout(talkTimerRef.current)
    void playVoice(voiceUrl(shop, corner.voice.id)).then(() => setTalking(false))
  }, [shop, corner])

  const handleTapStaff = () => {
    const talks = corner.staff.talks
    if (!talks || talks.length === 0) return
    sfx('pop')
    const candidates = talks.length > 1 ? talks.filter((t) => t.text !== talkText) : talks
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    setTalking(true)
    setTalkText(pick.text)
    if (talkTimerRef.current) window.clearTimeout(talkTimerRef.current)
    void playVoice(voiceUrl(shop, pick.id)).then(() => {
      setTalking(false)
      talkTimerRef.current = window.setTimeout(() => setTalkText(null), 3500)
    })
  }

  const addWithReaction = (product: Product) => {
    if (cart.length >= MAX_CART_ITEMS) {
      sfx('whoosh')
      return
    }
    onAdd(product)
    sfx('pop')
    const r = shop.reactions ?? []
    if (r.length && Math.random() < 0.35) {
      setTimeout(() => playVoiceIfIdle(voiceUrl(shop, r[Math.floor(Math.random() * r.length)].id)), 250)
    }
  }

  useDragHandlers(
    (p) => {
      if (handlers.current.start?.(p)) return
      if (p.kind === 'product') {
        sfx('pickup')
        void playVoice(voiceUrl(shop, `product_${p.id}`))
      }
    },
    (p, target) => {
      if (handlers.current.drop?.(p, target)) return
      if (p.kind === 'product' && target === 'cart') {
        if (cart.length >= MAX_CART_ITEMS) {
          sfx('whoosh')
          return
        }
        addWithReaction(p.data as Product)
      } else if (p.kind === 'cart-item' && target !== 'cart') {
        onRemove(p.id)
        sfx('whoosh')
      }
    },
  )

  const isFull = cart.length >= MAX_CART_ITEMS
  const prev = index > 0 ? { type: 'corner', index: index - 1 } as Screen : null
  const next: Screen = isFull ? { type: 'checkout' } : (index < shop.corners.length - 1 ? { type: 'corner', index: index + 1 } : { type: 'checkout' })
  const nextLabel = isFull ? 'おかいけいへ いこう！' : (next.type === 'checkout' ? 'おかいけい' : shop.corners[index + 1].name)
  const layoutProps: LayoutProps = { shop, corner, onAdd: addWithReaction, handlers, cartCount: cart.length }

  return (
    <main className={`corner layout-${corner.layout ?? 'shelf'}`} style={{ backgroundImage: `url(${img.bg(shop, corner.background.id)})`, '--corner': corner.color } as React.CSSProperties}>
      <section className="shelf-area">
        <div className="corner-head">
          <button className="staff-btn" onClick={handleTapStaff} type="button" aria-label={`${corner.staff.name}とおはなし`}>
            <img className={`staff ${talking ? 'talking' : ''}`} src={img.char(shop, corner.staff.id)} alt={corner.staff.name} draggable={false} />
          </button>
          <div className="bubble">
            <b>{corner.emoji} {corner.name}</b> コーナー
            <span>{isFull ? 'トレーが いっぱいに なったよ！ おかいけいに いこう！' : (talkText ?? corner.hint ?? `すきなものを ${shop.cartName ?? 'カート'}に いれてね！`)}</span>
          </div>
        </div>
        {(() => {
          switch (corner.layout ?? 'shelf') {
            case 'burger': return <BurgerLayout key={corner.id} {...layoutProps} />
            case 'fryer': return <FryerLayout key={corner.id} {...layoutProps} />
            case 'drink': return <DrinkLayout key={corner.id} {...layoutProps} />
            default: return <ShelfLayout shop={shop} corner={corner} />
          }
        })()}
      </section>

      <aside className="cart-area">
        <img className="shopper" src={img.char(shop, shop.shopper.id)} alt={shop.shopper.name} draggable={false} />
        <Cart shop={shop} items={cart} />
        <div className="nav-row">
          {prev && <button className="nav-btn prev" onClick={() => onGo(prev)}>◀</button>}
          <button className={`nav-btn next ${next.type === 'checkout' ? 'pay' : ''} ${isFull ? 'full-guide' : ''}`} onClick={() => onGo(next)}>
            {nextLabel} ▶
          </button>
        </div>
      </aside>
    </main>
  )
}

/** 陳列棚レイアウト（スーパー等） */
function ShelfLayout({ shop, corner }: { shop: Shop; corner: Corner }) {
  const { start, drag } = useDrag()
  const totalSlots = Math.max(16, Math.ceil(corner.products.length / 4) * 4)
  const emptyCount = totalSlots - corner.products.length

  return (
    <div className="shelf">
      {corner.products.map((p) => (
        <button key={p.id} className={`product ${drag?.payload.id === p.id ? 'lifted' : ''}`}
          onPointerDown={(e) => start(e, { kind: 'product', id: p.id, image: img.product(shop, p.id), data: p })}>
          <img src={img.product(shop, p.id)} alt={p.name} draggable={false} />
          <span className="product-name">{p.name}</span>
        </button>
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <div key={`empty-${i}`} className="product empty" aria-hidden="true" />
      ))}
    </div>
  )
}
