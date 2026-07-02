import { describe, expect, it } from 'vitest'
import { ANALYSIS_SAMPLE_RATE, decodeToMono } from '@/analysis/decode'
import { makeWavSine } from '@/test/wav-fixture'

describe('decodeToMono (browser)', () => {
  it('decodes a WAV to mono at the analysis sample rate', async () => {
    const wav = makeWavSine({ sampleRate: 44100, seconds: 1, freq: 440, amplitude: 0.5 })
    const { mono, sampleRate, durationSec } = await decodeToMono(wav)
    expect(sampleRate).toBe(ANALYSIS_SAMPLE_RATE)
    expect(durationSec).toBeCloseTo(1, 1)
    expect(mono.length).toBeCloseTo(44100, -3)
  })

  it('resamples a differently-sampled source to the analysis rate', async () => {
    const wav = makeWavSine({ sampleRate: 22050, seconds: 1 })
    const { sampleRate } = await decodeToMono(wav)
    expect(sampleRate).toBe(ANALYSIS_SAMPLE_RATE)
  })

  it('downmixes stereo to a single channel', async () => {
    const wav = makeWavSine({ seconds: 1, channels: 2 })
    const { mono } = await decodeToMono(wav)
    expect(mono).toBeInstanceOf(Float32Array)
    expect(mono.length).toBeGreaterThan(0)
  })
})
