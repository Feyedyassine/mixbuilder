import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from '@/state/useSession'
import { sequenceInOrder, type AnalyzedTrack, type SequencedSet } from '@/sequencing/sequencer'
import { localGet } from '@/storage/idb-cache'
import { communityGet } from '@/storage/community-cache'
import {
  deleteSet,
  listSets,
  loadSet,
  renameSet,
  saveSet,
  type SetSummary,
} from '@/storage/sets-store'
import type { TrackDisplay } from '@/export/build'

/** Payload handed to whoever renders the built set (SetBuilder) when one is opened. */
export interface OpenedSet {
  built: SequencedSet
  display: Map<string, TrackDisplay>
  name: string
  note: string | null
  id: string
}

interface SavedSetsValue {
  sets: SetSummary[]
  currentId: string | null
  signedIn: boolean
  setCurrentId: (id: string | null) => void
  refresh: () => Promise<void>
  open: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  save: (data: Parameters<typeof saveSet>[2], name: string) => Promise<void>
  registerReceiver: (fn: ((s: OpenedSet) => void) | null) => void
}

const Ctx = createContext<SavedSetsValue | null>(null)

/**
 * Owns the saved-sets list so it can be reached from the header (any screen,
 * including the empty landing) as well as the builder. Opening a set does the data
 * work here and hands the result to a receiver the builder registers.
 */
export function SavedSetsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const userId = session?.user.id
  const [sets, setSets] = useState<SetSummary[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const receiverRef = useRef<((s: OpenedSet) => void) | null>(null)

  const refresh = useCallback(async () => {
    setSets(userId ? await listSets() : [])
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const open = useCallback(
    async (id: string) => {
      const record = await loadSet(id)
      if (!record) return
      const resolved: AnalyzedTrack[] = []
      const display = new Map<string, TrackDisplay>()
      for (const ref of record.data.tracks) {
        display.set(ref.hash, { fileName: ref.fileName, title: ref.title, artist: ref.artist })
        const features =
          (await localGet(ref.hash)) ?? (userId ? await communityGet(ref.hash) : null)
        if (features) resolved.push({ id: ref.hash, features })
      }
      const missing = record.data.tracks.length - resolved.length
      setCurrentId(id)
      receiverRef.current?.({
        built: sequenceInOrder(resolved, { arc: record.data.arc }),
        display,
        name: record.name,
        note:
          missing > 0
            ? `${missing} of ${record.data.tracks.length} tracks aren't analyzed on this device — re-add the files to include them.`
            : null,
        id,
      })
    },
    [userId],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteSet(id)
      setCurrentId((c) => (c === id ? null : c))
      await refresh()
    },
    [refresh],
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameSet(id, name)
      await refresh()
    },
    [refresh],
  )

  const save = useCallback(
    async (data: Parameters<typeof saveSet>[2], name: string) => {
      if (!userId) return
      const id = await saveSet(userId, name, data, currentId ?? undefined)
      if (id) setCurrentId(id)
      await refresh()
    },
    [userId, currentId, refresh],
  )

  const registerReceiver = useCallback((fn: ((s: OpenedSet) => void) | null) => {
    receiverRef.current = fn
  }, [])

  const value = useMemo(
    () => ({
      sets,
      currentId,
      signedIn: !!userId,
      setCurrentId,
      refresh,
      open,
      remove,
      rename,
      save,
      registerReceiver,
    }),
    [sets, currentId, userId, refresh, open, remove, rename, save, registerReceiver],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook colocated by design
export function useSavedSets(): SavedSetsValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSavedSets must be used within SavedSetsProvider')
  return v
}
