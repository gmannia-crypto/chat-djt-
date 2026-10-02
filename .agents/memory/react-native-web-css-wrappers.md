---
name: React Native Web CSS wrappers
description: Verify DOM attribute forwarding before relying on scoped web theme or animation selectors.
---

Use actual DOM wrappers in web-only components when CSS selectors depend on custom classes or `data-*` attributes; do not assume React Native Web's View or Image forwards them.

**Why:** Browser inspection showed the RN wrappers stripping the supplied class names and theme attribute. Theme state saved correctly, but scoped Classic rules never matched and animation continued.

**How to apply:** Check the rendered DOM and computed styles, not just source props. Keep native components in the native implementation. A DOM wrapper around an RN Image can preserve CSS targeting while allowing RN to resolve bundled assets.

Verify native asset-resolution APIs before calling them in web code: the installed RN Web Image did not expose `resolveAssetSource`.

**Why:** A module-level call caused an import-time crash even though the API is familiar from native RN.

**How to apply:** Prefer the existing working RN Image asset path inside a DOM wrapper unless a supported web resolver has been verified.