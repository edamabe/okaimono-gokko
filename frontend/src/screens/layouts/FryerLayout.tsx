import { useEffect, useRef, useState } from 'react'
import type { LayoutProps } from '../CornerScreen'
import type { Product } from '../../types'
import { img, voiceUrl } from '../../lib/assets'
import { playVoice, playVoiceIfIdle, sfx, startLoop } from '../../lib/audio'
import { useDrag } from '../../lib/drag'

const FRY_MS = 3500
const MAX_FRYING = 3
const MAX_READY = 6

interface Item { uid: string; product: Product }
let seq = 0

/** フライヤー: メニューをフライヤーへ → ジュワー → あがったらトレーへ */
export function FryerLayout({ shop, corner, onAdd, handlers }: LayoutProps) {
  const { start, drag } = useDrag()
  const [frying, setFrying] = useState<Item[]>([])
  const [ready, setReady] = useState<Item[]>([])
  const fryingRef = useRef(frying)
  fryingRef.current = frying
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  // 揚げている間は「ジュワー」
  const isFrying = frying.length > 0
  useEffect(() => {
    if (!isFrying) return
    const stop = startLoop('sizzle')
    return stop
  }, [isFrying])

  const v = (id?: string) => id && voiceUrl(shop, id)

  const putIn = (product: Product) => {
    if (fryingRef.current.length >= MAX_FRYING) {
      sfx('whoosh')
      const full = v(corner.voices?.full?.id)
      if (full) void playVoice(full)
      return
    }
    const item = { uid: `f${++seq}`, product }
    setFrying((f) => [...f, item])
    sfx('pop')
    const t = window.setTimeout(() => {
      setFrying((f) => f.filter((x) => x.uid !== item.uid))
      setReady((r) => [...r, item].slice(-MAX_READY))
      sfx('ding')
      const rv = v(corner.voices?.ready?.id)
      if (rv) setTimeout(() => playVoiceIfIdle(rv), 350)
    }, FRY_MS)
    timers.current.push(t)
  }

  handlers.current = {
    start: (p) => {
      if (p.kind !== 'menu-item' && p.kind !== 'fried') return false
      sfx('pickup')
      void playVoice(voiceUrl(shop, `product_${(p.data as Product).id}`))
      return true
    },
    drop: (p, target) => {
      if (p.kind === 'menu-item') {
        if (target === 'fryer') putIn(p.data as Product)
        return true
      }
      if (p.kind === 'fried') {
        if (target === 'cart') {
          setReady((r) => r.filter((x) => x.uid !== p.id))
          onAdd((p.data as Product))
        }
        return true
      }
      return false
    },
  }

  const overFryer = drag?.over === 'fryer' && drag.payload.kind === 'menu-item'

  return (
    <div className="fryer-station">
      <div className="menu-grid">
        {corner.products.map((p) => (
          <button key={p.id} className="menu-item"
            onPointerDown={(e) => start(e, { kind: 'menu-item', id: p.id, image: img.product(shop, p.id), data: p })}>
            <img className="raw" src={img.product(shop, p.id)} alt={p.name} draggable={false} />
            <span className="product-name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="fryer-side">
        <div className={`fryer ${overFryer ? 'over' : ''} ${isFrying ? 'on' : ''}`} data-drop="fryer">
          <div className="fryer-oil">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="bubble-dot" style={{ left: `${6 + i * 9.3}%`, animationDelay: `${(i * 0.37) % 1.4}s` }} />
            ))}
            <div className="fry-slots">
              {frying.map((it) => (
                <div key={it.uid} className="fry-item">
                  <img src={img.product(shop, it.product.id)} alt={it.product.name} draggable={false}
                    style={{ animationDuration: `${FRY_MS}ms` }} />
                  <div className="fry-timer"><i style={{ animationDuration: `${FRY_MS}ms` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="fryer-body">
            {frying.length === 0 && <span className="fryer-label">ここに いれてね！</span>}
            {frying.length > 0 && <span className="fryer-label sizzle">ジュワー！</span>}
          </div>
        </div>

        <div className="ready-tray">
          <span className="ready-label">あがったよ</span>
          <div className="ready-items">
            {ready.map((it) => (
              <img key={it.uid} src={img.product(shop, it.product.id)} alt={it.product.name} draggable={false}
                className={`ready-item ${drag?.payload.id === it.uid ? 'ghosted' : ''}`}
                onPointerDown={(e) => start(e, { kind: 'fried', id: it.uid, image: img.product(shop, it.product.id), data: it.product })} />
            ))}
            {ready.length === 0 && <span className="ready-empty">まだ ないよ</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
