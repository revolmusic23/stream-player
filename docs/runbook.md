# Runbook

部署 / 維運常用指令與排查步驟。所有真實 secret 值一律放在 Linode 的 `backend/.env`，不進 repo。

---

## 環境速查

- 後端：Linode 1GB，systemd service `stream-player`，WorkingDirectory `~/stream-player/backend`
- 前端：Vercel，Root Directory = `frontend`
- Service 檔：`/etc/systemd/system/stream-player.service`，`EnvironmentFile=~/stream-player/backend/.env`

---

## 登入 Linode

```sh
ssh <LINODE_IP>
cd ~/stream-player
```

---

## Systemd 指令

```sh
sudo systemctl restart stream-player        # 重啟
sudo systemctl status stream-player         # 狀態、啟動時間、log 摘要
sudo systemctl cat stream-player            # 看 service 檔內容
sudo journalctl -u stream-player -f         # 即時 log
sudo journalctl -u stream-player -n 100     # 最近 100 行 log
```

**改 `.env` 後一定要 `restart`**，不然 process 還用舊值（`load_dotenv` 只在 startup 讀一次）。

---

## Git 同步（Linode 當純部署節點）

```sh
cd ~/stream-player
git fetch
git reset --hard origin/main
```

**不要用 `git pull`**：Linode 若殘留舊 repo 的 commit 會 divergent。`reset --hard` 會丟掉本地 commit，但 `.env`、`library/`、`cookies.txt`（都在 .gitignore）不會被動到。

套件有變更時要補：

```sh
source backend/venv/bin/activate
pip install -r backend/requirements.txt
sudo systemctl restart stream-player
```

---

## 本地驗證 API

不必開前端，從 Linode 直接打自己：

```sh
# info（YouTube metadata）
curl -X POST http://127.0.0.1:8000/api/info \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=<VIDEO_ID>"}'

# download（整個下載流程）
curl -X POST http://127.0.0.1:8000/api/download \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=<VIDEO_ID>"}'

# health
curl http://127.0.0.1:8000/api/health
```

---

## YouTube 下載失敗排查

症狀：`Sign in to confirm you're not a bot` / `Please sign in` / 403。

### 1. 確認 proxy 是否真的進 process

```sh
pgrep -af stream-player                                # 拿 PID
sudo cat /proc/<PID>/environ | tr '\0' '\n' | grep -i proxy
```

沒有 `YT_PROXY_URL=...` → `.env` 沒寫或 service 沒重啟。

### 2. 比對 yt-dlp CLI vs Python API

CLI 能過代表 proxy 本身 OK：

```sh
source ~/stream-player/backend/.env
yt-dlp --proxy "$YT_PROXY_URL" -j --skip-download \
  "https://www.youtube.com/watch?v=<VIDEO_ID>" | head -c 200
```

CLI 過、app 不過 → 多半是 code 沒更新（舊 repo 遺留沒 proxy 支援）。檢查：

```sh
grep -n PROXY ~/stream-player/backend/routes/info.py ~/stream-player/backend/routes/download.py
```

沒看到 `PROXY_URL = os.getenv(...)` → `git reset --hard origin/main` 重新部署。

### 3. 用 TestClient 跑整條 app flow

```sh
cd ~/stream-player/backend
source venv/bin/activate
python - <<'EOF'
from dotenv import load_dotenv
load_dotenv("/home/<user>/stream-player/backend/.env")
from fastapi.testclient import TestClient
from main import app
r = TestClient(app).post("/api/info", json={"url": "https://www.youtube.com/watch?v=<VIDEO_ID>"})
print(r.status_code, r.text[:500])
EOF
```

### 4. `cookies.txt` 過期會反效果

yt-dlp 只要看到 `backend/cookies.txt` 就會用。過期 cookie 會觸發 bot detection。先改名測試：

```sh
mv ~/stream-player/backend/cookies.txt ~/stream-player/backend/cookies.txt.bak
sudo systemctl restart stream-player
```

能過代表 cookie 在害事，徹底刪除或重新從瀏覽器匯出新 cookie。

### 5. yt-dlp 版本太舊

YouTube player 接口常改，舊版 yt-dlp 會噴 bot error。升級：

```sh
cd ~/stream-player/backend
source venv/bin/activate
pip install -U yt-dlp
sudo systemctl restart stream-player
```

CLI 與 venv 版本對照：

```sh
yt-dlp --version
~/stream-player/backend/venv/bin/python -c "import yt_dlp; print(yt_dlp.version.__version__)"
```

---

## Webshare Proxy 管理

### 切換 session

某顆被 YouTube 擋時，換另一個編號即可：

```sh
nano ~/stream-player/backend/.env
# YT_PROXY_URL=http://<username>-<N>:<password>@p.webshare.io:80
sudo systemctl restart stream-player
```

### Replace Proxy（換新 IP）

Webshare dashboard → Proxy List → 那列勾起來 → **Replace Proxy**。username 不變，背後 IP 換新。Replace 有次數限制，優先靠切 session。

### 流量查詢

Webshare dashboard 首頁有 bandwidth 進度條。

### 自動輪換

每 ~5 天自動 rotate 一次整個清單。用 `p.webshare.io` hostname 接不到，service 不用動。

---

## 安全檢查清單（新 API 上線前）

參考 `CLAUDE.md §7`：

1. yt-dlp 端點 → `is_allowed_url()` 擋白名單外的 URL
2. 檔案上傳 → size 上限 + 副檔名驗證
3. `video_id` 路徑參數 → `VIDEO_ID_RE` 驗證
4. 耗資源操作（librosa / Demucs / yt-dlp）→ rate limit / semaphore
5. 付費 API（Replicate）→ rate limit 優先

---

## 常見問題

### 改 `.env` 沒生效

- 忘記 `sudo systemctl restart stream-player`
- `.env` 路徑錯：必須在 `~/stream-player/backend/.env`
- 驗證方式：`sudo cat /proc/<PID>/environ | tr '\0' '\n' | grep <KEY>`

### CORS error

前端叫不到後端 → `ALLOWED_ORIGINS` 沒包含前端網址。改 `.env`：

```
ALLOWED_ORIGINS=https://<domain>,http://localhost:5173
```

restart service。

### 硬碟滿

分軌 mp3 存在 `backend/library/`。檢查：

```sh
du -sh ~/stream-player/backend/library
df -h
```

滿了就刪舊檔，或之後接 R2。
