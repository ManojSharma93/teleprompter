# Control panel live preview — design

## Problem

`control.html` already mounts a second `scroller` instance into `#preview`
([controller-view.js:125-126](../../../js/controller-view.js#L125-L126)) that
receives the exact same state object pushed to the paired phone/tablet. In
practice the box always looks empty, because `scroller.js`'s scroll-position
formula intentionally starts every script fully below the visible viewport
(`top: 100%`, `translateY(0)` at `position = 0`), so the first line only
enters the "reading zone" once playback begins — in sync with the on-device
countdown. That's correct for the real display, but it means the operator
gets no visual confirmation of script content, font size, margin, theme, or
mirroring without physically connecting and looking at the paired device.

## Goal

Make the existing preview panel show readable content immediately when a
script is loaded, without touching the real display's scroll timing/sync
behavior (used by `display.html` / `js/display-view.js`).

## Approach

Add an optional `mode` parameter to `createScroller(opts)` in
[js/scroller.js](../../../js/scroller.js):

- `createScroller()` (no opts, or `mode: 'display'`) — unchanged behavior,
  used by `display-view.js`. Text starts hidden below the fold at
  `position = 0`.
- `createScroller({ mode: 'preview' })` — used only by the second scroller
  instance in `controller-view.js`. Changes `updateScrollPosition()`'s
  offset formula so that at `position = 0` the top of the script is visible
  at the top of the viewport, and scroll distance is
  `max(0, textEl.scrollHeight - viewport.clientHeight)` instead of
  `textEl.scrollHeight + viewport.clientHeight`. Playback/scrub still moves
  this preview in the same proportional position as the real device, so it
  continues to double as a confidence monitor while presenting — it just
  no longer starts blank.

No other part of `setState` (theme, font size, line height, margin, mirror,
countdown overlay) changes — the preview already reflects all of those
correctly once text is visible.

### UI

Add a small label above `.preview-frame` in `control.html`, e.g. "Live
preview (this device)", so it reads as an intentional feature rather than an
empty box. Plain text, matches existing `.muted` style used elsewhere in the
toolbar.

## Out of scope (tracked separately, not part of this change)

- QR pairing flicker/reliability on tablets
- Arrow-key scroll controls
- Any other new-feature suggestions

## Testing

- Extend `js/scroller.test.js` with a case: `createScroller({ mode:
  'preview' })`, call `setState` with a non-empty script at `position: 0`,
  assert the resulting `translateY` offset is `0` (text visible at top),
  vs. the existing default-mode case which should remain unchanged
  (text offset equals `-(scrollHeight + viewportHeight) * 0`... i.e. still
  fully below fold at position 0 — this already exists as prior behavior
  and should not regress).
- Manual check: load a script in `control.html`, confirm text appears in
  the preview box at rest, confirm it still scrolls in sync during
  Play/scrub, confirm theme/font/margin/mirror controls affect it live.
