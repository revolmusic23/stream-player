#!/bin/bash
set -e

echo "==> Backend"
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

echo "==> Frontend"
cd frontend
npm install
cd ..

echo "==> Root"
npm install

echo "==> Done"
