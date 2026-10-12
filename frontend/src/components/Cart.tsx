import { useEffect, useState } from 'react'
import type { CartItem, Shop } from '../types'
import { img } from '../lib/assets'
import { useDrag } from '../lib/drag'

interface Props {
  shop: Shop
  items: CartItem[]
  /** ドロップ先として受け付けるか */
  droppable?: boolean
  /** 中身をドラッグで取り出せるか */
  draggableItems?: boolean
  size?: 'large' | 'small'
}

const MAX_VISIBLE = 18

/** ショッピングカート。中身はカゴの中に山積みで表示される */
export function Cart({ shop, items, droppable = true, draggableItems = true, size = 'large' }: Props) {
  const { start, drag } = useDrag()
  const [bump, setBump] = useState(false)
  const over = drag?.over === 'cart' && drag.payload.kind === 'product'

  useEffect(() => {
    if (!items.length) return
    setBump(true)
    const t = setTimeout(() => setBump(false), 350)
    return () => clearTimeout(t)
  }, [items.length])

  const visible = items.slice(-MAX_VISIBLE)
  return (
    <div className={`cart cart-${size} ${over ? 'over' : ''} ${bump ? 'bump' : ''}`}
      {...(droppable ? { 'data-drop': 'cart' } : {})}>
      <img className="cart-img" src={img.prop(shop, shop.cart.id)} alt="カート" draggable={false} />
      <div className="cart-pile">
        {visible.map((it, i) => {
          const col = i % 6
          const row = Math.floor(i / 6)
          const dragging = drag?.payload.kind === 'cart-item' && drag.payload.id === it.uid
          return (
            <img key={it.uid} src={img.product(shop, it.product.id)} alt={it.product.name}
              className={`pile-item ${dragging ? 'ghosted' : ''}`} draggable={false}
              style={{
                left: `${6 + col * 14 + (row % 2) * 6}%`,
                bottom: `${row * 22}%`,
                zIndex: 10 + i,
                transform: `rotate(${((i * 37) % 30) - 15}deg)`,
              }}
              onPointerDown={draggableItems ? (e) => start(e, {
                kind: 'cart-item', id: it.uid, image: img.product(shop, it.product.id), data: it,
              }) : undefined}
            />
          )
        })}
      </div>
      {items.length > 0 && <div className="cart-count">{items.length}<small>こ</small></div>}
    </div>
  )
}
