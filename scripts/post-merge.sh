#!/bin/bash
#
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

# ── Persona image manifest check ────────────────────────────────────────────
#
# Run the integrity check so contributors are reminded to update the manifest
# when a new persona portrait is added or an existing one is replaced.
# This does NOT block the merge — it only prints a warning.

echo ""
echo "🔍 Checking persona images against manifest..."
node scripts/check-persona-images.js
CHECK_EXIT=$?

if [ $CHECK_EXIT -ne 0 ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║  ⚠  PERSONA MANIFEST OUT OF DATE — action required                  ║"
  echo "╠══════════════════════════════════════════════════════════════════════╣"
  echo "║  One or more persona portraits were added or changed without         ║"
  echo "║  updating the manifest. Until the manifest is refreshed, the         ║"
  echo "║  pre-commit hook will block every subsequent commit.                 ║"
  echo "║                                                                      ║"
  echo "║  Run these two commands and commit the result:                       ║"
  echo "║                                                                      ║"
  echo "║    node scripts/check-persona-images.js --update                    ║"
  echo "║    git add scripts/persona-image-manifest.json                      ║"
  echo "║    git commit -m 'chore: update persona image manifest'             ║"
  echo "║                                                                      ║"
  echo "║  (Emergency bypass: git commit --no-verify — use sparingly)         ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo ""
fi

# Always exit 0 — post-merge is advisory only; it must not abort the merge.
exit 0
