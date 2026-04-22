<template>
  <div class="search-panel">
    <div class="search-bar">
      <div class="input-wrap">
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          placeholder="搜尋 YouTube..."
          @keydown.enter="doSearch"
        />
        <button v-show="query || results.length" class="clear-btn" @click="clearSearch">✕</button>
      </div>
      <button class="btn-primary" :disabled="searching" @click="doSearch">
        {{ searching ? '搜尋中...' : '搜尋' }}
      </button>
    </div>

    <div v-show="results.length" class="results">
      <div
        v-for="r in results.slice(0, visibleCount)"
        :key="r.id"
        class="result-row"
        @click="loadById(r.id)"
      >
        <img
          class="result-thumb"
          :src="`https://img.youtube.com/vi/${r.id}/mqdefault.jpg`"
          loading="lazy"
        />
        <div class="result-info">
          <div class="result-title">{{ r.title }}</div>
          <div class="result-meta">{{ r.uploader }} · {{ formatDuration(r.duration) }}</div>
        </div>
      </div>
      <div v-if="visibleCount < results.length" class="load-more" @click="visibleCount += 10">
        載入更多
      </div>
    </div>

    <p v-show="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { API_BASE } from '../api'

const emit = defineEmits<{
  selectUrl: [url: string]
}>()

defineExpose({ focus })

interface SearchResult {
  id: string
  title: string
  uploader: string | null
  duration: number | null
}

const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const searching = ref(false)
const error = ref('')
const results = ref<SearchResult[]>([])
const visibleCount = ref(10)

function focus() {
  searchInput.value?.focus()
  searchInput.value?.select()
}

async function doSearch() {
  if (!query.value.trim()) return
  searching.value = true
  error.value = ''
  results.value = []
  visibleCount.value = 10
  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query.value.trim())}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || '搜尋失敗')
    results.value = data
  } catch (e) {
    error.value = e instanceof Error ? e.message : '未知錯誤'
  } finally {
    searching.value = false
  }
}

function loadById(id: string) {
  emit('selectUrl', `https://www.youtube.com/watch?v=${id}`)
  clearSearch()
}

function clearSearch() {
  query.value = ''
  results.value = []
  error.value = ''
  visibleCount.value = 10
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
@import '../styles/common.css';

.search-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-wrap {
  position: relative;
  flex: 1;
  display: flex;
}

input {
  padding-right: 36px;
}

.clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  transition: color 0.1s;

  &:hover {
    color: var(--text);
  }
}

.error {
  color: #9b4444;
  font-size: 14px;
}

.results {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;

  &:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  &:hover {
    background: var(--surface);
  }
}

.result-thumb {
  width: 80px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: var(--border);
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.result-title {
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-meta {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.load-more {
  padding: 10px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  border-top: 1px solid var(--border);
  transition: color 0.1s;

  &:hover {
    color: var(--text);
  }
}
</style>
