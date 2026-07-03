/**
 * Run an async worker over items with at most `limit` in flight at once. Uses the
 * shared-cursor pattern: `limit` runners pull the next index until the list is
 * exhausted. Bounds peak resource use (e.g. decoded-audio memory) while keeping
 * the work saturated. Order of completion is not guaranteed; the worker reports
 * results via side effects.
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const bound = Math.max(1, Math.min(limit, items.length))
  let cursor = 0
  const runners = Array.from({ length: bound }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index]!, index)
    }
  })
  await Promise.all(runners)
}
