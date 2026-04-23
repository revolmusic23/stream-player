<template>
  <div class="card" :class="{ empty: !track }">
    <audio
      v-if="track && track.audio_url"
      ref="audioEl"
      crossorigin="anonymous"
      :src="track.audio_url"
      @timeupdate="onTimeUpdate"
      @play="onAudioPlay"
      @pause="onAudioPause"
      @ended="onEnded"
    />

    <div class="thumbnail">
      <img v-if="track && track.thumbnail" :src="track.thumbnail" :alt="track.title" />
      <div v-else class="thumbnail-placeholder" />
    </div>

    <div class="info">
      <div class="info-top">
        <p class="title">{{ track?.title ?? '尚未載入' }}</p>
        <a
          v-if="track"
          class="help-btn"
          :href="api.downloadFileUrl(track.id, track.title ?? track.id)"
          title="下載原曲"
          >↓</a
        >
      </div>
      <p class="meta">{{ track ? `${track.uploader}` : '-' }}</p>
    </div>

    <div class="player" :class="{ disabled: !track }">
      <div class="progress-wrap" @click="track && onProgressClick($event)">
        <div class="progress-bg">
          <div class="progress-fill" :style="{ width: progress + '%' }" />
        </div>
      </div>
      <div class="time-row">
        <span>{{ formatTime(currentTime) }}</span>
        <span>{{ formatTime(duration) }}</span>
      </div>
      <div class="play-row">
        <button class="play-btn" :disabled="!track" @click="togglePlay">
          <svg v-if="isPlaying" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <rect x="5" y="4" width="4" height="16" rx="1" />
            <rect x="15" y="4" width="4" height="16" rx="1" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polygon points="6,3 21,12 6,21" />
          </svg>
        </button>
      </div>
    </div>

    <div class="controls" :class="{ disabled: !track }">
      <div class="control-row volume">
        <span class="label">音量</span>
        <AppSlider
          :model-value="volume"
          :min="0"
          :max="100"
          class="slider"
          @update:model-value="setVolume"
        />
        <span class="time-label">{{ volume }}%</span>
      </div>

      <div class="control-row">
        <span class="label">速度</span>
        <div class="rate-buttons">
          <button
            v-for="r in rates"
            :key="r"
            :disabled="!track"
            :class="{ active: playbackRate === r }"
            @click="setRate(r)"
          >
            {{ r }}x
          </button>
        </div>
      </div>

      <div class="control-row">
        <span class="label">BPM</span>
        <div class="control-content">
          <button class="adj-btn" @click="adjustBpm(-1)">−</button>
          <input
            ref="bpmInput"
            class="bpm-input"
            type="number"
            :value="bpm"
            min="20"
            max="300"
            @change="(e) => setBpm((e.target as HTMLInputElement).value)"
            @keydown.enter="
              (e) => {
                setBpm((e.target as HTMLInputElement).value)
                ;(e.target as HTMLInputElement).blur()
              }
            "
          />
          <button class="adj-btn" @click="adjustBpm(1)">+</button>
          <button
            class="confirm-btn"
            :disabled="!track || bpmLoading"
            @click="track && detectBpm(track.id, track.mixUploadPromise)"
          >
            {{ bpmLoading ? '偵測中...' : '自動偵測' }}
          </button>
          <button class="confirm-btn" @click="tap">Tap</button>
          <button class="confirm-btn" :class="{ active: isMetronomeOn }" @click="toggleMetronome">
            {{ isMetronomeOn ? '停止' : '開始' }}
          </button>
        </div>
      </div>

      <div class="control-row">
        <span class="label">調性</span>
        <div class="control-content">
          <button class="adj-btn" @click="adjustSemitones(-1)">−</button>
          <span class="bpm-display">{{ semitones > 0 ? '+' : '' }}{{ semitones }}</span>
          <button class="adj-btn" @click="adjustSemitones(1)">+</button>
          <button
            class="confirm-btn"
            :disabled="!track || keyLoading"
            @click="track && detectKey(track.id, track.mixUploadPromise)"
          >
            {{ keyLoading ? '偵測中...' : '偵測' }}
          </button>
          <span v-if="tonic" class="time-label"
            >{{ tonic }}{{ keyMode === 'minor' ? 'm' : '' }}</span
          >
          <button class="confirm-btn" @click="resetTranspose">重設</button>
        </div>
      </div>

      <div class="control-row loop-row">
        <span class="label">Loop</span>
        <div class="loop-body">
          <span class="time-label">{{ formatTime(loopRange[0]) }}</span>
          <AppSlider
            :key="duration"
            v-model="loopRange"
            :min="0"
            :max="duration"
            :disabled="!track"
            class="slider"
          />
          <span class="time-label">{{ formatTime(loopRange[1]) }}</span>
          <button class="confirm-btn" :disabled="!track" @click="seekTo(loopRange[0])">確定</button>
          <button class="confirm-btn" :disabled="!track" @click="resetLoop">清除</button>
        </div>
      </div>

      <div class="control-row stems-row">
        <span class="label">分軌</span>
        <template v-if="stemsStatus === 'not_started'">
          <button class="confirm-btn" :disabled="!track" @click="startStems">產生分軌</button>
          <span v-if="track" class="stems-hint">約需 2–3 分鐘</span>
        </template>
        <template v-else-if="stemsStatus === 'processing'">
          <span class="time-label">
            處理中...{{ stemsProgress !== null ? stemsProgress + '%' : '' }}
          </span>
          <button class="confirm-btn" @click="cancelStems">停止</button>
        </template>
        <span v-else-if="stemsStatus === 'canceled'" class="time-label error-text">已取消</span>
        <template v-else-if="stemsStatus === 'ready'">
          <button class="confirm-btn" :class="{ active: stemsActive }" @click="handleToggleStems">
            {{ stemsActive ? '關閉分軌' : '啟用分軌' }}
          </button>
          <a
            v-if="!track?.localStemUrls"
            class="confirm-btn"
            :href="stemsZipUrl"
            :download="`stems-${track?.id}.zip`"
          >
            下載分軌
          </a>
        </template>
        <template v-else-if="stemsStatus === 'error'">
          <span class="time-label error-text">失敗：{{ stemsError }}</span>
          <button class="confirm-btn" @click="startStems">重試</button>
        </template>
      </div>

      <div v-if="stemsActive && stemsStatus === 'ready'" class="stems-panel">
        <div v-for="(stem, i) in stems" :key="i" class="stem-row">
          <span class="stem-name">{{ stem.name }}</span>
          <button
            class="stem-btn"
            :class="{ active: stem.solo }"
            @click="toggleStemSolo(i)"
            title="Solo"
          >
            S
          </button>
          <button
            class="stem-btn"
            :class="{ active: stem.muted }"
            @click="toggleStemMute(i)"
            title="Mute"
          >
            M
          </button>
          <AppSlider
            :model-value="stem.volume"
            :min="0"
            :max="STEM_VOL_MAX"
            :marks="[100]"
            class="slider"
            @update:model-value="(v: number) => setStemVolume(i, snapStemVolume(v))"
          />
          <span class="time-label">{{ stem.volume }}%</span>
          <button
            v-if="isLocalStems"
            class="stem-btn stem-remove-btn"
            title="移除"
            @click="removeStem(i)"
          >
            ✕
          </button>
        </div>

        <div v-show="isLocalStems" class="stem-add-row">
          <input
            ref="addStemInput"
            type="file"
            accept="audio/*"
            multiple
            class="stem-add-input"
            @change="onAddStemFiles"
          />
          <button class="stem-btn" @click="addStemInput?.click()">+</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef, onUnmounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import AppSlider from './AppSlider.vue'
import '@vueform/slider/themes/default.css'
import { api } from '../api'
import { type Track } from '../types'
import { useMetronome } from '../composables/useMetronome'
import { useTranspose } from '../composables/useTranspose'
import { useStems } from '../composables/useStems'

const props = defineProps<{ track: Track | null }>()

// --- Player ---
const duration = computed(() => props.track?.duration ?? 180)
const audioEl = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const playbackRate = ref(1)
const volume = ref(100)
const loopRange = ref<[number, number]>([0, duration.value])
const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]
const STEM_VOL_MAX = 150
const STEM_SNAP_THRESHOLD = 5

function snapStemVolume(v: number): number {
  return Math.abs(v - 100) <= STEM_SNAP_THRESHOLD ? 100 : v
}
const progress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))

const {
  bpm,
  bpmLoading,
  bpmInput,
  isMetronomeOn,
  adjustBpm,
  setBpm,
  tap,
  detectBpm,
  toggleMetronome,
  stopMetronome,
  resetMetronome,
} = useMetronome(audioEl)

const {
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
} = useTranspose(audioEl)

const addStemInput = ref<HTMLInputElement | null>(null)

const {
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
  getStemMasterGain,
  setMasterGainVolume,
  cleanup: cleanupStems,
} = useStems({
  track: toRef(props, 'track'),
  ensurePitchShift,
  volume,
  playbackRate,
  duration,
  loopRange,
  currentTime,
  isPlaying,
  audioEl,
})

async function onAddStemFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    await addStemFile(file)
  }
  if (addStemInput.value) addStemInput.value.value = ''
}

function onEnded() {
  seekTo(loopRange.value[0])
  audioEl.value?.play()
}

async function togglePlay() {
  if (!props.track) return
  if (stemsActive.value) {
    stemsPlaying.value ? pauseStems() : playStems()
    return
  }
  if (!audioEl.value) return
  await setupPitch(audioEl.value, getStemMasterGain())
  isPlaying.value ? audioEl.value.pause() : audioEl.value.play()
}

function seekTo(time: number) {
  if (!props.track) return
  if (stemsActive.value) {
    seekStems(time)
    return
  }
  if (!audioEl.value) return
  audioEl.value.currentTime = Math.max(0, Math.min(time, duration.value))
}

function setRate(rate: number) {
  playbackRate.value = rate
  if (audioEl.value) audioEl.value.playbackRate = rate
  setSoundTouchPlaybackRate(stemsActive.value ? rate : 1)
  if (stemsActive.value && stemsPlaying.value) {
    const t = stemsCurrentTime()
    startStemSources(t)
  }
}

function handleToggleStems() {
  const willActivate = !stemsActive.value
  toggleStemsMode()
  setSoundTouchPlaybackRate(willActivate ? playbackRate.value : 1)
}

function setVolume(val: number) {
  volume.value = Math.max(0, Math.min(100, val))
  if (audioEl.value) audioEl.value.volume = volume.value / 100
  setMasterGainVolume(volume.value)
}

function resetLoop() {
  loopRange.value = [0, duration.value]
}

function onAudioPlay() {
  if (!stemsActive.value) isPlaying.value = true
}

function onAudioPause() {
  if (!stemsActive.value) isPlaying.value = false
}

function onTimeUpdate() {
  if (!audioEl.value || stemsActive.value) return
  currentTime.value = audioEl.value.currentTime
  if (currentTime.value >= loopRange.value[1]) {
    seekTo(loopRange.value[0])
  }
}

function onProgressClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  seekTo(props.track!.duration * ratio)
}

function formatTime(seconds: number) {
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// --- Track change ---
watch(
  () => props.track?.id,
  async (id) => {
    loopRange.value = [0, duration.value]
    resetMetronome()
    resetTranspose()
    if (!id) {
      resetStems()
      return
    }
    await initStemsForTrack(id, props.track?.localStemUrls)
    setSoundTouchPlaybackRate(stemsActive.value ? playbackRate.value : 1)
  },
)

// --- Keyboard shortcuts ---
function onKey(e: KeyboardEvent) {
  if (document.activeElement?.tagName === 'INPUT') return
  if (e.ctrlKey || e.metaKey || e.altKey) return

  if (e.key === ' ') {
    e.preventDefault()
    togglePlay()
    return
  }

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    seekTo(currentTime.value + 5)
    return
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    seekTo(currentTime.value - 5)
    return
  }

  if (e.key === '=') setVolume(volume.value + 5)
  if (e.key === '-') setVolume(volume.value - 5)
  if (e.key === '\\') setVolume(100)

  if (!props.track) return

  if (e.key >= '0' && e.key <= '9') {
    seekTo(props.track?.duration * (Number(e.key) / 10))
  } else if (e.key === '>') {
    const i = rates.indexOf(playbackRate.value)
    if (i < rates.length - 1) setRate(rates[i + 1])
  } else if (e.key === '<') {
    const i = rates.indexOf(playbackRate.value)
    if (i > 0) setRate(rates[i - 1])
  }
}

useEventListener(document, 'keydown', onKey)

onUnmounted(() => {
  stopMetronome()
  cleanupStems()
  document.body.style.overflow = ''
})
</script>

<style scoped>
@import '../styles/common.css';

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}

.thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  background: var(--border);
}

.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.info {
  padding: 20px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  .title {
    flex: 1;
  }
}

.title {
  font-size: 17px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--text);
}

.meta {
  font-size: 13px;
  color: var(--text-muted);
}

.player {
  padding: 16px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-wrap {
  cursor: pointer;
  padding: 6px 0;
}

.progress-bg {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.1s linear;
  }
}

.time-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
}

.play-row {
  display: flex;
  justify-content: center;
}

.play-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: #f2ebe3;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.1s;

  &:hover {
    opacity: 0.85;
  }
}

.controls {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;

  &.volume {
    margin: 6px 0;
  }
}

.label {
  font-size: 13px;
  color: var(--text-muted);
  width: 36px;
  flex-shrink: 0;
}

.control-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.rate-buttons {
  display: flex;
  gap: 6px;

  button {
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.1s;

    &:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    &.active {
      background: var(--accent);
      border-color: var(--accent);
      color: #f2ebe3;
    }
  }
}

.time-label {
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.stems-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.loop-row {
  gap: 10px;
}

.loop-body {
  display: contents;
}

.slider {
  margin: 0 10px;
  flex: 1;
  --slider-connect-bg: var(--accent);
  --slider-handle-ring-color: var(--accent);
}

.bpm-display {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
  min-width: 36px;
  text-align: center;
}

.adj-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
  flex-shrink: 0;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
}

.bpm-input {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  text-align: center;
  outline: none;

  &:focus {
    border-color: var(--accent);
  }

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
}

.stems-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 4px;
}

.stem-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stem-name {
  font-size: 13px;
  color: var(--text);
  width: 48px;
  flex-shrink: 0;
}

.stem-btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.1s;
  flex-shrink: 0;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #f2ebe3;
  }
}

.stem-remove-btn {
  color: var(--text-muted);
  border: none;

  &:hover {
    border-color: #9b4444;
    color: #9b4444;
  }
}

.stem-add-row {
  display: flex;
  align-items: center;
  padding-top: 4px;
}

.stem-add-input {
  display: none;
}

.error-text {
  color: #9b4444;
}

.help-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
}

a.help-btn {
  text-decoration: none;
}

@media (max-width: 600px) {
  .info {
    padding: 16px 16px 0;
  }

  .player {
    padding: 12px 16px 0;
  }

  .controls {
    padding: 16px 16px 20px;
  }

  .rate-buttons {
    flex-wrap: wrap;
  }

  .control-content {
    gap: 8px;
  }

  /* Loop: label 左邊固定，loop-body 右邊自己 wrap */
  .loop-body {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    gap: 10px;
    align-items: center;
    min-width: 0;

    .slider {
      order: 1;
      flex: 0 0 100%;
      margin: 0;
    }

    span:first-of-type {
      /* 0:00 */
      order: 2;
      flex: 0 0 calc(50% - 5px);
    }

    span:last-of-type {
      /* 3:40 */
      order: 2;
      flex: 0 0 calc(50% - 5px);
      text-align: right;
    }

    .confirm-btn {
      order: 3;
    }
  }

  /* mode-focused 的負 margin 在 wrap 時會造成截斷，修掉 */
  .mode-focused {
    margin: 0;
  }
}
</style>
