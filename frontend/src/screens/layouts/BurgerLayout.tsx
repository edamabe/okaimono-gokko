import { useEffect, useRef, useState } from 'react'
import type { LayoutProps } from '../CornerScreen'
import type { Product } from '../../types'
import { img, voiceUrl } from '../../lib/assets'
import { playVoice, sfx, wait } from '../../lib/audio'
import { useDrag } from '../../lib/drag'
import { BurgerStack, stackWidth } from '../../components/ItemImage'

const MAX_LAYERS = 12

/** 具材の数で値段が決まる（checkout.prices に含まれる 50円刻み） */
function burgerPrice(n: number) {
  return Math.min(800, 150 + 50 * n)
}

/** ハンバーガーづくり: 具材をおさらへドラッグして好きな順に重ねる */
export function BurgerLayout({ shop, corner, onAdd, handlers }: LayoutProps) {
  const { start, drag } = useDrag()
  const [layers, setLayers] = useState<string[]>([])
  const [finishing, setFinishing] = useState(false)
  const layersRef = useRef(layers)
  layersRef.current = layers
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  // おさらエリアの縦横比（具材が増えたら縮めて収める）
  const plateRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(1)
  useEffect(() => {
    const el = plateRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setRatio(e.contentRect.height / Math.max(1, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const result = corner.results?.[0]
  const v = (id?: string) => id && voiceUrl(shop, id)

  handlers.current = {
    start: (p) => {
      if (p.kind !== 'ingredient') return false
      sfx('pickup')
      void playVoice(voiceUrl(shop, `product_${p.id}`))
      return true
    },
    drop: (p, target) => {
      if (p.kind !== 'ingredient') return false
      if (target !== 'plate' || finishing) return true
      if (layersRef.current.length >= MAX_LAYERS) {
        sfx('whoosh')
        const full = v(corner.voices?.full?.id)
        if (full) void playVoice(full)
        return true
      }
      setLayers((l) => [...l, p.id])
      sfx('pop')
      return true
    },
  }

  const removeTop = () => {
    if (finishing) return
    sfx('whoosh')
    setLayers((l) => l.slice(0, -1))
  }

  const finish = async () => {
    if (!layers.length || finishing || !result) return
    setFinishing(true)
    sfx('fanfare')
    const done = v(corner.voices?.done?.id)
    await Promise.all([done ? playVoice(done) : Promise.resolve(), wait(1100)])
    if (!alive.current) return
    const burger: Product = { ...result, layers: [...layers], price: burgerPrice(layers.length) }
    onAdd(burger)
    setLayers([])
    setFinishing(false)
  }

  const over = drag?.over === 'plate' && drag.payload.kind === 'ingredient'
  // パンの厚みぶん少し余裕を見て幅を決める
  const width = stackWidth(Math.max(layers.length, 3), ratio * 0.92)

  return (
    <div className="burger-station">
      <div className="bins">
        {corner.products.map((p) => (
          <button key={p.id} className={`bin ${drag?.payload.id === p.id ? 'lifted' : ''}`}
            onPointerDown={(e) => !finishing && start(e, { kind: 'ingredient', id: p.id, image: img.product(shop, p.id), data: p })}>
            <span className="bin-img"><img src={img.product(shop, p.id)} alt={p.name} draggable={false} /></span>
            <span className="product-name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="build">
        <div ref={plateRef} className={`plate-zone ${over ? 'over' : ''} ${finishing ? 'finishing' : ''}`} data-drop="plate">
          {layers.length === 0 && <div className="plate-hint">ここに のせてね！<small>したのパン から はじめよう</small></div>}
          <div className="plate" />
          <BurgerStack shop={shop} layers={layers} width={width} onTapTop={removeTop} />
          {finishing && <div className="sparkles" aria-hidden="true">✨🍔✨</div>}
        </div>
        <div className="build-btns">
          <button className="sub-btn" disabled={!layers.length || finishing}
            onClick={() => { sfx('whoosh'); setLayers([]) }}>🔄 やりなおし</button>
          <button className="go-btn" disabled={!layers.length || finishing} onClick={() => void finish()}>
            ✨ できあがり！
          </button>
        </div>
      </div>
    </div>
  )
}
