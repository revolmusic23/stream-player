<template>
  <label
    class="drop-zone"
    :class="{ active: isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="onDrop"
  >
    <slot />
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      :multiple="multiple"
      @change="onFileChange"
    />
  </label>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    accept?: string
    multiple?: boolean
  }>(),
  {
    accept: 'audio/*',
    multiple: false,
  },
)

const emit = defineEmits<{
  files: [files: File[]]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) emit('files', files)
}

function onFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (files.length) {
    emit('files', files)
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<style scoped>
.drop-zone {
  display: block;
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  padding: 28px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;

  &:hover,
  &.active {
    background: var(--surface);
    border-color: var(--accent);
    color: var(--text);
  }

  input {
    display: none;
  }
}
</style>
