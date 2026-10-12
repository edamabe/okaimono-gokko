// 店舗定義（src/data/shops/*.json）の型。新しいお店はこの形の JSON を追加するだけで遊べる。

export interface Voice { id: string; text: string }
export interface ImageSpec { id: string; prompt: string; aspect?: string }

export interface Product {
  id: string
  name: string
  /** 読み上げ用（name と異なる読みが必要な場合） */
  reading?: string
  prompt: string
}

export interface Character { id: string; name: string; prompt: string }

/** コーナーの見た目。将来 'freezer'（冷凍ケース）や 'counter'（アイス屋の注文台）などを追加できる */
export type CornerLayout = 'shelf'

export interface Corner {
  id: string
  name: string
  emoji: string
  color: string
  layout?: CornerLayout
  background: ImageSpec
  staff: Character
  voice: Voice
  products: Product[]
}

export type PaymentSfx = 'chin' | 'pi' | 'piroron'

export interface Payment { id: string; name: string; sfx: PaymentSfx; prompt: string }

export interface Checkout {
  background: ImageSpec
  staff: Character
  voices: {
    intro: Voice
    empty: Voice
    allScanned: Voice
    askPayment: Voice
    thanks: Voice
    done: Voice
  }
  props: ImageSpec[]
  payments: Payment[]
  prices: number[]
}

export interface Shop {
  id: string
  name: string
  theme: { primary: string; accent: string; bg: string }
  title: { image: ImageSpec; voice: Voice }
  shopper: Character
  cart: ImageSpec
  corners: Corner[]
  checkout: Checkout
  reactions?: Voice[]
}

export interface CartItem { uid: string; product: Product }
