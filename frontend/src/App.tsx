import { useCallback, useEffect, useMemo, useState } from 'react'
import { findShop, shops } from './data/shops'
import type { CartItem, Product } from './types'
import { DragProvider } from './lib/drag'
import { allVoiceIds, img, voiceUrl } from './lib/assets'
import { preload, setMuted, stopVoice } from './lib/audio'
import { TitleScreen } from './screens/TitleScreen'
import { CornerScreen } from './screens/CornerScreen'
import { CheckoutScreen } from './screens/CheckoutScreen'
import { TopBar } from './components/TopBar'

export type Screen = { type: 'title' } | { type: 'corner'; index: number } | { type: 'checkout' }

let uidSeq = 0

export default function App() {
  const shop = useMemo(() => findShop(new URLSearchParams(location.search).get('shop')), [])
  const [screen, setScreen] = useState<Screen>({ type: 'title' })
  const [cart, setCart] = useState<CartItem[]>([])
  const [sound, setSound] = useState(true)

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', shop.theme.primary)
    document.documentElement.style.setProperty('--accent', shop.theme.accent)
    document.documentElement.style.setProperty('--bg', shop.theme.bg)
    // 画像の先読み
    const urls = [img.title(shop), img.char(shop, shop.shopper.id), img.prop(shop, shop.cart.id)]
    shop.corners.forEach((c) => {
      urls.push(img.bg(shop, c.background.id), img.char(shop, c.staff.id))
      c.products.forEach((p) => urls.push(img.product(shop, p.id)))
    })
    urls.forEach((u) => { const i = new Image(); i.src = u })
  }, [shop])

  useEffect(() => setMuted(!sound), [sound])

  const startShopping = useCallback(() => {
    preload(allVoiceIds(shop).map((id) => voiceUrl(shop, id)))
    setScreen({ type: 'corner', index: 0 })
  }, [shop])

  const addToCart = useCallback((product: Product) => {
    setCart((c) => [...c, { uid: `i${++uidSeq}`, product }])
  }, [])
  const removeFromCart = useCallback((uid: string) => {
    setCart((c) => c.filter((i) => i.uid !== uid))
  }, [])

  const go = useCallback((s: Screen) => { stopVoice(); setScreen(s) }, [])

  const restart = useCallback(() => {
    setCart([])
    go({ type: 'title' })
  }, [go])

  return (
    <DragProvider>
      <div className="app">
        {screen.type !== 'title' && (
          <TopBar shop={shop} screen={screen} cartCount={cart.length} sound={sound}
            onSound={() => setSound((s) => !s)} onGo={go} />
        )}
        {screen.type === 'title' && (
          <TitleScreen shop={shop} shops={shops} onStart={startShopping} sound={sound}
            onSound={() => setSound((s) => !s)} />
        )}
        {screen.type === 'corner' && (
          <CornerScreen key={screen.index} shop={shop} index={screen.index} cart={cart}
            onAdd={addToCart} onRemove={removeFromCart} onGo={go} />
        )}
        {screen.type === 'checkout' && (
          <CheckoutScreen shop={shop} cart={cart} onRestart={restart} onGo={go}
            onClearCart={() => setCart([])} />
        )}
      </div>
    </DragProvider>
  )
}
