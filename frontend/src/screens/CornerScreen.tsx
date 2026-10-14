import { useEffect, useState } from 'react'
import type { Screen } from '../App'
import type { CartItem, Corner, Product, Shop } from '../types'
import { img, voiceUrl } from '../lib/assets'
import { playVoice, playVoiceIfIdle, sfx } from '../lib/audio'
import { useDrag, useDragHandlers } from '../lib/drag'
import { Cart } from '../components/Cart'

interface Props {
  shop: Shop
  index: number
  cart: CartItem[]
  onAdd: (p: Product) => void
  onRemove: (uid: string) => void
  onGo: (s: Screen) => void
}

export function CornerScreen({ shop, index, cart, onAdd, onRemove, onGo }: Props) {
  const corner = shop.corners[index]
  const [talking, setTalking] = useState(true)

  useEffect(() => {
    setTalking(true)
    void playVoice(voiceUrl(shop, corner.voice.id)).then(() => setTalking(false))
  }, [shop, corner])

  useDragHandlers(
    (p) => {
      if (p.kind === 'product') {
        sfx('pickup')
        void playVoice(voiceUrl(shop, `product_${p.id}`))
      }
    },
    (p, target) => {
      if (p.kind === 'product' && target === 'cart') {
        onAdd(p.data as Product)
        sfx('pop')
        const r = shop.reactions ?? []
        if (r.length && Math.random() < 0.35) {
          setTimeout(() => playVoiceIfIdle(voiceUrl(shop, r[Math.floor(Math.random() * r.length)].id)), 250)
        }
      } else if (p.kind === 'cart-item' && target !== 'cart') {
        onRemove(p.id)
        sfx('whoosh')
      }
    },
  )

  const prev = index > 0 ? { type: 'corner', index: index - 1 } as Screen : null
  const next: Screen = index < shop.corners.length - 1 ? { type: 'corner', index: index + 1 } : { type: 'checkout' }
  const nextLabel = next.type === 'checkout' ? 'おかいけい' : shop.corners[index + 1].name

  return (
    <main className="corner" style={{ backgroundImage: `url(${img.bg(shop, corner.background.id)})`, '--corner': corner.color } as React.CSSProperties}>
      <section className="shelf-area">
        <div className="corner-head">
          <img className={`staff ${talking ? 'talking' : ''}`} src={img.char(shop, corner.staff.id)} alt={corner.staff.name} draggable={false} />
          <div className="bubble">
            <b>{corner.emoji} {corner.name}</b> コーナー
            <span>すきなものを カートに いれてね！</span>
          </div>
        </div>
        <ShelfLayout shop={shop} corner={corner} />
      </section>

      <aside className="cart-area">
        <img className="shopper" src={img.char(shop, shop.shopper.id)} alt={shop.shopper.name} draggable={false} />
        <Cart shop={shop} items={cart} />
        <div className="nav-row">
          {prev && <button className="nav-btn prev" onClick={() => onGo(prev)}>◀</button>}
          <button className={`nav-btn next ${next.type === 'checkout' ? 'pay' : ''}`} onClick={() => onGo(next)}>
            {nextLabel} ▶
          </button>
        </div>
      </aside>
    </main>
  )
}

/** コーナーの陳列レイアウト。将来ここに layout ごとの描画を追加する */
function ShelfLayout({ shop, corner }: { shop: Shop; corner: Corner }) {
  const { start, drag } = useDrag()
  switch (corner.layout ?? 'shelf') {
    case 'shelf':
    default:
      return (
        <div className="shelf">
          {corner.products.map((p) => (
            <button key={p.id} className={`product ${drag?.payload.id === p.id ? 'lifted' : ''}`}
              onPointerDown={(e) => start(e, { kind: 'product', id: p.id, image: img.product(shop, p.id), data: p })}>
              <img src={img.product(shop, p.id)} alt={p.name} draggable={false} />
              <span className="product-name">{p.name}</span>
            </button>
          ))}
        </div>
      )
  }
}
