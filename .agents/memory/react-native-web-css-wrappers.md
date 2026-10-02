---
name: React Native Web prop forwarding
description: Verify DOM forwarding for scoped themes, motion, and accessibility states.
---

Use actual DOM wrappers in web-only components when CSS selectors depend on custom classes or `data-*` attributes; do not assume React Native Web's View or Image forwards them.

**Why:** Browser inspection showed the RN wrappers stripping the supplied class names and theme attribute. Theme state saved correctly, but scoped Classic rules never matched and animation continued.

**How to apply:** Check the rendered DOM and computed styles, not just source props. Keep native components in the native implementation. A DOM wrapper around an RN Image can preserve CSS targeting while allowing RN to resolve bundled assets.

Verify native asset-resolution APIs before calling them in web code: the installed RN Web Image did not expose `resolveAssetSource`.

**Why:** A module-level call caused an import-time crash even though the API is familiar from native RN.

**How to apply:** Prefer the existing working RN Image asset path inside a DOM wrapper unless a supported web resolver has been verified.

The installed React Native Web does not translate the nested `accessibilityState` object into DOM state attributes. Use supported `aria-*` aliases as well as native accessibility state for checked, expanded, disabled, and busy controls.

**Why:** Browser tests found missing checked/expanded attributes despite correct visual selection. The installed DOM-prop mapper accepts individual ARIA aliases, not the nested native state object.

**How to apply:** Verify attributes on the actual interactive element rather than its surrounding test-ID container. Use checked state for radios; do not use selected state as a substitute.