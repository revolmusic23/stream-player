import asyncio
import glob
import time
from pathlib import Path

from constants import LIBROSA_MAX_CONCURRENT, VIDEO_ID_RE

LIBRARY_DIR = Path(__file__).parent / "library"
LIBRARY_DIR.mkdir(exist_ok=True)

LOCAL_FILE_TTL_SECONDS = 24 * 60 * 60

LIBROSA_SEMAPHORE = asyncio.Semaphore(LIBROSA_MAX_CONCURRENT)


def find_audio_file(video_id: str) -> Path | None:
    if not VIDEO_ID_RE.match(video_id):
        return None
    matches = glob.glob(str(LIBRARY_DIR / f"{video_id}.*"))
    audio_files = [f for f in matches if not f.endswith(".json")]
    return Path(audio_files[0]) if audio_files else None


def cleanup_stale_local_files():
    now = time.time()
    for path in LIBRARY_DIR.glob("local-*"):
        if not path.is_file():
            continue
        if now - path.stat().st_mtime > LOCAL_FILE_TTL_SECONDS:
            try:
                path.unlink()
            except OSError:
                pass
