import json
import re
from pathlib import Path
from urllib.parse import urlparse

_shared = json.loads(
    (Path(__file__).parent.parent / "shared" / "constants.json").read_text()
)

# upload
UPLOAD_MAX_MB = _shared["upload_max_mb"]
UPLOAD_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024

# download
MAX_DURATION_SECONDS = _shared["max_duration_min"] * 60
ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".mp4",
    ".wav",
    ".flac",
    ".ogg",
    ".m4a",
    ".webm",
    ".aac",
    ".opus",
}

# video_id validation
VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,50}$")

# stems rate limit
STEMS_RATE_LIMIT_MAX = 5
STEMS_RATE_LIMIT_WINDOW = 3600  # seconds

# librosa concurrency (bpm + key 共用)
LIBROSA_MAX_CONCURRENT = 2

ALLOWED_DOMAINS = {
    "soundcloud.com",
    "bandcamp.com",
    "bilibili.com",
    "b23.tv",
    "streetvoice.com",
    "nicovideo.jp",
    "mixcloud.com",
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "audiomack.com",
}


def is_allowed_url(url: str) -> bool:
    try:
        host = urlparse(url).hostname or ""
        return any(host == d or host.endswith("." + d) for d in ALLOWED_DOMAINS)
    except Exception:
        return False
