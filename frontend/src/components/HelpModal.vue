<template>
  <Teleport to="body">
    <div v-if="modelValue" class="help-overlay" @click.self="$emit('update:modelValue', false)">
      <div class="help-modal">
        <div class="help-header">
          <span>快捷鍵</span>
          <button class="help-close" @click="$emit('update:modelValue', false)">✕</button>
        </div>
        <div class="help-body">
          <div v-for="section in helpSections" :key="section.title" class="help-section">
            <h3>{{ section.title }}</h3>
            <div v-for="s in section.shortcuts" :key="s.key" class="help-row">
              <kbd>{{ s.key }}</kbd>
              <span>{{ s.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()

watch(
  () => props.modelValue,
  (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
  },
)

const helpSections = [
  {
    title: '快捷鍵',
    shortcuts: [
      { key: 'Space', desc: '播放/暫停' },
      { key: '←  →', desc: '後退/前進 5 秒' },
      { key: '0 – 9', desc: '跳到對應進度 (0=0%, 5=50%...)' },
      { key: '<  >', desc: '速度 −/+' },
      { key: '-  =', desc: '音量 −/+ 5%' },
      { key: '\\', desc: '音量重設為 100%' },
      { key: '/', desc: 'Focus URL 輸入框' },
      { key: '?', desc: '顯示/隱藏快捷鍵' },
    ],
  },
]
</script>

<style scoped>
.help-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.help-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  width: 360px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.help-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-right: 8px;
  margin-right: -8px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.help-close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  line-height: 1;

  &:hover {
    color: var(--text);
  }
}

.help-section h3 {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin: 0 0 10px;
}

.help-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 5px 0;
  font-size: 14px;
  color: var(--text);

  kbd {
    font-family: monospace;
    font-size: 12px;
    background: var(--border);
    border-radius: 5px;
    padding: 2px 7px;
    color: var(--text);
    white-space: nowrap;
    min-width: 60px;
    text-align: center;
    flex-shrink: 0;
  }
}
</style>
