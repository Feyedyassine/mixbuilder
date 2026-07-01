import * as Comlink from 'comlink'
import type { AnalysisWorkerApi } from './analysis.worker'

export type AnalysisApi = Comlink.Remote<AnalysisWorkerApi>

/** A unit of work handed a worker's proxied API; resolves with the task's result. */
export type PoolTask<T> = (api: AnalysisApi) => Promise<T>

interface PoolWorker {
  raw: Worker
  proxy: AnalysisApi
  busy: boolean
}

interface QueuedJob {
  task: PoolTask<unknown>
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

/**
 * Leave one core for the main thread / UI. Falls back to 4 cores when the browser
 * doesn't report hardwareConcurrency.
 */
export function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
  return Math.max(1, (cores ?? 4) - 1)
}

/**
 * A fixed pool of analysis workers. Jobs submitted beyond the worker count queue and
 * run as workers free up, so callers can submit an entire playlist at once.
 */
export class AnalysisWorkerPool {
  readonly size: number
  private workers: PoolWorker[] = []
  private queue: QueuedJob[] = []

  constructor(size: number = defaultPoolSize()) {
    this.size = Math.max(1, size)
    for (let i = 0; i < this.size; i++) {
      const raw = new Worker(new URL('./analysis.worker.ts', import.meta.url), {
        type: 'module',
        name: `analysis-${i}`,
      })
      this.workers.push({ raw, proxy: Comlink.wrap<AnalysisWorkerApi>(raw), busy: false })
    }
  }

  /** Submit a job. Resolves when a worker has run it (may queue first). */
  run<T>(task: PoolTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as PoolTask<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      })
      this.pump()
    })
  }

  /** Eagerly initialize Essentia in every worker (otherwise it inits on first job). */
  async warmUp(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.proxy.init()))
  }

  terminate(): void {
    for (const w of this.workers) w.raw.terminate()
    this.workers = []
    this.queue.length = 0
  }

  private pump(): void {
    for (const worker of this.workers) {
      if (worker.busy) continue
      const job = this.queue.shift()
      if (!job) break
      worker.busy = true
      job
        .task(worker.proxy)
        .then(job.resolve, job.reject)
        .finally(() => {
          worker.busy = false
          this.pump()
        })
    }
  }
}
