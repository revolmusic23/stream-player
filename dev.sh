#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 22

if [ "$1" = "prod" ]; then
  # prod 模式：前端打生產後端，不起本地後端
  cd frontend
  npm run dev -- --mode production
else
  # 後端（背景執行）
  cd backend
  source venv/bin/activate
  uvicorn main:app --reload &
  BACKEND_PID=$!
  cd ..

  # Ctrl+C 時一起關掉後端
  trap "kill $BACKEND_PID" EXIT

  # 前端（前景執行，Ctrl+C 會觸發 trap）
  cd frontend
  npm run dev
fi
