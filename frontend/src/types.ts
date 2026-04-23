export interface Track {
  id: string
  title: string
  thumbnail: string
  duration: number
  uploader: string
  audio_url: string
  localStemUrls?: Record<string, string>
  mixUploadPromise?: Promise<void>
}

export type TabKey = 'import' | 'player' | 'info'

export interface Tab {
  key: TabKey
  label: string
}

export type StemsStatus = 'not_started' | 'processing' | 'ready' | 'error' | 'canceled'

export type StemName = 'vocals' | 'drums' | 'bass' | 'other' | 'guitar' | 'piano'

export type StemsResponse =
  | { status: 'not_started' }
  | { status: 'processing'; progress?: number }
  | { status: 'ready'; stems: Record<string, string> }
  | { status: 'error'; detail: string }
  | { status: 'canceled' }

import type { Gain } from 'tone'

export interface Stem {
  name: string
  buffer: AudioBuffer
  gain: Gain
  volume: number
  muted: boolean
  solo: boolean
  source: AudioBufferSourceNode | null
}
