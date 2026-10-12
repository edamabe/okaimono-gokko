import type { Shop } from '../../types'

// shops/ に JSON を置くだけで自動登録される
const modules = import.meta.glob<{ default: Shop }>('./*.json', { eager: true })

export const shops: Shop[] = Object.values(modules).map((m) => m.default)

export function findShop(id: string | null): Shop {
  return shops.find((s) => s.id === id) ?? shops.find((s) => s.id === 'supermarket') ?? shops[0]
}
