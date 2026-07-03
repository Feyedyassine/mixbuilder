// Junction preview (plan Chunk 4.4): play the outgoing track's outro crossfading
// into the incoming track's intro, from the local files. Uses two HTMLAudioElements
// with a volume crossfade — no full decode, and the click that starts it satisfies
// the browser's autoplay gesture requirement.

export interface PreviewHandle {
  stop: () => void
}

interface PlayOptions {
  /** Seconds of the outgoing track before the crossfade starts. */
  leadSec?: number
  crossfadeSec?: number
  /** Seconds of the incoming track after the crossfade completes. */
  tailSec?: number
}

export function playJunction(
  fromFile: File,
  fromSec: number,
  toFile: File,
  toSec: number,
  { leadSec = 2, crossfadeSec = 4, tailSec = 2 }: PlayOptions = {},
): PreviewHandle {
  const aUrl = URL.createObjectURL(fromFile)
  const bUrl = URL.createObjectURL(toFile)
  const a = new Audio(aUrl)
  const b = new Audio(bUrl)
  a.preload = 'auto'
  b.preload = 'auto'

  let stopped = false
  let raf = 0

  const cleanup = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    a.pause()
    b.pause()
    URL.revokeObjectURL(aUrl)
    URL.revokeObjectURL(bUrl)
  }

  const seek = (el: HTMLAudioElement, sec: number) => {
    const set = () => {
      el.currentTime = Math.max(0, sec)
    }
    if (el.readyState >= 1) set()
    else el.addEventListener('loadedmetadata', set, { once: true })
  }

  seek(a, fromSec)
  seek(b, toSec)
  a.volume = 1
  b.volume = 0

  const begin = () => {
    if (stopped) return
    void a.play().catch(cleanup)
    const t0 = performance.now()
    let bStarted = false
    const tick = () => {
      if (stopped) return
      const t = (performance.now() - t0) / 1000
      if (t >= leadSec) {
        if (!bStarted) {
          bStarted = true
          void b.play().catch(() => {})
        }
        const f = Math.min(1, (t - leadSec) / crossfadeSec)
        a.volume = 1 - f
        b.volume = f
      }
      if (t >= leadSec + crossfadeSec + tailSec) {
        cleanup()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  if (a.readyState >= 2) begin()
  else a.addEventListener('canplay', begin, { once: true })

  return { stop: cleanup }
}
