/** A local audio file selected by the user, normalized across picker paths. */
export interface TrackFile {
  /** Stable identity = content hash; also the feature-cache key. */
  id: string
  /** The underlying File (stays on device; only derived features are ever uploaded). */
  file: File
  /** Original filename. */
  name: string
  /** Size in bytes. */
  size: number
  /** Content hash (first+last chunk + size). */
  contentHash: string
  /** Best-effort tags for display only — never trusted for analysis (per PRD F1). */
  tags: TrackTags
  /**
   * File System Access handle when available, so the file can be re-read across a
   * session (e.g. junction preview) without re-prompting. Undefined on the
   * `<input>` fallback path.
   */
  handle?: FileSystemFileHandle
}

/** Metadata read from the file's tags. All optional; display-only. */
export interface TrackTags {
  title?: string
  artist?: string
  /** BPM as tagged by the DJ's library — shown, never used for sequencing. */
  bpm?: number
  /** Key as tagged — shown, never used for sequencing. */
  key?: string
  /** Genre as tagged (the file's own tag, not detected) — for catalog metadata. */
  genre?: string
  /** Object URL of embedded cover art, if the file has any (client-side only). */
  cover?: string
}
