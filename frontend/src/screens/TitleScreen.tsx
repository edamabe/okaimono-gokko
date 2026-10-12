import { useState } from 'react'
import type { Shop } from '../types'
import { img, voiceUrl } from '../lib/assets'
import { playVoice, sfx, unlock, wait } from '../lib/audio'

interface Props {
  shop: Shop
  shops: Shop[]
  sound: boolean
  onSound: () => void
  onStart: () => void
}

export function TitleScreen({ shop, shops, sound, onSound, onStart }: Props) {
  const [starting, setStarting] = useState(false)

  const start = async () => {
    if (starting) return
    setStarting(true)
    unlock()
    sfx('fanfare')
    await wait(250)
    await Promise.race([playVoice(voiceUrl(shop, shop.title.voice.id)), wait(3500)])
    onStart()
  }

  return (
    <div className="title-screen" style={{ backgroundImage: `url(${img.title(shop)})` }}>
      <button className="round-btn sound-corner" onClick={onSound}>{sound ? '🔊' : '🔇'}</button>
      <div className="title-card">
        <h1 className="title-logo">🛒 おかいものごっこ</h1>
        <p className="title-sub">{shop.name}</p>
        <button className={`start-btn ${starting ? 'go' : ''}`} onClick={start}>
          {starting ? 'しゅっぱつ！' : 'はじめる！'}
        </button>
        {shops.length > 1 && (
          <div className="shop-select">
            {shops.map((s) => (
              <a key={s.id} href={`?shop=${s.id}`} className={s.id === shop.id ? 'on' : ''}>{s.name}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
