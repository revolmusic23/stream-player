import subprocess
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

from constants import MAX_DURATION_SECONDS, is_allowed_url
from library_utils import LIBRARY_DIR, find_audio_file


def _fixup_mpegts_container(path: Path) -> None:
    """yt-dlp 偶爾把 HLS 的 MPEG-TS 容器以 .mp3 副檔名存（如 StreetVoice），
    <audio> 無法播放。偵測到就 remux 成純 mp3 容器（不重編碼）。"""
    try:
        probe = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=format_name",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return
    if probe.stdout.strip() != "mpegts":
        return
    tmp = path.with_suffix(".remux.mp3")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(path), "-c:a", "copy", "-f", "mp3", str(tmp)],
            check=True,
            capture_output=True,
            timeout=60,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        tmp.unlink(missing_ok=True)
        return
    path.unlink()
    tmp.rename(path)


router = APIRouter()


class DownloadRequest(BaseModel):
    url: str


@router.post("/api/download")
def download_track(body: DownloadRequest):
    if not is_allowed_url(body.url):
        raise HTTPException(
            status_code=400,
            detail="不支援此平台，YouTube 請手動下載後拖入",
        )
    COOKIES_FILE = Path(__file__).parent.parent / "cookies.txt"
    cookies = str(COOKIES_FILE) if COOKIES_FILE.exists() else None

    ydl_opts_info = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "cookiefile": cookies,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(body.url, download=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if info.get("_type") == "playlist" or info.get("entries"):
        raise HTTPException(status_code=400, detail="不支援 playlist，請貼單一影片連結")
    if info.get("is_live") or info.get("live_status") in ("is_live", "is_upcoming"):
        raise HTTPException(status_code=400, detail="不支援直播")

    duration = info.get("duration")
    if duration and duration > MAX_DURATION_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"影片長度 {duration // 60} 分鐘，超過 {MAX_DURATION_SECONDS // 60} 分鐘上限",
        )

    video_id = info.get("id")

    cached = find_audio_file(video_id)
    if cached:
        filename = cached.name
    else:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": str(LIBRARY_DIR / "%(id)s.%(ext)s"),
            "hls_use_mpegts": False,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            "cookiefile": cookies,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([body.url])
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        downloaded = find_audio_file(video_id)
        if not downloaded:
            raise HTTPException(status_code=500, detail="下載失敗")
        if downloaded.suffix == ".mp3":
            _fixup_mpegts_container(downloaded)
        filename = downloaded.name

    return {
        "id": video_id,
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader"),
        "audio_url": f"/library/{filename}",
    }


@router.get("/api/download/{video_id}/file")
def download_file(video_id: str, filename: str | None = None):
    path = find_audio_file(video_id)
    if not path:
        raise HTTPException(status_code=404, detail="找不到音檔")
    base = filename or video_id
    download_name = f"{base}{path.suffix}"
    return FileResponse(
        path,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"
        },
    )
