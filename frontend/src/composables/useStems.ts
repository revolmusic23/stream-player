import { ref, computed, markRaw } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import * as Tone from 'tone'
import type { SoundTouchWorkletNode } from './useTranspose'
import { API_BASE } from '../api'
import type { Stem, StemsStatus, StemsResponse, Track } from '../types'

function getAudioCtx(): AudioContext {
  return Tone.getContext().rawContext as AudioContext
}

interface StemsOptions {
  track: Ref<Track | null>
  ensurePitchShift: () => Promise<SoundTouchWorkletNode>
  volume: Ref<number>
  playbackRate: Ref<number>
  duration: ComputedRef<number> | Ref<number>
  loopRange: Ref<[number, number]>
  currentTime: Ref<number>
  isPlaying: Ref<boolean>
  audioEl: Ref<HTMLAudioElement | null>
}

export function useStems(opts: StemsOptions) {
  const {
    track,
    ensurePitchShift,
    volume,
    playbackRate,
    duration,
    loopRange,
    currentTime,
    isPlaying,
    audioEl,
  } = opts

  const stemsStatus = ref<StemsStatus>('not_started')
  const stemsZipUrl = computed(() =>
    track.value ? `${API_BASE}/api/stems/${track.value.id}/zip` : '',
  )
  const stemsError = ref('')
  const stemsProgress = ref<number | null>(null)
  const stems = ref<Stem[]>([])
  const stemsActive = ref(false)
  const stemsPlaying = ref(false)
  const isLocalStems = ref(false)
  let stemsOffset = 0
  let stemsStartCtxTime = 0
  let stemMasterGain: Tone.Gain | null = null
  let stemsPollTimer: ReturnType<typeof setTimeout> | null = null
  let stemsRafId: number | null = null

  function getStemMasterGain() {
    return stemMasterGain
  }

  async function fetchStemsStatus(id: string): Promise<StemsResponse> {
    const res = await fetch(`${API_BASE}/api/stems/${id}`)
    return res.json()
  }

  const CANCELED_RESET_MS = 2500

  function schedulePoll(id: string) {
    stemsPollTimer = setTimeout(async () => {
      if (!track.value || track.value.id !== id) return
      try {
        const data = await fetchStemsStatus(id)
        stemsStatus.value = data.status
        if (data.status === 'ready') {
          stemsProgress.value = null
          await loadStems(data.stems)
        } else if (data.status === 'error') {
          stemsError.value = data.detail || ''
        } else if (data.status === 'canceled') {
          stemsProgress.value = null
          setTimeout(() => {
            if (stemsStatus.value === 'canceled') stemsStatus.value = 'not_started'
          }, CANCELED_RESET_MS)
        } else if (data.status === 'processing') {
          stemsProgress.value = data.progress ?? null
          schedulePoll(id)
        }
      } catch (e) {
        stemsError.value = e instanceof Error ? e.message : '未知錯誤'
        stemsStatus.value = 'error'
      }
    }, 3000)
  }

  function stopPolling() {
    if (stemsPollTimer) clearTimeout(stemsPollTimer)
    stemsPollTimer = null
  }

  async function startStems() {
    if (!track.value) return
    const id = track.value.id
    stemsError.value = ''
    try {
      const res = await fetch(`${API_BASE}/api/stems/${id}`, { method: 'POST' })
      const data = await res.json()
      stemsStatus.value = data.status
      if (data.status === 'processing') {
        schedulePoll(id)
      } else if (data.status === 'ready') {
        await loadStems(data.stems)
      }
    } catch (e) {
      stemsStatus.value = 'error'
      stemsError.value = e instanceof Error ? e.message : '未知錯誤'
    }
  }

  async function cancelStems() {
    if (!track.value) return
    const id = track.value.id
    try {
      await fetch(`${API_BASE}/api/stems/${id}`, { method: 'DELETE' })
    } catch {}
  }

  async function loadStems(urls: Record<string, string>, local = false) {
    const ctx = getAudioCtx()
    const ps = await ensurePitchShift()
    if (!stemMasterGain) {
      stemMasterGain = new Tone.Gain(volume.value / 100)
      stemMasterGain.connect(ps as unknown as Tone.ToneAudioNode)
    }
    const available = Object.keys(urls)
    const entries = await Promise.all(
      available.map(async (name) => {
        const url = local ? urls[name]! : `${API_BASE}${urls[name]}`
        const res = await fetch(url)
        const ab = await res.arrayBuffer()
        const buffer = await ctx.decodeAudioData(ab)
        const gain = new Tone.Gain(1)
        gain.connect(stemMasterGain!)
        return {
          name,
          buffer: markRaw(buffer),
          gain: markRaw(gain),
          volume: 100,
          muted: false,
          solo: false,
          source: null,
        }
      }),
    )
    stems.value = entries
  }

  function updateStemGains() {
    const hasSolo = stems.value.some((s) => s.solo)
    for (const s of stems.value) {
      const active = hasSolo ? s.solo : !s.muted
      s.gain.gain.value = active ? s.volume / 100 : 0
    }
  }

  function setStemVolume(i: number, v: number) {
    stems.value[i].volume = Math.max(0, Math.min(150, Math.round(v)))
    updateStemGains()
  }

  function toggleStemMute(i: number) {
    stems.value[i].muted = !stems.value[i].muted
    updateStemGains()
  }

  function toggleStemSolo(i: number) {
    stems.value[i].solo = !stems.value[i].solo
    updateStemGains()
  }

  function stemsCurrentTime() {
    if (!stemsPlaying.value) return stemsOffset
    const ctx = getAudioCtx()
    return stemsOffset + (ctx.currentTime - stemsStartCtxTime) * playbackRate.value
  }

  function startStemSources(offset: number) {
    stopStemSources()
    const ctx = getAudioCtx()
    for (const s of stems.value) {
      const src = ctx.createBufferSource()
      src.buffer = s.buffer
      src.playbackRate.value = playbackRate.value
      Tone.connect(src, s.gain as Tone.Gain)
      src.start(0, Math.min(Math.max(0, offset), s.buffer.duration))
      s.source = markRaw(src)
    }
    stemsOffset = offset
    stemsStartCtxTime = ctx.currentTime
    currentTime.value = offset
    stemsPlaying.value = true
    isPlaying.value = true
    startStemsTimer()
  }

  function stopStemSources() {
    for (const s of stems.value) {
      if (s.source) {
        try {
          s.source.stop()
        } catch {}
        s.source = null
      }
    }
    stopStemsTimer()
    stemsPlaying.value = false
  }

  function startStemsTimer() {
    const tick = () => {
      if (!stemsPlaying.value) return
      const t = stemsCurrentTime()
      if (t >= duration.value) {
        startStemSources(loopRange.value[0])
        return
      }
      currentTime.value = t
      if (audioEl.value) {
        try {
          audioEl.value.currentTime = t
        } catch {}
      }
      if (t >= loopRange.value[1]) {
        startStemSources(loopRange.value[0])
        return
      }
      stemsRafId = requestAnimationFrame(tick)
    }
    stemsRafId = requestAnimationFrame(tick)
  }

  function stopStemsTimer() {
    if (stemsRafId) cancelAnimationFrame(stemsRafId)
    stemsRafId = null
  }

  function playStems() {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    startStemSources(stemsOffset)
  }

  function pauseStems() {
    stemsOffset = stemsCurrentTime()
    stopStemSources()
    isPlaying.value = false
  }

  function seekStems(t: number) {
    t = Math.max(0, Math.min(t, duration.value))
    stemsOffset = t
    currentTime.value = t
    if (audioEl.value) {
      try {
        audioEl.value.currentTime = t
      } catch {}
    }
    if (stemsPlaying.value) startStemSources(t)
  }

  function toggleStemsMode() {
    if (stemsActive.value) {
      const wasPlaying = stemsPlaying.value
      pauseStems()
      stemsActive.value = false
      if (audioEl.value) {
        audioEl.value.muted = false
        if (wasPlaying) audioEl.value.play()
      }
    } else {
      const wasPlaying = audioEl.value ? !audioEl.value.paused : false
      stemsActive.value = true
      if (audioEl.value) {
        stemsOffset = audioEl.value.currentTime || 0
        audioEl.value.muted = true
        if (!audioEl.value.paused) audioEl.value.pause()
      }
      if (stemMasterGain) stemMasterGain.gain.value = volume.value / 100
      if (wasPlaying) playStems()
    }
  }

  function removeStem(i: number) {
    const stem = stems.value[i]
    if (stem.source) {
      try {
        stem.source.stop()
      } catch {}
      stem.source = null
    }
    try {
      stem.gain.disconnect()
    } catch {}
    stems.value = stems.value.filter((_, idx) => idx !== i)
    updateStemGains()
  }

  async function addStemFile(file: File) {
    const ctx = getAudioCtx()
    const ps = await ensurePitchShift()
    if (!stemMasterGain) {
      stemMasterGain = new Tone.Gain(volume.value / 100)
      stemMasterGain.connect(ps as unknown as Tone.ToneAudioNode)
    }
    const name = file.name.replace(/\.[^.]+$/, '')
    const ab = await file.arrayBuffer()
    const buffer = await ctx.decodeAudioData(ab)
    const gain = new Tone.Gain(1)
    gain.connect(stemMasterGain!)
    const stem: Stem = {
      name,
      buffer: markRaw(buffer),
      gain: markRaw(gain),
      volume: 100,
      muted: false,
      solo: false,
      source: null,
    }
    stems.value = [...stems.value, stem]
    updateStemGains()
    if (stemsPlaying.value) {
      const src = ctx.createBufferSource()
      src.buffer = stem.buffer
      src.playbackRate.value = playbackRate.value
      Tone.connect(src, stem.gain as Tone.Gain)
      const offset = stemsCurrentTime()
      src.start(0, Math.min(Math.max(0, offset), stem.buffer.duration))
      stem.source = markRaw(src)
    }
  }

  function resetStems() {
    stopPolling()
    pauseStems()
    stemsActive.value = false
    isLocalStems.value = false
    if (audioEl.value) audioEl.value.muted = false
    for (const s of stems.value) {
      try {
        s.gain.disconnect()
      } catch {}
    }
    stems.value = []
    stemsStatus.value = 'not_started'
    stemsError.value = ''
    stemsProgress.value = null
    stemsOffset = 0
  }

  async function initStemsForTrack(id: string, localStemUrls?: Record<string, string>) {
    resetStems()
    if (localStemUrls) {
      isLocalStems.value = true
      await loadStems(localStemUrls, true)
      stemsStatus.value = 'ready'
      stemsActive.value = true
      if (stemMasterGain) stemMasterGain.gain.value = volume.value / 100
      return
    }
    try {
      const data = await fetchStemsStatus(id)
      if (data.status === 'ready') {
        stemsStatus.value = 'ready'
        await loadStems(data.stems)
      } else if (data.status === 'processing') {
        stemsStatus.value = 'processing'
        schedulePoll(id)
      } else {
        stemsStatus.value = 'not_started'
      }
    } catch {}
  }

  function setMasterGainVolume(v: number) {
    if (stemMasterGain) stemMasterGain.gain.value = v / 100
  }

  function cleanup() {
    stopPolling()
    stopStemSources()
    for (const s of stems.value) {
      try {
        s.gain.disconnect()
      } catch {}
    }
    try {
      stemMasterGain?.disconnect()
    } catch {}
  }

  return {
    stemsStatus,
    stemsZipUrl,
    stemsError,
    stemsProgress,
    stems,
    stemsActive,
    stemsPlaying,
    isLocalStems,
    startStems,
    cancelStems,
    toggleStemsMode,
    resetStems,
    initStemsForTrack,
    setStemVolume,
    toggleStemMute,
    toggleStemSolo,
    removeStem,
    addStemFile,
    playStems,
    pauseStems,
    seekStems,
    stemsCurrentTime,
    startStemSources,
    stopStemSources,
    stopPolling,
    getStemMasterGain,
    setMasterGainVolume,
    cleanup,
  }
}
