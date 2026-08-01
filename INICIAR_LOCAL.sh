#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"
HOST="127.0.0.1"
PORT="8080"

if command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON="python"
else
  printf '%s\n' "No se ha encontrado Python. Abre index.html directamente en el navegador."
  exit 1
fi

"$PYTHON" -m http.server "$PORT" --bind "$HOST" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
sleep 1

URL="http://$HOST:$PORT/"
printf 'Novel Forge 404 esta disponible en %s\n' "$URL"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
fi

wait "$SERVER_PID"
