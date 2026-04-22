# Stream Player

A web-based music practice tool built for musicians and singers. Load a track, loop any section, detect BPM and key, transpose in real time, and separate stems — all in the browser.

**Live:** https://stream.revolchu.com · UI in Traditional Chinese

<img src="assets/screenshot-playertab.jpg" width="600" />

---

## What it does

**Loop practice** — drag a range slider to mark any section, then loop it indefinitely while adjusting speed and pitch independently.

**BPM detection** — librosa analyzes the track and returns a beat-sync metronome. You can also tap tempo or type a BPM manually.

**Key detection** — chroma features + Krumhansl-Schmuckler algorithm gives you the tonic and mode.

**Real-time transposition** — SoundTouch AudioWorklet shifts pitch ±12 semitones without changing playback speed, processed entirely in the browser.

**Stem separation** — 6-track Demucs separation (vocals, drums, bass, guitar, piano, other) via Replicate API. Per-track volume, mute, solo, and ZIP download.

**Flexible import** — paste a URL (SoundCloud, Bandcamp, Bilibili, StreetVoice, NicoNico, Mixcloud), upload a local file, or drag in stems directly. YouTube search is built in.

---

## Tech stack

### Frontend
- **Vue 3 + TypeScript + Vite**
- Pitch shifting: `@soundtouchjs/audio-worklet` via Web Audio API
- Metronome: Tone.js
- Utilities: VueUse, @vueform/slider

### Backend
- **FastAPI (Python 3.12)**
- Audio download: yt-dlp + ffmpeg
- BPM / key analysis: librosa, NumPy, SciPy
- Stem separation: [Demucs](https://github.com/facebookresearch/demucs) via [Replicate API](https://replicate.com)

### Infrastructure
- Frontend: Vercel
- Backend: Linode (Ubuntu, systemd + nginx + certbot)
- DNS: Hover (`stream.revolchu.com`, `stream-api.revolchu.com`)

---

## Architecture highlights

- **Shared constants** (`shared/constants.json`) is the single source of truth for upload limits, max duration, etc. — imported by both frontend and backend.
- **No GPU required** — stem separation is offloaded to Replicate's async API; the server just polls and proxies.
- **CPU safety** — librosa analysis is gated behind an asyncio semaphore to prevent concurrent requests from saturating the server.
- **Non-destructive audio graph** — transposition runs in a Web Audio worklet, so pitch and speed are always independent and reverting is instant.
- **Security** — URL inputs are validated against a domain allowlist; `video_id` path params are regex-checked before any file I/O; Replicate calls are rate-limited per IP.

---

## Keyboard shortcuts

| Key     | Action               |
| ------- | -------------------- |
| `Space` | Play / Pause         |
| `← →`   | Seek ±5 seconds      |
| `0`–`9` | Jump to 0%–90%       |
| `< >`   | Speed −/+            |
| `- =`   | Volume −/+ 5%        |
| `\`     | Reset volume to 100% |
| `/`     | Focus search         |
| `?`     | Help modal           |
