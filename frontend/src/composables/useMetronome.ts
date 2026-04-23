import { ref } from 'vue'
import type { Ref } from 'vue'
import * as Tone from 'tone'
import { api } from '../api'

const DEFAULT_BPM = 120

function getAudioCtx(): AudioContext {
  return Tone.getContext().rawContext as AudioContext
}

export function useMetronome(audioEl: Ref<HTMLAudioElement | null>) {
  const bpm = ref(DEFAULT_BPM)
  const bpmLoading = ref(false)
  const bpmInput = ref<HTMLInputElement | null>(null)
  const isMetronomeOn = ref(false)
  const beatTimes = ref<number[] | null>(null)
  const taps: number[] = []
  let schedulerTimer: ReturnType<typeof setTimeout> | null = null
  let nextBeatTime = 0
  let beatIndex = 0
  let activeBeatTimes: number[] | null = null

  function scheduleClick(time: number) {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(1.0, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
    osc.start(time)
    osc.stop(time + 0.04)
  }

  function runScheduler() {
    const ctx = getAudioCtx()
    if (activeBeatTimes && audioEl.value) {
      const audioNow = audioEl.value.currentTime
      const lookahead = audioNow + 0.1
      while (beatIndex < activeBeatTimes.length) {
        const beatAudioTime = activeBeatTimes[beatIndex]
        if (beatAudioTime > lookahead) break
        if (beatAudioTime >= audioNow) {
          scheduleClick(ctx.currentTime + (beatAudioTime - audioNow))
        }
        beatIndex++
      }
    } else {
      while (nextBeatTime < ctx.currentTime + 0.1) {
        scheduleClick(nextBeatTime)
        nextBeatTime += 60 / bpm.value
      }
    }
    schedulerTimer = setTimeout(runScheduler, 25)
  }

  function startMetronome() {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    if (beatTimes.value && audioEl.value) {
      activeBeatTimes = beatTimes.value
      beatTimes.value = null
      const audioNow = audioEl.value.currentTime
      beatIndex = activeBeatTimes.findIndex((t) => t >= audioNow)
      if (beatIndex === -1) beatIndex = activeBeatTimes.length
    } else {
      activeBeatTimes = null
      nextBeatTime = ctx.currentTime
    }
    isMetronomeOn.value = true
    runScheduler()
  }

  function stopMetronome() {
    if (schedulerTimer !== null) clearTimeout(schedulerTimer)
    schedulerTimer = null
    activeBeatTimes = null
    isMetronomeOn.value = false
  }

  function toggleMetronome() {
    isMetronomeOn.value ? stopMetronome() : startMetronome()
  }

  function adjustBpm(delta: number) {
    beatTimes.value = null
    bpm.value = Math.max(20, Math.min(300, bpm.value + delta))
  }

  function setBpm(val: string | number) {
    beatTimes.value = null
    bpm.value = Math.max(20, Math.min(300, Number(val)))
  }

  function tap() {
    beatTimes.value = null
    const now = Date.now()
    taps.push(now)
    if (taps.length > 8) taps.shift()
    if (taps.length >= 2) {
      const intervals = []
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1])
      const avg = intervals.reduce((a, b) => a + b) / intervals.length
      bpm.value = Math.round(60000 / avg)
    }
  }

  async function detectBpm(trackId: string, mixUploadPromise?: Promise<void>) {
    stopMetronome()
    bpmLoading.value = true
    try {
      if (mixUploadPromise) await mixUploadPromise
      const res = await api.bpm(trackId)
      if (!res.ok) throw new Error('偵測失敗')
      const data = await res.json()
      bpm.value = Math.round(data.bpm)
      beatTimes.value = data.beats
      startMetronome()
    } catch (e) {
      console.error(e)
    } finally {
      bpmLoading.value = false
    }
  }

  function resetMetronome() {
    stopMetronome()
    bpm.value = DEFAULT_BPM
    beatTimes.value = null
    taps.length = 0
  }

  return {
    bpm,
    bpmLoading,
    bpmInput,
    isMetronomeOn,
    beatTimes,
    adjustBpm,
    setBpm,
    tap,
    detectBpm,
    toggleMetronome,
    stopMetronome,
    resetMetronome,
  }
}
