# Davinci Code — Art Bible: "The Classified Dossier"

Every visual decision checks against this page. If a screen doesn't look like a
cold-war case file open on a steel desk — manila folders, typewritten pages,
redaction bars, one angry rubber stamp — it isn't done.

## Mood

An intelligence analyst's desk circa 1962: buff folders, carbon-copy sheets,
punched index tabs, numbers hammered out on a manual typewriter, classified
material struck through with heavy black bars, and a crimson CLASSIFIED stamp
that someone pressed a little too hard. Austere, procedural, a little tense.
NOT: neon "hacker" green-on-black, glitch effects, digital rain, glassmorphism,
gradient-purple, emoji-flavored, movie-poster grunge.

## Surfaces

| Token | Value | Use |
|---|---|---|
| `--manila` | `#E7D7A9` | page background (the folder) |
| `--paper` | `#F5EDD8` | typed sheets: panels, cards, modals |
| `--manila-deep` | `#D8C68F` | wells, empty slots, insets |
| `--ink` | `#2B2620` | text, line work (typewriter carbon) |
| `--ink-soft` | `rgb(43 38 32 / .62)` | secondary text |
| `--line` | `rgb(43 38 32 / .26)` | hairlines, form rules, slot outlines |
| `--redact` | `#17130E` | redaction-bar black; BLACK tile bodies |
| `--tile-white` | `#F9F3E2` | WHITE tile bodies (aged paper, never #fff) |
| `--stamp` | `#A6382E` | the ONE accent: stamp ink crimson — focus, your-turn, legal targets, DECODED stamps |

Paper always carries the `--grain` turbulence overlay at low opacity. No pure
white anywhere; no pure black except `--redact`, which is reserved for redaction
bars and black tile bodies — that near-black IS the game's core signifier.
Stamp crimson is used like real stamp ink: pressed on in small, meaningful marks
(stamps, focus rings, the active seat's tab), never large fills.

## The tiles (load-bearing — the whole game is these 26 slips)

A tile is a cipher slip: a small index card standing in a rack. Two colors,
values 0–11 plus the dash joker.

| State | Treatment |
|---|---|
| black tile, face | `--redact` body, `--tile-white` typewriter numeral, hairline rim |
| white tile, face | `--tile-white` body, `--ink` typewriter numeral, hairline rim |
| hidden (opponent view) | color side shows; where the numeral would be, a solid redaction bar (black tiles get a paper-tone bar, white tiles an ink bar) |
| revealed | tile face up for everyone + DECODED stamp: `--stamp`, stencil face, struck at a −6° angle, slight overprint bleed; body dims to 82% |
| joker face | an em-dash struck over a small ⌀ watermark — typed, not drawn |

Tiles are never color-only: black/white is redundantly encoded by the numeral
ink swapping (paper-on-black vs ink-on-paper), so every state reads in grayscale.

## Line

Carbon-ink line `#2B2620`, 1.5–2px. Form rules under headings — straight, thin,
bureaucratic (this file's lines are ruled with a straightedge, not wobbled; the
`wobble.ts` helper is retired for this game). Dotted leader lines connect labels
to values on form-styled panels. Nothing hand-drawn: the desk is typed, stamped,
and machine-ruled.

## Type

- **Saira Stencil One**: display. Stamps, the title marquee, the turn banner,
  DECODED/ELIMINATED/CASE CLOSED. All-caps always, tracked wide. Never body text.
- **Courier Prime**: the typewriter voice — body text, rules prose, and every
  numeral on every tile. Numerals always tabular. Bold for tile faces.
- **Archivo Narrow**: small UI labels, buttons, form captions — the pre-printed
  government-form voice, set in caps with letter-spacing.
- Field labels follow form convention: `SUBJECT:`, `ROOM:`, `PLAYERS:` in
  Archivo Narrow caps, values typed in Courier Prime.

## Shape & depth

- One radius: `2px` — index cards are nearly square-cut.
- Shadows: single soft umbra `0 2px 6px rgb(43 38 32 / .20)`; never glows.
- Stamped marks (DECODED, seals, the turn chip) get 92% opacity + 0.5px blur on
  one edge to read as hand-pressed ink, and always sit at a slight angle (−8°…−4°).
- Paper-clip and punched-hole details are allowed as SVG line work on panels,
  sparingly (one per screen at most). No image binaries.

## The table

- Your rack sits at the bottom of the desk: full faces visible, standing slips.
- Opponents' racks fan along the top edge as folder tabs, redacted slips showing
  color only; the active target slip lifts 2px on hover/focus.
- The draw pool is a face-down stack of slips banded with a paper strap showing
  the count, typed: `REMAINING: 07`.
- The drawn tile waits in an evidence tray beside your rack, visible only to you,
  with a typed caption `IN HAND — DO NOT FILE`.
- Legal guess targets take a `--stamp` 2px outline + 8% crimson wash — never a glow.
- Legal insertion gaps open as ruled slots with a crimson caret beneath.

## Motion

- The drawn tile SLIDES from the pool to the tray (220ms, settle easing) like a
  carriage return; filing a tile into the rack shunts neighbors aside in one motion.
- A reveal FLIPS the tile (rotateY, 260ms) and then strikes the DECODED stamp
  (60ms scale-in with 1px overshoot) — flip first, stamp second, never together.
- A wrong guess shakes the guesser's drawn tile once (±3px, 120ms) before the
  forced face-up filing.
- Elimination closes the player's tab with a struck-through name. Nothing floats
  or pulses idly. All durations through `dur()`; reduced-motion collapses to 0.

## Sound

WebAudio only (audio.ts): typewriter clack for tile placement, a dry stamp thunk
for reveals, paper slide for draws, a single teletype bell for victory. Quiet by
default; mute persists.

## Anti-slop checklist (gate every screen against this)

- [ ] no gradients-as-decoration, no glassmorphism, no purple, no "hacker" green
- [ ] no emoji anywhere in UI
- [ ] no Inter/system-ui; only the three faces above
- [ ] one radius scale (2px); no mixed rounding
- [ ] crimson focus ring (`2px solid var(--stamp)` offset 2) on every focusable
- [ ] empty states designed (empty rack slots ruled, "awaiting transmission…" typed prose), never spinners alone
- [ ] paper grain present; no flat #fff panels
- [ ] every color from the tables above; nothing sampled ad hoc
- [ ] stencil display face all-caps only, never below 16px, never for sentences
- [ ] black/white tile state never encoded by color alone
