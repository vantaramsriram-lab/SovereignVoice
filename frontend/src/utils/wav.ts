/**
 * Browser-side conversion of a recorded clip to WAV.
 *
 * MediaRecorder can only produce WebM/OGG (or MP4 on Safari), so a finished
 * recording is decoded with the Web Audio API and re-encoded as 16-bit PCM WAV,
 * one of the formats the backend accepts. Speech-to-text works well at 16 kHz
 * mono, which also keeps the file small: about 32 KB per second.
 */

export const WAV_SAMPLE_RATE = 16_000
const WAV_HEADER_BYTES = 44
const BYTES_PER_SAMPLE = 2

export type WavConversion =
  | { ok: true; blob: Blob; sampleRate: number }
  | { ok: false; reason: 'too_large' | 'decode_failed' }

/** Size in bytes of a mono 16-bit WAV with this many sample frames. */
export function wavByteLength(frames: number): number {
  return WAV_HEADER_BYTES + frames * BYTES_PER_SAMPLE
}

/** Averages all channels into one. */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const length = channels[0]?.length ?? 0
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i += 1) mono[i] += channel[i]
  }
  for (let i = 0; i < length; i += 1) mono[i] /= channels.length
  return mono
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
}

/** Encodes mono float samples (-1..1) as a 16-bit PCM WAV file. */
export function encodeWavMono(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * BYTES_PER_SAMPLE
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true) // byte rate
  view.setUint16(32, BYTES_PER_SAMPLE, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = WAV_HEADER_BYTES
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += BYTES_PER_SAMPLE
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

type OfflineContextCtor = new (
  channels: number,
  length: number,
  sampleRate: number,
) => OfflineAudioContext

function decode(context: OfflineAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Older Safari only supports the callback form; modern browsers support both.
  return new Promise<AudioBuffer>((resolve, reject) => {
    const pending = context.decodeAudioData(data, resolve, reject)
    // Failures are already delivered through `reject`; don't leave a second,
    // unhandled rejection behind.
    pending?.catch?.(() => undefined)
  })
}

/**
 * Converts a recorded clip to mono 16-bit WAV. Never throws: on any problem it
 * reports why, so the caller can keep the original recording instead.
 */
export async function convertToWav(
  recording: Blob,
  options: { maxBytes: number; sampleRate?: number },
): Promise<WavConversion> {
  const targetRate = options.sampleRate ?? WAV_SAMPLE_RATE
  try {
    const Ctor: OfflineContextCtor | undefined =
      (window as unknown as { OfflineAudioContext?: OfflineContextCtor })
        .OfflineAudioContext ??
      (window as unknown as { webkitOfflineAudioContext?: OfflineContextCtor })
        .webkitOfflineAudioContext
    if (!Ctor) return { ok: false, reason: 'decode_failed' }

    // decodeAudioData resamples to the context's rate, so decoding at the
    // target rate gives 16 kHz audio directly.
    const context = new Ctor(1, 1, targetRate)
    const decoded = await decode(context, await recording.arrayBuffer())

    // Check the size before allocating the WAV, so a very long clip never
    // builds a huge buffer just to be thrown away.
    if (wavByteLength(decoded.length) > options.maxBytes) {
      return { ok: false, reason: 'too_large' }
    }

    const channels: Float32Array[] = []
    for (let i = 0; i < decoded.numberOfChannels; i += 1) {
      channels.push(decoded.getChannelData(i))
    }
    if (channels.length === 0 || decoded.length === 0) {
      return { ok: false, reason: 'decode_failed' }
    }

    // Use the rate the browser actually produced, so the header is always true.
    const blob = encodeWavMono(mixToMono(channels), decoded.sampleRate)
    return { ok: true, blob, sampleRate: decoded.sampleRate }
  } catch {
    return { ok: false, reason: 'decode_failed' }
  }
}
