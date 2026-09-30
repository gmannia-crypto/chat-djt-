---
name: Sandbox preview verification
description: How to check mockup-sandbox previews in this multi-artifact Expo workspace.
---

The built-in app-preview screenshot targets the main Expo preview, not the isolated mockup artifact. An iframe URL under the sandbox's routed preview path can work in the canvas while app-preview screenshots of the same path fail. A one-shot headless Chromium capture with a virtual-time budget may also show a blank root because the sandbox loads its preview component asynchronously. Use a browser automation session that waits for the rendered component before capturing it, and verify the sandbox's own workflow and browser errors.

**Why:** Direct HTML requests to preview routes succeeded even though the first two screenshot methods failed. Waiting for the lazy React component showed the actual page and caught interaction errors.

**How to apply:** When checking a sandbox artifact, use its routed development-domain URL and wait for a component element after navigation; do not diagnose a white screenshot alone as a broken mockup. If the managed sandbox workflow fails immediately with a missing build tool, check whether its dependency installation completed before debugging component code.