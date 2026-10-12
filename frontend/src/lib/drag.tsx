// タッチ／マウス共通のドラッグ＆ドロップ（HTML5 DnD は iPad で動かないため Pointer Events で自作）
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface DragPayload {
  kind: string            // 'product' | 'cart-item' | 'belt-item' | 'payment' など
  id: string
  image: string
  data?: unknown
}

interface DragState { payload: DragPayload; x: number; y: number; over: string | null }

type DropHandler = (payload: DragPayload, target: string | null) => void
type StartHandler = (payload: DragPayload) => void

interface Ctx {
  start: (e: React.PointerEvent, payload: DragPayload) => void
  drag: DragState | null
  setOnDrop: (fn: DropHandler | null) => void
  setOnStart: (fn: StartHandler | null) => void
}

const DragCtx = createContext<Ctx | null>(null)

function targetAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)
  return (el?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop ?? null
}

export function DragProvider({ children }: { children: ReactNode }) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const onDrop = useRef<DropHandler | null>(null)
  const onStart = useRef<StartHandler | null>(null)

  const start = useCallback((e: React.PointerEvent, payload: DragPayload) => {
    if (dragRef.current) return
    e.preventDefault()
    const s = { payload, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) }
    dragRef.current = s
    setDrag(s)
    onStart.current?.(payload)
  }, [])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      e.preventDefault()
      const s = { ...d, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) }
      dragRef.current = s
      setDrag(s)
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      setDrag(null)
      onDrop.current?.(d.payload, targetAt(e.clientX, e.clientY))
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const value: Ctx = {
    start,
    drag,
    setOnDrop: (fn) => { onDrop.current = fn },
    setOnStart: (fn) => { onStart.current = fn },
  }

  return (
    <DragCtx.Provider value={value}>
      {children}
      {drag && (
        <img
          className="drag-ghost"
          src={drag.payload.image}
          alt=""
          style={{ left: drag.x, top: drag.y }}
          draggable={false}
        />
      )}
    </DragCtx.Provider>
  )
}

export function useDrag() {
  const c = useContext(DragCtx)
  if (!c) throw new Error('DragProvider missing')
  return c
}

/** 画面ごとにドロップ／ドラッグ開始のハンドラを登録する */
export function useDragHandlers(onStart: StartHandler, onDrop: DropHandler) {
  const { setOnDrop, setOnStart } = useDrag()
  const startRef = useRef(onStart)
  const dropRef = useRef(onDrop)
  startRef.current = onStart
  dropRef.current = onDrop
  useEffect(() => {
    setOnStart((p) => startRef.current(p))
    setOnDrop((p, t) => dropRef.current(p, t))
    return () => { setOnStart(null); setOnDrop(null) }
  }, [setOnDrop, setOnStart])
}
