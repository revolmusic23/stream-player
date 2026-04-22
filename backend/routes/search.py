from fastapi import APIRouter, HTTPException, Query
import yt_dlp

router = APIRouter()


@router.get("/api/search")
def search(q: str = Query(..., min_length=1)):
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch30:{q}", download=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    results = []
    for entry in info.get("entries", []):
        if not entry:
            continue
        results.append(
            {
                "id": entry.get("id"),
                "title": entry.get("title"),
                "uploader": entry.get("uploader") or entry.get("channel"),
                "duration": entry.get("duration"),
            }
        )
    return results
