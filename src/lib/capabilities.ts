import { analyticsActive, trackEvent } from '@/lib/analytics'

// One coarse device-capability report per browser session, to decide whether an
// in-browser stem splitter would be fast for mixbuilder's real visitors: is there
// a WebGPU adapter (and is it real hardware or a software fallback), plus CPU
// cores and memory in broad buckets. Nothing identifying — no GPU name or vendor.

export type WebGpuSupport = 'yes' | 'fallback' | 'no_adapter' | 'no_api' | 'error'

interface GpuAdapterLike {
  info?: { isFallbackAdapter?: boolean }
  /** Older spelling, still exposed by some browsers. */
  isFallbackAdapter?: boolean
}
interface GpuLike {
  requestAdapter: () => Promise<GpuAdapterLike | null>
}

export async function detectWebGpu(
  gpu: GpuLike | undefined = (navigator as Navigator & { gpu?: GpuLike }).gpu,
): Promise<WebGpuSupport> {
  if (!gpu) return 'no_api'
  try {
    const adapter = await gpu.requestAdapter()
    if (!adapter) return 'no_adapter'
    return adapter.info?.isFallbackAdapter || adapter.isFallbackAdapter ? 'fallback' : 'yes'
  } catch {
    return 'error'
  }
}

export function coresBucket(cores: number | undefined): string {
  if (!cores) return 'unknown'
  return cores <= 4 ? '1-4' : cores <= 8 ? '5-8' : '9+'
}

/** navigator.deviceMemory is already coarse (≤8, Chromium only). */
export function memoryBucket(gb: number | undefined): string {
  if (!gb) return 'unknown'
  return gb < 4 ? '<4' : gb < 8 ? '4-7' : '8+'
}

const SENT_KEY = 'mb-capabilities-sent'

/**
 * Send the report once per session, only when analytics is actually running (so an
 * EU visitor's report goes out after they accept, not before). Safe to call often.
 */
export async function reportCapabilitiesOnce(): Promise<void> {
  if (!analyticsActive()) return
  try {
    if (sessionStorage.getItem(SENT_KEY)) return
    sessionStorage.setItem(SENT_KEY, '1')
  } catch {
    // Storage blocked: report anyway; worst case it repeats on a later page load.
  }
  const nav = navigator as Navigator & { deviceMemory?: number }
  trackEvent('device_capabilities', {
    webgpu: await detectWebGpu(),
    cpu_cores: coresBucket(nav.hardwareConcurrency),
    device_memory: memoryBucket(nav.deviceMemory),
  })
}
