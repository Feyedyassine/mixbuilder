// Minimal type surface for the essentia.js ES builds we use. The package ships a
// large generated core_api.d.ts but does not map it to these deep import paths,
// so we declare only what the analysis code touches (expanded as Phase 2 grows).

declare module 'essentia.js/dist/essentia-wasm.es.js' {
  // Emscripten module: either the module object directly or a factory returning it.
  export const EssentiaWASM: unknown
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  export default class Essentia {
    constructor(wasm: unknown, isDebug?: boolean)
    version: string
    algorithmNames: string
    arrayToVector(array: Float32Array): unknown
    vectorToArray(vector: unknown): Float32Array
    RMS(signal: unknown): { rms: number }
    delete(): void
  }
}
