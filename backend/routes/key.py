import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import librosa
import numpy as np

from library_utils import LIBROSA_SEMAPHORE, find_audio_file

router = APIRouter()

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


class KeyRequest(BaseModel):
    video_id: str


def estimate_key(y: np.ndarray, sr: int) -> tuple[str, str]:
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_avg = np.mean(chroma, axis=1)
    best = (-np.inf, 0, "major")
    for i in range(12):
        rotated = np.roll(chroma_avg, -i)
        major_score = float(np.corrcoef(rotated, MAJOR_PROFILE)[0, 1])
        minor_score = float(np.corrcoef(rotated, MINOR_PROFILE)[0, 1])
        if major_score > best[0]:
            best = (major_score, i, "major")
        if minor_score > best[0]:
            best = (minor_score, i, "minor")
    return NOTE_NAMES[best[1]], best[2]


def _analyze(path: Path) -> dict:
    y, sr = librosa.load(path, mono=True, duration=120)
    tonic, mode = estimate_key(y, sr)
    return {"tonic": tonic, "mode": mode}


@router.post("/api/key")
async def detect_key(body: KeyRequest):
    path = find_audio_file(body.video_id)
    if not path:
        raise HTTPException(status_code=404, detail="找不到音檔，請先下載")
    async with LIBROSA_SEMAPHORE:
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(None, _analyze, path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
