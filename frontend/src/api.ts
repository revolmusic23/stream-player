export const API_BASE: string = import.meta.env.VITE_API_BASE_URL

const jsonBody = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  // --- download ---
  downloadTrack: (url: string) =>
    fetch(`${API_BASE}/api/download`, { method: 'POST', ...jsonBody({ url }) }),
  downloadFileUrl: (id: string, filename?: string) => {
    const base = `${API_BASE}/api/download/${id}/file`
    return filename ? `${base}?filename=${encodeURIComponent(filename)}` : base
  },

  // --- upload ---
  upload: (videoId: string, form: FormData) =>
    fetch(`${API_BASE}/api/upload?video_id=${videoId}`, { method: 'POST', body: form }),

  // --- search ---
  search: (q: string) => fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`),

  // --- bpm / key ---
  bpm: (videoId: string) =>
    fetch(`${API_BASE}/api/bpm`, { method: 'POST', ...jsonBody({ video_id: videoId }) }),
  key: (videoId: string) =>
    fetch(`${API_BASE}/api/key`, { method: 'POST', ...jsonBody({ video_id: videoId }) }),

  // --- stems ---
  stemsStatus: (id: string) => fetch(`${API_BASE}/api/stems/${id}`),
  stemsStart: (id: string) => fetch(`${API_BASE}/api/stems/${id}`, { method: 'POST' }),
  stemsCancel: (id: string) => fetch(`${API_BASE}/api/stems/${id}`, { method: 'DELETE' }),
  stemsZipUrl: (id: string) => `${API_BASE}/api/stems/${id}/zip`,
}
