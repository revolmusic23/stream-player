import asyncio
import io
import os
import re
import time
import urllib.request
import zipfile
from pathlib import Path

import replicate
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from constants import STEMS_RATE_LIMIT_MAX, STEMS_RATE_LIMIT_WINDOW, VIDEO_ID_RE
from library_utils import LIBRARY_DIR, find_audio_file

router = APIRouter()

STEMS_DIR = LIBRARY_DIR / "stems"
REPLICATE_MODEL = (
    "ryan5453/demucs:53191dee0efbfc3cbfdbab276b0dcce930705e9a4d1bb9fe1e2a7cdd33d9ca82"
)
DEMUCS_MODEL = "htdemucs_6s"
STEMS_MP3_BITRATE = 192
POLL_INTERVAL_SECONDS = 2

_processing: set[str] = set()
_errors: dict[str, str] = {}
_progress: dict[str, int] = {}
_predictions: dict[str, str] = {}
_canceled: set[str] = set()
_cancel_requested: set[str] = set()

_rate_log: dict[str, list[float]] = {}


def _validate_video_id(video_id: str):
    if not VIDEO_ID_RE.match(video_id):
        raise HTTPException(status_code=400, detail="無效的 video_id")


def _check_rate_limit(ip: str):
    now = time.time()
    timestamps = _rate_log.get(ip, [])
    timestamps = [t for t in timestamps if now - t < STEMS_RATE_LIMIT_WINDOW]
    if len(timestamps) >= STEMS_RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="請求過於頻繁，請稍後再試")
    timestamps.append(now)
    _rate_log[ip] = timestamps


def _stem_dir(video_id: str) -> Path:
    return STEMS_DIR / DEMUCS_MODEL / video_id


def _parse_progress(logs: str | None) -> int | None:
    if not logs:
        return None
    matches = re.findall(r"(\d+)%\|", logs)
    return int(matches[-1]) if matches else None


def _status_for(video_id: str) -> dict:
    d = _stem_dir(video_id)
    if video_id not in _processing and d.exists():
        files = {p.stem: p.name for p in d.glob("*.mp3")}
        if files:
            return {
                "status": "ready",
                "stems": {
                    name: f"/library/stems/{DEMUCS_MODEL}/{video_id}/{filename}"
                    for name, filename in files.items()
                },
            }
    if video_id in _processing:
        result: dict = {"status": "processing"}
        if video_id in _progress:
            result["progress"] = _progress[video_id]
        return result
    if video_id in _canceled:
        return {"status": "canceled"}
    if video_id in _errors:
        return {"status": "error", "detail": _errors[video_id]}
    return {"status": "not_started"}


async def _run_replicate(video_id: str, audio_path: Path):
    _processing.add(video_id)
    _errors.pop(video_id, None)
    _progress.pop(video_id, None)
    _canceled.discard(video_id)
    _cancel_requested.discard(video_id)
    try:
        out_dir = _stem_dir(video_id)
        out_dir.mkdir(parents=True, exist_ok=True)

        loop = asyncio.get_event_loop()

        def _call_replicate():
            client = replicate.Client(api_token=os.getenv("REPLICATE_API_TOKEN"))
            version = REPLICATE_MODEL.split(":", 1)[1]
            with open(audio_path, "rb") as f:
                prediction = client.predictions.create(
                    version=version,
                    input={
                        "audio": f,
                        "model": DEMUCS_MODEL,
                        "mp3_bitrate": STEMS_MP3_BITRATE,
                    },
                )
            _predictions[video_id] = prediction.id
            if video_id in _cancel_requested:
                _cancel_requested.discard(video_id)
                client.predictions.cancel(prediction.id)

            while prediction.status not in ("succeeded", "failed", "canceled"):
                time.sleep(POLL_INTERVAL_SECONDS)
                prediction.reload()
                pct = _parse_progress(prediction.logs)
                if pct is not None:
                    _progress[video_id] = pct

            if prediction.status == "canceled":
                _canceled.add(video_id)
                return
            if prediction.status != "succeeded":
                raise RuntimeError(f"Replicate 失敗: {prediction.error}")

            output = prediction.output
            if not isinstance(output, dict):
                raise RuntimeError(f"unexpected output type: {type(output)}")
            saved = []
            for stem, url in output.items():
                if not url:
                    continue
                try:
                    with urllib.request.urlopen(str(url)) as resp:
                        data = resp.read()
                    (out_dir / f"{stem}.mp3").write_bytes(data)
                    saved.append(stem)
                except Exception as e:
                    print(f"[stems] {stem}: failed ({e})")
            if not saved:
                raise RuntimeError("所有分軌都失敗")

        await loop.run_in_executor(None, _call_replicate)

    except Exception as e:
        _errors[video_id] = str(e)
    finally:
        _processing.discard(video_id)
        _progress.pop(video_id, None)
        _predictions.pop(video_id, None)


@router.get("/api/stems/{video_id}")
def get_stems(video_id: str):
    _validate_video_id(video_id)
    return _status_for(video_id)


@router.get("/api/stems/{video_id}/zip")
def download_stems_zip(video_id: str):
    _validate_video_id(video_id)
    d = _stem_dir(video_id)
    files = sorted(d.glob("*.mp3")) if d.exists() else []
    if not files:
        raise HTTPException(status_code=404, detail="分軌尚未產生")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
        for f in files:
            zf.write(f, arcname=f.name)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="stems-{video_id}.zip"'},
    )


@router.post("/api/stems/{video_id}")
async def start_stems(video_id: str, request: Request):
    _validate_video_id(video_id)
    current = _status_for(video_id)
    if current["status"] in ("processing", "ready"):
        return current

    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    audio_path = find_audio_file(video_id)
    if not audio_path:
        raise HTTPException(status_code=404, detail="找不到音檔，請先下載")

    asyncio.create_task(_run_replicate(video_id, audio_path))
    return {"status": "processing"}


@router.delete("/api/stems/{video_id}")
def cancel_stems(video_id: str):
    _validate_video_id(video_id)
    if video_id not in _processing:
        raise HTTPException(status_code=404, detail="沒有進行中的分軌任務")
    prediction_id = _predictions.get(video_id)
    if prediction_id:
        client = replicate.Client(api_token=os.getenv("REPLICATE_API_TOKEN"))
        client.predictions.cancel(prediction_id)
    else:
        _cancel_requested.add(video_id)
    return {"status": "canceling"}
