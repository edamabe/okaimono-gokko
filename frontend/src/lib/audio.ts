// 音声エンジン: Gemini TTS で作った音声を Web Audio API で再生する。
// iPad Safari でも、最初のタップで unlock() すれば以降はジェスチャーなしで連続再生できる。

let ctx: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()
let current: AudioBufferSourceNode | null = null
let currentResolve: (() => void) | null = null
let muted = false

function getCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
  }
  return ctx
}

export function unlock() {
  const c = getCtx()
  if (c.state === 'suspended') void c.resume()
  // 無音を一瞬鳴らして iOS のオーディオをアンロック
  const src = c.createBufferSource()
  src.buffer = c.createBuffer(1, 1, 22050)
  src.connect(c.destination)
  src.start(0)
}

export function setMuted(m: boolean) {
  muted = m
  if (m) stopVoice()
}

export function load(url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((ab) => getCtx().decodeAudioData(ab))
      .catch((e) => {
        console.warn('[audio] load failed', url, e)
        buffers.delete(url)
        return null
      })
    buffers.set(url, p)
  }
  return p
}

export function preload(urls: string[]) {
  // 帯域を占有しないよう少しずつ読み込む
  let i = 0
  const next = () => {
    const batch = urls.slice(i, i + 6)
    i += 6
    if (batch.length) void Promise.all(batch.map(load)).then(next)
  }
  next()
}

export function stopVoice() {
  if (current) {
    try { current.stop() } catch { /* already stopped */ }
    current = null
  }
  currentResolve?.()
  currentResolve = null
}

export function isSpeaking() {
  return current !== null
}

/** 音声を再生（前の音声は止める）。再生終了で resolve。 */
export async function playVoice(url: string): Promise<void> {
  if (muted) return
  stopVoice()
  const token = {}
  lastToken = token
  const buf = await load(url)
  if (!buf || lastToken !== token || muted) return
  const c = getCtx()
  if (c.state === 'suspended') await c.resume()
  return new Promise<void>((resolve) => {
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(c.destination)
    src.onended = () => {
      if (current === src) { current = null; currentResolve = null }
      resolve()
    }
    current = src
    currentResolve = resolve
    src.start()
  })
}
let lastToken: object | null = null

/** 何も喋っていない時だけ再生 */
export function playVoiceIfIdle(url: string) {
  if (!current) void playVoice(url)
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ---------- 効果音（Web Audio 合成） ----------

type Sfx = 'pop' | 'scan' | 'chin' | 'pi' | 'piroron' | 'pickup' | 'whoosh' | 'fanfare'

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.25) {
  const c = getCtx()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(0.0001, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  osc.connect(g).connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.02)
  return osc
}

export function sfx(kind: Sfx) {
  if (muted) return
  const c = getCtx()
  if (c.state === 'suspended') void c.resume()
  switch (kind) {
    case 'pickup': {
      const o = tone(500, 0, 0.1, 'sine', 0.15)
      o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.1)
      break
    }
    case 'pop': {
      const o = tone(320, 0, 0.16, 'sine', 0.3)
      o.frequency.exponentialRampToValueAtTime(820, c.currentTime + 0.12)
      tone(1200, 0.08, 0.12, 'triangle', 0.12)
      break
    }
    case 'whoosh': {
      const o = tone(900, 0, 0.18, 'sine', 0.12)
      o.frequency.exponentialRampToValueAtTime(250, c.currentTime + 0.18)
      break
    }
    case 'scan': // バーコードの「ピッ」
    case 'pi':   // カードの「ピッ」
      tone(kind === 'scan' ? 2350 : 1900, 0, kind === 'scan' ? 0.12 : 0.22, 'square', 0.12)
      break
    case 'chin': { // レジの「チン！」（ベル）
      ;[2093, 2637, 4186].forEach((f, i) => tone(f, 0, 1.4 - i * 0.3, 'sine', 0.22 / (i + 1)))
      tone(3136, 0, 0.9, 'triangle', 0.06)
      break
    }
    case 'piroron': { // 電子決済の「ピロロン♪」
      ;[1318.5, 1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.09, 0.28, 'sine', 0.2))
      tone(3136, 0.38, 0.45, 'triangle', 0.12)
      break
    }
    case 'fanfare': {
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]
      const times = [0, 0.12, 0.24, 0.36, 0.56, 0.68]
      notes.forEach((f, i) => tone(f, times[i], i >= 4 ? 0.5 : 0.16, 'triangle', 0.18))
      break
    }
  }
}
