// 店舗定義（src/data/shops/*.json）の型。新しいお店はこの形の JSON を追加するだけで遊べる。

export interface Voice { id: string; text: string }
export interface ImageSpec { id: string; prompt: string; aspect?: string }

export interface Product {
  id: string
  name: string
  /** 読み上げ用（name と異なる読みが必要な場合） */
  reading?: string
  prompt: string
  /** 固定価格（checkout.prices に含まれる値。未指定ならランダム） */
  price?: number
  /** ドリンクの液体の色など */
  color?: string
  /** 自作ハンバーガーの具材（下から順の商品ID）。指定時は具材を重ねて描画する */
  layers?: string[]
}

export interface Character {
  id: string
  name: string
  prompt: string
  talks?: Voice[]
}

/**
 * コーナーの見た目と遊び方。
 * - shelf:  陳列棚から商品をカートへ
 * - burger: 具材をおさらに重ねてハンバーガーを作る
 * - fryer:  フライヤーで揚げてからトレーへ
 * - drink:  ドリンクサーバーでカップに注ぐ
 */
export type CornerLayout = 'shelf' | 'burger' | 'fryer' | 'drink'

export interface Corner {
  id: string
  name: string
  emoji: string
  color: string
  layout?: CornerLayout
  /** 吹き出しのヒント（未指定なら「すきなものを カートに いれてね！」） */
  hint?: string
  background: ImageSpec
  staff: Character
  voice: Voice
  /** レイアウト固有の音声（done / full / ready など） */
  voices?: Record<string, Voice>
  products: Product[]
  /** 売り場には並ばない完成品（ハンバーガー・ミックスジュース等） */
  results?: Product[]
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
  /** 「カート」「トレー」など */
  cartName?: string
  theme: { primary: string; accent: string; bg: string }
  title: { image: ImageSpec; voice: Voice }
  shopper: Character
  cart: ImageSpec & { variant?: 'cart' | 'tray' }
  corners: Corner[]
  checkout: Checkout
  reactions?: Voice[]
}

export interface CartItem { uid: string; product: Product }
