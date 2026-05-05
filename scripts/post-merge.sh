#!/bin/bash
set -e

# Post-merge runs after a task agent's changes are merged into main.
#
# We deliberately do NOT rebuild dist/ here. dist/ is a PRODUCTION artifact
# produced by scripts/deploy-build.js (which runs as part of publishing).
# In dev mode the Express server (server/index.ts) proxies everything to
# Metro on 8081, so fresh code is served automatically — no rebuild needed.
#
# Rebuilding dist/ here used to cause the public preview port (5000) to
# serve a stale prebuilt bundle, hiding code changes. See task #68.

echo "Post-merge: nothing to do (dist/ is production-only; dev serves from Metro)"
