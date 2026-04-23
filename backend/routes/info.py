import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yt_dlp

from constants import is_allowed_url

PROXY_URL = os.getenv("YT_PROXY_URL")

router = APIRouter()


class InfoRequest(BaseModel):
    url: str


@router.post("/api/info")
def get_info(body: InfoRequest):
    if not is_allowed_url(body.url):
        raise HTTPException(
            status_code=400,
            detail="不支援此平台，YouTube 請手動下載後拖入",
        )
    COOKIES_FILE = Path(__file__).parent.parent / "cookies.txt"

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "cookiefile": str(COOKIES_FILE) if COOKIES_FILE.exists() else None,
        **({"proxy": PROXY_URL} if PROXY_URL else {}),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(body.url, download=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "id": info.get("id"),
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),  # 秒數
        "uploader": info.get("uploader"),
        "webpage_url": info.get("webpage_url"),
    }
