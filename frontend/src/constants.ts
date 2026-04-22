import shared from '@shared/constants.json'

export const MAX_DURATION_MIN = shared.max_duration_min
export const UPLOAD_MAX_MB = shared.upload_max_mb

export interface YtDownloader {
  name: string
  // 支援帶入 URL 用 {url} 佔位；不支援則省略，使用者自行貼上
  urlTemplate?: string
}

export const YT_DOWNLOADERS: YtDownloader[] = [
  { name: 'y2mate', urlTemplate: 'https://v1.y2mate.sc/' },
  { name: 'y2mate-2', urlTemplate: 'https://en1.y2mate.is/' },
  { name: 'y2mate-3', urlTemplate: 'https://www.coiffeurannecy.fr/' },
  { name: 'savefrom.net', urlTemplate: 'https://en1.savefrom.net/' },
  { name: 'ssyoutube', urlTemplate: 'https://ssyoutube.com/' },
  {
    name: '4K Video Downloader',
    urlTemplate: 'https://www.4kdownload.com/products/videodownloader',
  },
]
