import os
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.info import router as info_router
from routes.download import router as download_router
from routes.bpm import router as bpm_router
from routes.key import router as key_router
from routes.stems import router as stems_router
from routes.search import router as search_router
from routes.upload import router as upload_router
from library_utils import cleanup_stale_local_files

cleanup_stale_local_files()

app = FastAPI()

_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(info_router)
app.include_router(download_router)
app.include_router(bpm_router)
app.include_router(key_router)
app.include_router(stems_router)
app.include_router(search_router)
app.include_router(upload_router)
app.mount("/library", StaticFiles(directory="library"), name="library")


@app.get("/api/health")
def health():
    return {"status": "ok"}
