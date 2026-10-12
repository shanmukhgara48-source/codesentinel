#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_DIR/scripts/java21.sh"
node "$PROJECT_DIR/scripts/check-stopped.mjs"
cd "$PROJECT_DIR/backend"
./mvnw -B verify
cd "$PROJECT_DIR/frontend"
npm ci
npm run build
npx playwright install chromium
printf '\nSetup complete. Run ./scripts/start.sh from the project directory.\n'
