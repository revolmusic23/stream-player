from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from constants import (
    ALLOWED_AUDIO_EXTENSIONS,
    UPLOAD_MAX_BYTES,
    UPLOAD_MAX_MB,
    VIDEO_ID_RE,
)
from library_utils import LIBRARY_DIR, cleanup_stale_local_files

router = APIRouter()


@router.post("/api/upload")
async def upload_audio(
    file: UploadFile = File(...),
    video_id: str = Query(...),
):
    if not VIDEO_ID_RE.match(video_id):
        raise HTTPException(status_code=400, detail="video_id 格式錯誤")

    cleanup_stale_local_files()

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail=f"不支援的檔案格式：{suffix or '（無副檔名）'}"
        )

    data = await file.read(UPLOAD_MAX_BYTES + 1)
    if len(data) > UPLOAD_MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"檔案超過 {UPLOAD_MAX_MB} MB 上限")

    dest = LIBRARY_DIR / f"{video_id}{suffix}"
    dest.write_bytes(data)

    return {"video_id": video_id, "filename": dest.name}
