#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_DIR/scripts/java21.sh"
node "$PROJECT_DIR/scripts/check-stopped.mjs"
if [ ! -f "$PROJECT_DIR/backend/target/codesentinel-1.0.0.jar" ] || [ ! -d "$PROJECT_DIR/frontend/dist" ]; then
  echo 'Run ./scripts/setup.sh first to build both applications.' >&2
  exit 1
fi
cd "$PROJECT_DIR"
JAVA_PID=''
UI_PID=''
cleanup() {
  trap - EXIT INT TERM
  [ -z "$UI_PID" ] || kill "$UI_PID" 2>/dev/null || true
  [ -z "$JAVA_PID" ] || kill "$JAVA_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
java -jar backend/target/codesentinel-1.0.0.jar &
JAVA_PID=$!
node frontend/node_modules/vite/bin/vite.js preview frontend --config frontend/vite.config.js --host 127.0.0.1 --port 5173 --strictPort &
UI_PID=$!
printf '\nCodeSentinel: http://127.0.0.1:5173 — Ctrl+C stops both services.\n'
while kill -0 "$JAVA_PID" 2>/dev/null && kill -0 "$UI_PID" 2>/dev/null; do
  sleep 1
done
echo 'A service stopped. Check the output above (ports 8080 and 5173 must be available).' >&2
exit 1
