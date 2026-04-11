#!/bin/bash
set -e

echo "Post-merge: rebuilding web dist..."
npx kill-port 8081 2>/dev/null || true
NODE_OPTIONS='--max-old-space-size=2048' npx expo export --platform web 2>&1 | tail -5

echo "Post-merge: done"
