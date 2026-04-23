<template>
  <div class="import-tab">
    <SearchPanel ref="searchPanel" @select-url="onSelectUrl" />

    <div class="divider"><span>或貼上網址</span></div>

    <div class="search-bar">
      <input
        ref="urlInput"
        v-model="url"
        type="text"
        placeholder="貼上連結..."
        @keydown.enter="
          (e) => {
            fetchTrack()
            ;(e.target as HTMLInputElement).blur()
          }
        "
      />
      <button class="btn-primary" :disabled="loading" @click="fetchTrack">
        {{ loading ? '載入中...' : '載入' }}
      </button>
    </div>

    <p class="hint">單一影片，最長 {{ MAX_DURATION_MIN }} 分鐘；不支援 playlist / 直播</p>

    <p v-show="error" class="error">{{ error }}</p>

    <template v-if="showYtFallback">
      <div class="yt-fallback">
        <p class="hint">載入失敗，可用以下網站手動下載 mp3 後拖入下方</p>
        <div class="yt-tools">
          <a
            v-for="tool in ytTools"
            :key="tool.name"
            class="confirm-btn"
            :href="tool.href ?? '#'"
            target="_blank"
            rel="noopener"
            >{{ tool.name }}</a
          >
        </div>
      </div>
    </template>

    <div class="divider"><span>或</span></div>

    <DropZone @files="(f) => loadLocalFile(f[0])">
      <span>拖曳音訊檔案，或點此選擇</span>
      <span class="hint-inline">上限 {{ UPLOAD_MAX_MB }} MB</span>
    </DropZone>

    <div class="divider"><span>或</span></div>

    <DropZone multiple @files="loadStemsFiles">
      <span>拖曳分軌檔案，或點此選擇</span>
      <span class="hint-inline">vocals / drums / bass / other</span>
    </DropZone>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { api, API_BASE } from '../api'
import type { Track } from '../types'
import { MAX_DURATION_MIN, UPLOAD_MAX_MB, YT_DOWNLOADERS } from '../constants'
import { uploadMixedStems } from '../utils/audioMix'
import DropZone from './DropZone.vue'
import SearchPanel from './SearchPanel.vue'

const emit = defineEmits<{
  loaded: [track: Track]
  activate: []
}>()

const searchPanel = ref<InstanceType<typeof SearchPanel> | null>(null)

const url = ref(
  import.meta.env.MODE === 'development' ? 'https://www.youtube.com/watch?v=oZpYEEcvu5I' : '',
)
const urlInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref('')
const showYtFallback = ref(false)

function onSelectUrl(selectedUrl: string) {
  url.value = selectedUrl
  urlInput.value?.focus()
}

const isYouTubeUrl = computed(() => /youtube\.com\/watch|youtu\.be\//.test(url.value.trim()))

const ytTools = computed(() =>
  YT_DOWNLOADERS.map((d) => ({
    name: d.name,
    href: d.urlTemplate
      ? d.urlTemplate.replace('{url}', encodeURIComponent(url.value.trim()))
      : undefined,
  })),
)

const copied = ref(false)
async function copyUrl() {
  await navigator.clipboard.writeText(url.value.trim())
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function fetchTrack() {
  if (!url.value.trim()) return
  loading.value = true
  error.value = ''
  showYtFallback.value = false
  try {
    const res = await api.downloadTrack(url.value.trim())
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || '無法下載')
    emit('loaded', { ...data, audio_url: `${API_BASE}${data.audio_url}` })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '未知錯誤'
    if (isYouTubeUrl.value) showYtFallback.value = true
  } finally {
    loading.value = false
  }
}

async function loadLocalFile(file: File) {
  if (!file.type.startsWith('audio/')) {
    error.value = '僅支援音訊檔案'
    return
  }
  if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
    error.value = `檔案超過 ${UPLOAD_MAX_MB} MB 上限`
    return
  }
  error.value = ''
  loading.value = true
  const audioUrl = URL.createObjectURL(file)
  const title = file.name.replace(/\.[^.]+$/, '')
  try {
    const duration = await getFileDuration(file)
    const videoId = `local-${Date.now()}`
    const form = new FormData()
    form.append('file', file)
    const res = await api.upload(videoId, form)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.detail || '上傳失敗')
    }
    emit('loaded', {
      id: videoId,
      title,
      thumbnail: '',
      duration,
      uploader: '本機檔案',
      audio_url: audioUrl,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '無法讀取音訊檔案'
    URL.revokeObjectURL(audioUrl)
  } finally {
    loading.value = false
  }
}

function getFileDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      resolve(Math.round(audio.duration))
      URL.revokeObjectURL(url)
    })
    audio.addEventListener('error', () => {
      resolve(0)
      URL.revokeObjectURL(url)
    })
  })
}

async function loadStemsFiles(files: File[]) {
  error.value = ''
  const audioFiles = files.filter(
    (f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(f.name),
  )
  if (!audioFiles.length) {
    error.value = '找不到音訊檔案'
    return
  }
  const matched: Record<string, string> = {}
  for (let i = 0; i < audioFiles.length; i++) {
    const name = audioFiles[i].name.replace(/\.[^.]+$/, '')
    const key = matched[name] !== undefined ? `${name}-${i}` : name
    matched[key] = URL.createObjectURL(audioFiles[i])
  }
  const duration = await getFileDuration(audioFiles[0])
  const videoId = `local-stems-${Date.now()}`
  const mixUploadPromise = uploadMixedStems(audioFiles, videoId)
  emit('loaded', {
    id: videoId,
    title: '-',
    thumbnail: '',
    duration,
    uploader: '本機分軌',
    audio_url: '',
    localStemUrls: matched,
    mixUploadPromise,
  })
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (document.activeElement?.tagName === 'INPUT') return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === '/') {
    e.preventDefault()
    emit('activate')
    searchPanel.value?.focus()
  }
})
</script>

<style scoped>
.import-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.yt-fallback {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.yt-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hint-inline {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
