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
    info = None
    last_error: Exception | None = None
    for _ in range(2):
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"ytsearch30:{q}", download=False)
            break
        except Exception as e:
            last_error = e
            if "403" not in str(e):
                break

    if info is None:
        raw = str(last_error)
        if "403" in raw or "429" in raw:
            friendly = "YouTube 暫時拒絕請求，請稍後再試"
        else:
            friendly = "搜尋失敗，請稍後再試"
        raise HTTPException(status_code=400, detail=f"{friendly}\n（{raw}）")

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
