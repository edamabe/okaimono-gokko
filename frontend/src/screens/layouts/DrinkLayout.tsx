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
  const totalRef = useRef(0)
  const total = segs.reduce((s, x) => s + x.amount, 0)
  const segsRef = useRef(segs)
  segsRef.current = segs
  const stopRef = useRef<(() => void) | null>(null)
  const alive = useRef(true)

  const v = (id?: string) => id && voiceUrl(shop, id)

  const stopPour = () => {
    stopRef.current?.()
    stopRef.current = null
    setPouring(null)
  }

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; stopRef.current?.() }
  }, [])

  const serve = async (targetSegs?: Seg[]) => {
    const curSegs = targetSegs ?? segsRef.current
    const curTotal = curSegs.reduce((s, x) => s + x.amount, 0)
    if (lid || curTotal < MIN_TO_SERVE) return
    stopPour()
    setLid(true)
    sfx('pop')
    // いちばん多い味が7割以上ならその味、そうでなければミックスジュース
    const byId = new Map<string, number>()
    curSegs.forEach((s) => byId.set(s.id, (byId.get(s.id) ?? 0) + s.amount))
    const [topId, topAmt] = [...byId.entries()].sort((a, b) => b[1] - a[1])[0]
    const mix = corner.results?.[0]
    const product = (topAmt / curTotal < 0.7 && mix) ? mix : corner.products.find((p) => p.id === topId)!
    const done = v(corner.voices?.done?.id)
    await wait(500)
    if (done) await playVoice(done)
    if (!alive.current) return
    await playVoice(voiceUrl(shop, `product_${product.id}`))
    if (!alive.current) return
    onAdd(product)
    setSegs([])
    setLid(false)
  }

  // 注いでいる間、少しずつ増やす
  useEffect(() => {
    if (!pouring) return
    const color = pouring.color ?? '#fb923c'
    const t = window.setInterval(() => {
      if (totalRef.current >= 100) {
        stopPour()
        sfx('ding')
        void serve()
        return
      }
      const add = Math.min(PER_TICK, 100 - totalRef.current)
      const nextTotal = totalRef.current + add
      totalRef.current = nextTotal
      let nextSegs: Seg[] = []
      setSegs((s) => {
        const last = s[s.length - 1]
        if (last && last.id === pouring.id) {
          nextSegs = [...s.slice(0, -1), { ...last, amount: last.amount + add }]
        } else {
          nextSegs = [...s, { id: pouring.id, color, amount: add }]
        }
        return nextSegs
      })
      // いっぱいまで注いだら自動的に出来上がり判定へ
      if (nextTotal >= 100) {
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
      window.clearInterval(t)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pouring])

  const startPour = (e: React.PointerEvent, p: Product) => {
    e.preventDefault()
    if (lid || pouring || totalRef.current >= 100) return
    void playVoice(voiceUrl(shop, `product_${p.id}`))
    stopRef.current = startLoop('pour')
    setPouring(p)
  }

  const discard = () => {
    if (lid || !segs.length) return
    stopPour()
    sfx('whoosh')
    setSegs([])
  }

  return (
    <div className="drink-station">
      <div className="flavor-panel">
        {corner.products.map((p) => (
          <button key={p.id} type="button"
            className={`flavor ${pouring?.id === p.id ? 'pressing' : ''}`}
            style={{ '--flavor': p.color ?? '#fb923c' } as React.CSSProperties}
            onPointerDown={(e) => startPour(e, p)}
            onPointerUp={stopPour}
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
          <button className="sub-btn" disabled={lid || !segs.length} onClick={discard}>🫗 すてる</button>
          <button className="go-btn" disabled={lid || total < MIN_TO_SERVE} onClick={() => void serve()}>
            ✨ できあがり！
          </button>
        </div>
      </div>
    </div>
  )
}
