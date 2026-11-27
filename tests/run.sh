#!/usr/bin/env bash
set -euo pipefail
for f in app/src/main/assets/*.js; do node --check "$f"; done
for f in tests/*.js; do node "$f"; done
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
javac -d "$D" app/src/main/java/it/carcode/scanner/MediaCache.java tests/test_media_cache.java
java -cp "$D" it.carcode.scanner.test_media_cache
