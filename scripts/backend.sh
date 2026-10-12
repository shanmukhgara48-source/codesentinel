#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$PROJECT_DIR/scripts/java21.sh"
cd "$PROJECT_DIR/backend"
exec ./mvnw -q spring-boot:run
