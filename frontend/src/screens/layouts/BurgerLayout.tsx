import { useEffect, useRef, useState } from 'react'
import type { LayoutProps } from '../CornerScreen'
import type { Product } from '../../types'
import { img, voiceUrl } from '../../lib/assets'
import { playVoice, sfx, wait } from '../../lib/audio'
import { useDrag } from '../../lib/drag'
import { BurgerStack, stackWidth } from '../../components/ItemImage'

const DEFAULT_LAYERS = ['bun_bottom']
const MAX_LAYERS = 10

/** 具材の数で値段が決まる（checkout.prices に含まれる 50円刻み） */
function burgerPrice(n: number) {
  return Math.min(800, 150 + 50 * n)
}

/** ハンバーガーづくり: 具材をおさらへドラッグして好きな順に重ねる */
export function BurgerLayout({ shop, corner, onAdd, handlers }: LayoutProps) {
  const { start, drag } = useDrag()
  const [layers, setLayers] = useState<string[]>(DEFAULT_LAYERS)
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

  const finish = async (targetLayers?: string[]) => {
    const cur = targetLayers ?? layersRef.current
    if (cur.length <= 1 || finishing || !result) return
    setFinishing(true)
    sfx('fanfare')
    const done = v(corner.voices?.done?.id)
    await Promise.all([done ? playVoice(done) : Promise.resolve(), wait(1100)])
    if (!alive.current) return
    const burger: Product = { ...result, layers: [...cur], price: burgerPrice(cur.length) }
    onAdd(burger)
    setLayers(DEFAULT_LAYERS)
    setFinishing(false)
  }

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
      const nextLayers = [...layersRef.current, p.id]
      setLayers(nextLayers)
      sfx('pop')
      // 上のパンで挟んだら自動で出来上がり判定、または全10段に達したら自動で出来上がり判定
      if (p.id === 'bun_top' || nextLayers.length >= MAX_LAYERS) {
        void finish(nextLayers)
      }
      return true
    },
  }

  const removeTop = () => {
    if (finishing || layers.length <= 1) return
    sfx('whoosh')
    setLayers((l) => (l.length > 1 ? l.slice(0, -1) : l))
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
          {layers.length <= 1 && <div className="plate-hint">すきな ぐざいを のせてね！<small>うえのパンで はさんだら できあがり！</small></div>}
          <div className="plate" />
          <BurgerStack shop={shop} layers={layers} width={width} onTapTop={removeTop} />
          {finishing && <div className="sparkles" aria-hidden="true">✨🍔✨</div>}
        </div>
        <div className="build-btns">
          <button className="sub-btn" disabled={layers.length <= 1 || finishing}
            onClick={() => { sfx('whoosh'); setLayers(DEFAULT_LAYERS) }}>🔄 やりなおし</button>
          <button className="go-btn" disabled={layers.length <= 1 || finishing} onClick={() => void finish()}>
            ✨ できあがり！
          </button>
        </div>
      </div>
    </div>
  )
}
