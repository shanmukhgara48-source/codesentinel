#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_DIR/scripts/java21.sh"
cd "$PROJECT_DIR/backend"
if [ "${1:-}" = "--packaged" ]; then
  exec java -jar target/codesentinel-1.0.0.jar
fi
exec ./mvnw -q spring-boot:run
