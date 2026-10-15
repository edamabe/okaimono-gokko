import { useEffect, useRef, useState } from 'react'
import type { LayoutProps } from '../CornerScreen'
import type { Product } from '../../types'
import { img, voiceUrl } from '../../lib/assets'
import { playVoice, sfx, startLoop, wait } from '../../lib/audio'

const TICK_MS = 50
const PER_TICK = 1.6 // 約3秒でいっぱい
const MIN_TO_SERVE = 25

interface Seg { id: string; color: string; amount: number }

/** ドリンクサーバー: ボタンを押している間ジュースが注がれる。まぜるとミックスジュース */
export function DrinkLayout({ shop, corner, onAdd }: LayoutProps) {
  const [segs, setSegs] = useState<Seg[]>([])
  const [pouring, setPouring] = useState<Product | null>(null)
  const [lid, setLid] = useState(false)
  const [serving, setServing] = useState(false)
  const servingRef = useRef(false)
  const totalRef = useRef(0)
  const segsRef = useRef<Seg[]>([])
  const stopRef = useRef<(() => void) | null>(null)
  const alive = useRef(true)

  const total = Math.min(100, Math.round(segs.reduce((s, x) => s + x.amount, 0)))

  const v = (id?: string) => id && voiceUrl(shop, id)

  const stopPour = () => {
    stopRef.current?.()
    stopRef.current = null
    setPouring(null)
  }

  const resetCup = () => {
    totalRef.current = 0
    segsRef.current = []
    setSegs([])
    setLid(false)
    setServing(false)
    servingRef.current = false
  }

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      stopRef.current?.()
    }
  }, [])

  const serve = async (targetSegs?: Seg[]) => {
    if (servingRef.current || lid) return
    const curSegs = targetSegs ?? segsRef.current
    const curTotal = curSegs.reduce((s, x) => s + x.amount, 0)
    if (!curSegs.length || curTotal < MIN_TO_SERVE) return

    servingRef.current = true
    setServing(true)
    stopPour()
    setLid(true)
    sfx('pop')

    try {
      // いちばん多い味が7割以上ならその味、そうでなければミックスジュース
      const byId = new Map<string, number>()
      curSegs.forEach((s) => byId.set(s.id, (byId.get(s.id) ?? 0) + s.amount))
      const entries = [...byId.entries()].sort((a, b) => b[1] - a[1])
      if (entries.length === 0) {
        resetCup()
        return
      }
      const [topId, topAmt] = entries[0]
      const mix = corner.results?.[0]
      const foundProduct = corner.products.find((p) => p.id === topId)
      const isMixed = topAmt / curTotal < 0.7 && !!mix
      const product = isMixed ? mix! : (foundProduct ?? corner.products[0])

      if (!product) {
        resetCup()
        return
      }

      const done = v(corner.voices?.done?.id)
      await wait(500)
      if (!alive.current) return
      if (done) await playVoice(done)
      if (!alive.current) return
      await playVoice(voiceUrl(shop, `product_${product.id}`))
      if (!alive.current) return
      onAdd(product)
      await wait(300)
    } catch (err) {
      console.error('Error serving drink:', err)
    } finally {
      if (alive.current) {
        resetCup()
      }
    }
  }

  // 注いでいる間、少しずつ増やす
  useEffect(() => {
    if (!pouring) return
    const color = pouring.color ?? '#fb923c'
    let timerId: number | null = null

    timerId = window.setInterval(() => {
      if (servingRef.current) {
        if (timerId) window.clearInterval(timerId)
        return
      }

      if (totalRef.current >= 100) {
        if (timerId) window.clearInterval(timerId)
        stopPour()
        sfx('ding')
        void serve()
        return
      }

      const add = Math.min(PER_TICK, Math.max(0, 100 - totalRef.current))
      const nextTotal = Math.min(100, totalRef.current + add)
      totalRef.current = nextTotal

      const prev = segsRef.current
      const last = prev[prev.length - 1]
      let nextSegs: Seg[]
      if (last && last.id === pouring.id) {
        nextSegs = [...prev.slice(0, -1), { ...last, amount: last.amount + add }]
      } else {
        nextSegs = [...prev, { id: pouring.id, color, amount: add }]
      }
      segsRef.current = nextSegs
      setSegs(nextSegs)

      // いっぱいまで注いだら自動的に出来上がり判定へ
      if (nextTotal >= 100) {
        if (timerId) window.clearInterval(timerId)
        stopPour()
        sfx('ding')
        void serve(nextSegs)
      }
    }, TICK_MS)

    // 指を離したらとめる（タッチはボタン外でも pointerup がここに届く）
    const up = () => stopPour()
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      if (timerId) window.clearInterval(timerId)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pouring])

  const startPour = (e: React.PointerEvent, p: Product) => {
    e.preventDefault()
    if (lid || serving || servingRef.current || pouring || totalRef.current >= 100) return
    void playVoice(voiceUrl(shop, `product_${p.id}`))
    stopRef.current = startLoop('pour')
    setPouring(p)
  }

  const discard = () => {
    if (lid || serving || servingRef.current || !segs.length) return
    stopPour()
    sfx('whoosh')
    resetCup()
  }

  return (
    <div className="drink-station">
      <div className="flavor-panel">
        {corner.products.map((p) => (
          <button key={p.id} type="button"
            className={`flavor ${pouring?.id === p.id ? 'pressing' : ''}`}
            disabled={lid || serving || total >= 100}
            style={{ '--flavor': p.color ?? '#fb923c' } as React.CSSProperties}
            onPointerDown={(e) => startPour(e, p)}
            onPointerUp={stopPour}
            onPointerCancel={stopPour}
            onContextMenu={(e) => e.preventDefault()}>
            <img src={img.product(shop, p.id)} alt={p.name} draggable={false} />
            <span className="flavor-name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="pour-side">
        <div className="dispenser">
          <div className="nozzle" />
          {pouring && <div className="stream" style={{ '--flavor': pouring.color ?? '#fb923c' } as React.CSSProperties} />}
          <div className={`cup-wrap ${lid ? 'served' : ''}`}>
            {lid && <><div className="straw" /><div className="lid" /></>}
            <div className="cup">
              <div className="cup-inner">
                <div className="liquid" style={{ height: `${total}%` }}>
                  {segs.map((s, i) => (
                    <div key={i} className="seg" style={{ flexGrow: s.amount, background: s.color }} />
                  ))}
                </div>
                <div className="cup-shine" />
                <div className="cup-line" />
              </div>
            </div>
          </div>
          <div className="drip-tray" />
        </div>
        <div className="build-btns">
          <button type="button" className="sub-btn" disabled={lid || serving || !segs.length} onClick={discard}>🫗 すてる</button>
          <button type="button" className="go-btn" disabled={lid || serving || total < MIN_TO_SERVE} onClick={() => void serve()}>
            ✨ できあがり！
          </button>
        </div>
      </div>
    </div>
  )
}
