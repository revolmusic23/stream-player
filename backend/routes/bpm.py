import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import librosa
import numpy as np

from library_utils import LIBROSA_SEMAPHORE, find_audio_file

router = APIRouter()


class BpmRequest(BaseModel):
    video_id: str


def _analyze(path: Path) -> dict:
    y, sr = librosa.load(path, mono=True, duration=120)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.round(tempo.item() if hasattr(tempo, "item") else tempo, 1))
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    return {"bpm": bpm, "beats": beat_times}


@router.post("/api/bpm")
async def detect_bpm(body: BpmRequest):
    path = find_audio_file(body.video_id)
    if not path:
        raise HTTPException(status_code=404, detail="找不到音檔，請先下載")
    async with LIBROSA_SEMAPHORE:
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(None, _analyze, path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
