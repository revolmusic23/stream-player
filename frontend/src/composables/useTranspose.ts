import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import * as Tone from 'tone'
import { api } from '../api'

let workletRegistered = false

async function ensureWorkletRegistered() {
  if (workletRegistered) return
  await Tone.getContext().addAudioWorkletModule('/soundtouch-processor.js')
  workletRegistered = true
}

export type SoundTouchWorkletNode = AudioWorkletNode

export function useTranspose(audioEl: Ref<HTMLAudioElement | null>) {
  const semitones = ref(0)
  const tonic = ref<string | null>(null)
  const keyMode = ref<string | null>(null)
  const keyLoading = ref(false)
  let pitchNode: SoundTouchWorkletNode | null = null
  let pitchSource: MediaElementAudioSourceNode | null = null

  async function ensurePitchShift(): Promise<SoundTouchWorkletNode> {
    if (!pitchNode) {
      await ensureWorkletRegistered()
      const toneCtx = Tone.getContext()
      pitchNode = toneCtx.createAudioWorkletNode('soundtouch-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })
      pitchNode.parameters.get('pitchSemitones')!.value = semitones.value
      pitchNode.connect(toneCtx.rawContext.destination)
    }
    return pitchNode
  }

  async function setupPitch(el: HTMLAudioElement, stemMasterGain: Tone.Gain | null) {
    if (pitchSource) return
    await Tone.start()
    const pn = await ensurePitchShift()
    if (stemMasterGain) {
      try {
        stemMasterGain.disconnect()
      } catch {}
      stemMasterGain.connect(pn as unknown as Tone.ToneAudioNode)
    }
    const rawCtx = Tone.getContext().rawContext as AudioContext
    pitchSource = rawCtx.createMediaElementSource(el)
    pitchSource!.connect(pn)
  }

  watch(audioEl, (_el, oldEl) => {
    if (oldEl && pitchSource) {
      pitchSource.disconnect()
      pitchSource = null
    }
  })

  watch(semitones, (val) => {
    if (pitchNode) pitchNode.parameters.get('pitchSemitones')!.value = val
  })

  function setSoundTouchPlaybackRate(rate: number) {
    if (pitchNode) pitchNode.parameters.get('playbackRate')!.value = rate
  }

  function adjustSemitones(delta: number) {
    semitones.value = Math.max(-12, Math.min(12, semitones.value + delta))
  }

  function resetTranspose() {
    semitones.value = 0
    tonic.value = null
    keyMode.value = null
  }

  async function detectKey(trackId: string, mixUploadPromise?: Promise<void>) {
    keyLoading.value = true
    try {
      if (mixUploadPromise) await mixUploadPromise
      const res = await api.key(trackId)
      if (!res.ok) throw new Error('偵測失敗')
      const data = await res.json()
      tonic.value = data.tonic
      keyMode.value = data.mode
    } catch (e) {
      console.error(e)
    } finally {
      keyLoading.value = false
    }
  }

  return {
    semitones,
    tonic,
    keyMode,
    keyLoading,
    adjustSemitones,
    resetTranspose,
    detectKey,
    setupPitch,
    ensurePitchShift,
    setSoundTouchPlaybackRate,
  }
}
