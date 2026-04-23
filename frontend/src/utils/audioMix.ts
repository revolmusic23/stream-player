import { api } from '../api'

const WAV_HEADER_SIZE = 44
const WAV_FMT_CHUNK_SIZE = 16
const WAV_PCM_FORMAT = 1
const WAV_BITS_PER_SAMPLE = 16
const WAV_BYTES_PER_SAMPLE = 2
const INT16_MAX = 0x7fff
const INT16_NEG_RANGE = 0x8000
const MIX_NUM_CHANNELS = 1

export async function mixStemsToWavBlob(files: File[]): Promise<Blob> {
  const decodeCtx = new AudioContext()
  let buffers: AudioBuffer[]
  try {
    buffers = await Promise.all(
      files.map(async (f) => decodeCtx.decodeAudioData(await f.arrayBuffer())),
    )
  } finally {
    await decodeCtx.close()
  }
  const sampleRate = buffers[0].sampleRate
  const length = Math.max(...buffers.map((b) => b.length))
  const offline = new OfflineAudioContext(MIX_NUM_CHANNELS, length, sampleRate)
  for (const b of buffers) {
    const src = offline.createBufferSource()
    src.buffer = b
    src.connect(offline.destination)
    src.start()
  }
  const mixed = await offline.startRendering()
  return audioBufferToMonoWav(mixed)
}

export async function uploadMixedStems(files: File[], videoId: string): Promise<void> {
  const wav = await mixStemsToWavBlob(files)
  const form = new FormData()
  form.append('file', new File([wav], 'mix.wav', { type: 'audio/wav' }))
  const res = await api.upload(videoId, form)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `upload failed: ${res.status}`)
  }
}

function audioBufferToMonoWav(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const byteRate = sampleRate * WAV_BYTES_PER_SAMPLE
  const dataSize = length * WAV_BYTES_PER_SAMPLE
  const arr = new ArrayBuffer(WAV_HEADER_SIZE + dataSize)
  const view = new DataView(arr)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, WAV_HEADER_SIZE - 8 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, WAV_FMT_CHUNK_SIZE, true)
  view.setUint16(20, WAV_PCM_FORMAT, true)
  view.setUint16(22, MIX_NUM_CHANNELS, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, WAV_BYTES_PER_SAMPLE, true)
  view.setUint16(34, WAV_BITS_PER_SAMPLE, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const samples = buffer.getChannelData(0)
  let offset = WAV_HEADER_SIZE
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * INT16_NEG_RANGE : s * INT16_MAX, true)
    offset += WAV_BYTES_PER_SAMPLE
  }
  return new Blob([arr], { type: 'audio/wav' })
}
