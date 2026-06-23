#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/kotlin"

echo "==> Kotlin build"
./gradlew build -x :db:test

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "==> DB integration tests (Testcontainers)"
  ./gradlew :db:test
else
  echo "==> Skipping :db:test (Docker not available)"
fi

echo "==> Smoke check passed"
