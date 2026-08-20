import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

function loadNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  } catch {
    return fallback
  }
}

function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(Math.round(value * 10) / 10))
  } catch {
    /* ignore */
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

type SplitHandlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  endDrag: (e: ReactPointerEvent<HTMLDivElement>) => void
  nudge: (delta: number) => void
  min: number
  max: number
}

function useDragSplit(opts: {
  storageKey: string
  defaultValue: number
  min: number
  max: number
  /** Map pointer X to next value using the measured container rect. */
  compute: (clientX: number, rect: DOMRect) => number
  cssVar?: string
}): SplitHandlers & { value: number; containerRef: RefObject<HTMLDivElement | null> } {
  const { storageKey, defaultValue, min, max, compute, cssVar } = opts
  const [value, setValue] = useState(() => loadNumber(storageKey, defaultValue, min, max))
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const live = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    live.current = value
  }, [value])

  const applyLive = useCallback(
    (next: number) => {
      live.current = next
      if (cssVar && containerRef.current) {
        containerRef.current.style.setProperty(cssVar, cssVar.includes('pct') ? `${next}%` : `${next}px`)
      }
      // For nav, css var is on shell; caller also sets style from React state.
      // During drag we update React state via rAF-coalesced setValue.
      if (raf.current) return
      raf.current = requestAnimationFrame(() => {
        raf.current = 0
        setValue(live.current)
      })
    },
    [cssVar],
  )

  const finish = useCallback(
    (el: HTMLDivElement, pointerId: number) => {
      if (!dragging.current) return
      dragging.current = false
      document.body.classList.remove('is-resizing-split')
      try {
        el.releasePointerCapture(pointerId)
      } catch {
        /* ignore */
      }
      if (raf.current) {
        cancelAnimationFrame(raf.current)
        raf.current = 0
      }
      const next = clamp(live.current, min, max)
      live.current = next
      saveNumber(storageKey, next)
      setValue(next)
    },
    [min, max, storageKey],
  )

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.classList.add('is-resizing-split')
  }, [])

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width < 1) return
      applyLive(clamp(compute(e.clientX, rect), min, max))
    },
    [applyLive, compute, min, max],
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      finish(e.currentTarget, e.pointerId)
    },
    [finish],
  )

  const nudge = useCallback(
    (delta: number) => {
      setValue((current) => {
        const next = clamp(current + delta, min, max)
        live.current = next
        saveNumber(storageKey, next)
        return next
      })
    },
    [min, max, storageKey],
  )

  useEffect(() => {
    return () => {
      document.body.classList.remove('is-resizing-split')
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  return {
    value,
    containerRef,
    onPointerDown,
    onPointerMove,
    endDrag,
    nudge,
    min,
    max,
  }
}

/** Drag handle between calendar column and content. Persists width %. */
export function useCalendarSplit() {
  const compute = useCallback((clientX: number, rect: DOMRect) => {
    return ((clientX - rect.left) / rect.width) * 100
  }, [])

  const split = useDragSplit({
    storageKey: 'tj-calendar-col-pct',
    defaultValue: 58,
    min: 36,
    max: 74,
    compute,
    cssVar: '--cal-col-pct',
  })

  return {
    pct: split.value,
    bodyRef: split.containerRef,
    onPointerDown: split.onPointerDown,
    onPointerMove: split.onPointerMove,
    endDrag: split.endDrag,
    nudge: split.nudge,
    min: split.min,
    max: split.max,
  }
}

/** Drag handle for left nav rail width (px). */
export function useNavSplit() {
  const compute = useCallback((clientX: number, rect: DOMRect) => clientX - rect.left, [])

  const split = useDragSplit({
    storageKey: 'tj-nav-rail-width',
    defaultValue: 118,
    min: 84,
    max: 220,
    compute,
    cssVar: '--nav-rail-width',
  })

  return {
    width: split.value,
    shellRef: split.containerRef,
    onPointerDown: split.onPointerDown,
    onPointerMove: split.onPointerMove,
    endDrag: split.endDrag,
    nudge: split.nudge,
    min: split.min,
    max: split.max,
  }
}
