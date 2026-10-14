import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import type { Screen } from '../App'
import type { CartItem, Payment, Shop } from '../types'
import { img, voiceUrl } from '../lib/assets'
import { playVoice, sfx, wait } from '../lib/audio'
import { useDrag, useDragHandlers } from '../lib/drag'

interface Props {
  shop: Shop
  cart: CartItem[]
  onRestart: () => void
  onClearCart: () => void
  onGo: (s: Screen) => void
}

type Phase = 'empty' | 'scan' | 'pay' | 'paying' | 'done'

const BELT_VISIBLE = 6

export function CheckoutScreen({ shop, cart, onRestart, onClearCart, onGo }: Props) {
  const co = shop.checkout
  const v = (id: string) => voiceUrl(shop, id)
  const { start, drag } = useDrag()

  const [phase, setPhase] = useState<Phase>(cart.length ? 'scan' : 'empty')
  const [belt, setBelt] = useState<CartItem[]>(() => [...cart])
  const [bag, setBag] = useState<CartItem[]>([])
  const [price, setPrice] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [flash, setFlash] = useState(0)
  const [paid, setPaid] = useState<Payment | null>(null)
  const [cashierTalking, setCashierTalking] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    void playVoice(v(cart.length ? co.voices.intro.id : co.voices.empty.id))
    return () => { alive.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTapCashier = () => {
    const talks = co.staff.talks
    if (!talks || talks.length === 0) return
    sfx('pop')
    const pick = talks[Math.floor(Math.random() * talks.length)]
    setCashierTalking(true)
    void playVoice(v(pick.id)).then(() => setCashierTalking(false))
  }

  const scan = async (item: CartItem) => {
    const p = co.prices[Math.floor(Math.random() * co.prices.length)]
    sfx('scan')
    setFlash((f) => f + 1)
    setPrice(p)
    setTotal((t) => t + p)
    const rest = belt.filter((b) => b.uid !== item.uid)
    setBelt(rest)
    setBag((b) => [...b, item])
    await wait(180)
    await playVoice(v(`price_${p}`))
    if (rest.length === 0 && alive.current) {
      await wait(300)
      await playVoice(v(co.voices.allScanned.id))
      if (!alive.current) return
      setPhase('pay')
      await playVoice(v(co.voices.askPayment.id))
    }
  }

  const pay = async (payment: Payment) => {
    setPhase('paying')
    setPaid(payment)
    sfx(payment.sfx)
    await wait(payment.sfx === 'chin' ? 1300 : 1000)
    await playVoice(v(co.voices.thanks.id))
    if (!alive.current) return
    setPhase('done')
    onClearCart()
    sfx('fanfare')
    const fire = (x: number) => confetti({ particleCount: 90, spread: 80, origin: { x, y: 0.6 }, scalar: 1.2 })
    fire(0.25); fire(0.75)
    setTimeout(() => fire(0.5), 400)
    await playVoice(v(co.voices.done.id))
  }

  useDragHandlers(
    (p) => {
      if (p.kind === 'belt-item') {
        sfx('pickup')
        void playVoice(v(`product_${(p.data as CartItem).product.id}`))
      } else if (p.kind === 'payment') {
        sfx('pickup')
        void playVoice(v(`pay_${p.id}`))
      }
    },
    (p, target) => {
      if (p.kind === 'belt-item' && target === 'scanner' && phase === 'scan') void scan(p.data as CartItem)
      else if (p.kind === 'payment' && target === 'register' && phase === 'pay') void pay(p.data as Payment)
    },
  )

  const overScanner = drag?.over === 'scanner' && drag.payload.kind === 'belt-item'
  const overRegister = drag?.over === 'register' && drag.payload.kind === 'payment'

  return (
    <main className="checkout" style={{ backgroundImage: `url(${img.bg(shop, co.background.id)})` }}>
      {/* レジ（ねこさん＋表示パネル）。お支払いのドロップ先 */}
      <section className="register-row">
        <button className="cashier-btn" onClick={handleTapCashier} type="button" aria-label={`${co.staff.name}とおはなし`}>
          <img className={`cashier ${cashierTalking ? 'talking' : ''}`} src={img.char(shop, co.staff.id)} alt={co.staff.name} draggable={false} />
        </button>
        <div className="lcd">
          <div className="lcd-price">{price !== null ? `${price}えん` : 'いらっしゃいませ'}</div>
          <div className="lcd-total">ごうけい {total.toLocaleString()}えん</div>
        </div>
        <div className={`register ${phase === 'pay' ? 'await' : ''} ${overRegister ? 'over' : ''}`} data-drop="register">
          <img src={img.prop(shop, 'register')} alt="レジ" draggable={false} />
          {paid && <img key={paid.id} className="paid-item" src={img.prop(shop, `pay_${paid.id}`)} alt="" />}
        </div>
      </section>

      {/* ベルトコンベア → バーコードリーダー → レジ袋 */}
      <section className="lane">
        <div className="belt">
          <div className={`belt-track ${phase === 'scan' ? 'moving' : ''}`} />
          <div className="belt-items">
            {belt.slice(0, BELT_VISIBLE).map((it, i) => {
              const dragging = drag?.payload.kind === 'belt-item' && drag.payload.id === it.uid
              return (
                <img key={it.uid} src={img.product(shop, it.product.id)} alt={it.product.name}
                  className={`belt-item ${dragging ? 'ghosted' : ''}`} draggable={false}
                  style={{ animationDelay: `${i * 120}ms` }}
                  onPointerDown={(e) => phase === 'scan' && start(e, {
                    kind: 'belt-item', id: it.uid, image: img.product(shop, it.product.id), data: it,
                  })} />
              )
            })}
            {belt.length > BELT_VISIBLE && <div className="belt-more">あと {belt.length - BELT_VISIBLE}こ</div>}
          </div>
        </div>
        <div className={`scanner ${overScanner ? 'over' : ''}`} data-drop="scanner">
          <img src={img.prop(shop, 'scanner')} alt="バーコードリーダー" draggable={false} />
          <div key={flash} className={`scan-beam ${flash ? 'fire' : ''}`} />
          {phase === 'scan' && <span className="hint">ここで ピッ！</span>}
        </div>
        <div className="bag">
          <div className="bag-items">
            {bag.slice(-8).map((it, i) => (
              <img key={it.uid} src={img.product(shop, it.product.id)} alt="" className="bag-item"
                style={{ left: `${8 + (i % 4) * 20}%`, bottom: `${30 + Math.floor(i / 4) * 16}%`, transform: `rotate(${((i * 53) % 40) - 20}deg)` }} />
            ))}
          </div>
          <img className="bag-img" src={img.prop(shop, 'bag')} alt="レジぶくろ" draggable={false} />
          {bag.length > 0 && <div className="cart-count">{bag.length}<small>こ</small></div>}
        </div>
      </section>

      {phase === 'empty' && (
        <div className="overlay soft">
          <div className="panel">
            <img className="panel-char" src={img.char(shop, shop.shopper.id)} alt="" />
            <p>カートが からっぽだよ</p>
            <button className="big-btn" onClick={() => onGo({ type: 'corner', index: 0 })}>おかいものに いく！</button>
          </div>
        </div>
      )}

      {(phase === 'pay' || phase === 'paying') && (
        <div className="pay-tray">
          <p className="pay-q">おしはらいは なんに しますか？ <small>レジに もっていってね</small></p>
          <div className="pay-options">
            {co.payments.map((pm) => (
              <button key={pm.id} className={`pay-option ${paid?.id === pm.id ? 'used' : ''}`}
                disabled={phase !== 'pay'}
                onPointerDown={(e) => phase === 'pay' && start(e, { kind: 'payment', id: pm.id, image: img.prop(shop, `pay_${pm.id}`), data: pm })}>
                <img src={img.prop(shop, `pay_${pm.id}`)} alt={pm.name} draggable={false} />
                <span>{pm.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="overlay">
          <div className="panel done">
            <div className="done-chars">
              <img src={img.char(shop, shop.shopper.id)} alt="" />
              <img src={img.prop(shop, 'bag')} alt="" className="done-bag" />
              <img src={img.char(shop, co.staff.id)} alt="" />
            </div>
            <h2>おかいもの できたね！</h2>
            <p>{bag.length}こ かったよ ・ ごうけい {total.toLocaleString()}えん</p>
            <button className="big-btn" onClick={onRestart}>もういちど あそぶ！</button>
          </div>
        </div>
      )}
    </main>
  )
}
