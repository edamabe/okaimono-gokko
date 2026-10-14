import type { CSSProperties, PointerEventHandler } from 'react'
import type { Product, Shop } from '../types'
import { img } from '../lib/assets'

/** 具材の数から、高さに収まるスタック幅（%）を決める */
export function stackWidth(n: number, heightRatio = 1): number {
  // 具材1枚あたり幅の約0.2倍＋パン上の厚み（目安）
  return Math.max(30, Math.min(96, (100 * heightRatio) / (0.2 * n + 0.25)))
}

/** 具材を下から積み重ねたハンバーガー */
export function BurgerStack({ shop, layers, width, onTapTop }: {
  shop: Shop
  layers: string[]
  width: number
  onTapTop?: () => void
}) {
  return (
    <div className="stack" style={{ width: `${width}%` }}>
      {layers.map((id, i) => {
        const top = i === layers.length - 1
        return (
          <img key={`${i}-${id}`} src={img.product(shop, id)} alt="" draggable={false}
            className={`layer layer-${id} ${top && onTapTop ? 'tappable' : ''}`}
            style={{ zIndex: i + 1 }}
            onClick={top ? onTapTop : undefined} />
        )
      })}
    </div>
  )
}

interface Props {
  shop: Shop
  product: Product
  className?: string
  style?: CSSProperties
  alt?: string
  onPointerDown?: PointerEventHandler
}

/** 商品の絵。自作ハンバーガー（layers あり）は具材を重ねて描く */
export function ItemImage({ shop, product, className = '', style, alt, onPointerDown }: Props) {
  if (product.layers?.length) {
    return (
      <div className={`${className} burger-mini`} style={style} onPointerDown={onPointerDown}
        role="img" aria-label={alt ?? product.name}>
        <BurgerStack shop={shop} layers={product.layers} width={stackWidth(product.layers.length)} />
      </div>
    )
  }
  return (
    <img src={img.product(shop, product.id)} alt={alt ?? product.name} className={className}
      style={style} draggable={false} onPointerDown={onPointerDown} />
  )
}
