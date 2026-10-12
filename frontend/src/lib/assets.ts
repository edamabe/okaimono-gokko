import type { Shop } from '../types'

/** アセットパス規約（tools/generate_*.py と一致させること） */
export const img = {
  title: (s: Shop) => `/images/${s.id}/${s.title.image.id}.webp`,
  bg: (s: Shop, id: string) => `/images/${s.id}/bg/${id}.webp`,
  char: (s: Shop, id: string) => `/images/${s.id}/chars/${id}.webp`,
  prop: (s: Shop, id: string) => `/images/${s.id}/props/${id}.webp`,
  product: (s: Shop, id: string) => `/images/${s.id}/products/${id}.webp`,
}

export const voiceUrl = (s: Shop, id: string) => `/audio/${s.id}/${id}.wav`

/** 店舗で使う全音声ID（プリロード用） */
export function allVoiceIds(s: Shop): string[] {
  const ids = [s.title.voice.id]
  for (const c of s.corners) {
    ids.push(c.voice.id, ...c.products.map((p) => `product_${p.id}`))
  }
  ids.push(...Object.values(s.checkout.voices).map((v) => v.id))
  ids.push(...s.checkout.payments.map((p) => `pay_${p.id}`))
  ids.push(...s.checkout.prices.map((p) => `price_${p}`))
  ids.push(...(s.reactions ?? []).map((r) => r.id))
  return ids
}
