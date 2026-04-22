<template>
  <header>
    <div class="header-top">
      <h1>Stream Player</h1>
      <button class="help-btn" @click="showHelp = !showHelp">?</button>
    </div>
    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>
  </header>

  <main>
    <ImportTab
      v-show="activeTab === 'import'"
      @loaded="onTrackLoaded"
      @activate="activeTab = 'import'"
    />

    <div v-show="activeTab === 'player'">
      <PlayerTab :track="track" />
    </div>
  </main>

  <footer>
    <a href="mailto:revolcc@proton.me" title="Email" aria-label="Email">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    </a>
    <a
      href="https://github.com/revolmusic23/stream-player"
      target="_blank"
      rel="noopener"
      title="GitHub"
      aria-label="GitHub"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path
          d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
        />
      </svg>
    </a>
    <a
      href="https://revolchu.com"
      target="_blank"
      rel="noopener"
      title="Website"
      aria-label="Website"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path
          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        />
      </svg>
    </a>
    <span class="copyright">© 2026 雷歐 Revol.C</span>
  </footer>

  <HelpModal v-model="showHelp" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import PlayerTab from './components/PlayerTab.vue'
import ImportTab from './components/ImportTab.vue'
import HelpModal from './components/HelpModal.vue'
import type { Tab, TabKey, Track } from './types'

const tabs: Tab[] = [
  { key: 'import', label: '匯入' },
  { key: 'player', label: '播放器' },
]
const activeTab = ref<TabKey>('import')
const track = ref<Track | null>(null)
const showHelp = ref(false)

function onTrackLoaded(data: Track) {
  track.value = data
  activeTab.value = 'player'
}

useEventListener('keydown', (e: KeyboardEvent) => {
  if (document.activeElement?.tagName === 'INPUT') return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === '?') {
    showHelp.value = !showHelp.value
  } else if (e.key === 'Escape' && showHelp.value) {
    showHelp.value = false
  }
})
</script>

<style scoped>
header {
  width: 100%;
  max-width: 640px;
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}

.tab {
  padding: 8px 18px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition:
    color 0.1s,
    border-color 0.1s;

  &:hover:not(:disabled) {
    opacity: 1;
    color: var(--text);
  }

  &.active {
    color: var(--text);
    border-bottom-color: var(--accent);
    font-weight: 500;
  }
}

h1 {
  font-family: 'DM Serif Display', serif;
  font-size: 28px;
  font-weight: 400;
  color: var(--text);
  letter-spacing: -0.5px;
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

main {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

footer {
  width: 100%;
  max-width: 640px;
  margin-top: 48px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--text-muted);

  a {
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
    transition: color 0.1s;

    &:hover {
      color: var(--accent);
    }
  }

  .copyright {
    margin-left: auto;
    font-size: 12px;
  }
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
