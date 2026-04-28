#!/usr/bin/env bash
# Set up the venv (idempotent) and start the local SoundCloud Friends server.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install --upgrade pip >/dev/null
pip install -r requirements.txt

PORT="${PORT:-8765}"
HOST="${HOST:-127.0.0.1}"

echo "▶ http://${HOST}:${PORT} (press Ctrl+C to stop)"
exec uvicorn main:app --host "$HOST" --port "$PORT" --reload
