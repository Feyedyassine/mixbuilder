// Synthesize a 16-bit PCM WAV in-memory so audio tests need no binary fixtures
// (keeps CI hermetic and sidesteps any track-licensing concerns).

export interface WavSineOptions {
  sampleRate?: number
  seconds?: number
  freq?: number
  amplitude?: number
  channels?: number
}

export function makeWavSine({
  sampleRate = 44100,
  seconds = 1,
  freq = 440,
  amplitude = 0.5,
  channels = 1,
}: WavSineOptions = {}): ArrayBuffer {
  const frames = Math.floor(sampleRate * seconds)
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = frames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < frames; i++) {
    const sample = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate)
    const clamped = Math.max(-1, Math.min(1, sample))
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    for (let c = 0; c < channels; c++) {
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return buffer
}
