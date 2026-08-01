# Davinci Code

A fan-made web implementation of the deduction game **Da Vinci Code / Coda**
for playing with friends. No accounts, no servers: share a six-letter room code
and play peer-to-peer, or pass one device around the table.

Private, non-commercial fan project. All artwork is original ("The Classified
Dossier" — see `src/assets/art-bible.md`). If you enjoy the game, buy a copy of
the real thing.

## Play

- **Hotseat** — 2–4 players on one device, with a pass-the-device peek shield
  between turns.
- **Online** — the host opens a room and shares the invite link (`#room=CODE`).
  Multiplayer runs peer-to-peer over WebRTC (Trystero, Nostr signaling); the static
  site can be hosted anywhere (Netlify config included).

Every tile is a cipher slip, 0–11 in black and white (plus two dash jokers, a
lobby option), standing hidden in ascending racks. Draw a tile, point at an
enemy tile and name it: right flips it face-up and you may press on; wrong files
your drawn tile face-up for everyone to read. Last agent holding a sealed tile
wins.

## Development

```sh
npm install
npm run dev        # dev server; #gallery renders every component, #demo seats a game
npm test           # vitest: engine, playouts, session mesh, UI click-throughs
npm run check      # svelte-check + tsc
npm run build      # static build in dist/
```

## Architecture

- `src/engine/` — pure, headless rules: one `applyMove` reducer over a JSON
  `GameState` running the draw → guess → (continue | stop | forced-file |
  forced-reveal) turn machine, `legalMoves` enumeration (the UI renders only
  legal moves), and seeded deterministic setup so every client derives the
  identical deal from one shared config. `legalInsertIndices` pins the RL-1
  ordering; filing choices ride on the move itself, so the reducer stays
  choice-free and log-replayable.
- `src/data/` — the tile set builder (24 numbered slips + optional jokers).
- `src/transport/` — a small `Transport` interface over Trystero with pinned Nostr
  relays and a TURN fallback.
- `src/app/` — sessions. Hotseat plays every seat locally behind the peek shield.
  Online uses **turn-holder sequencing**: Davinci Code never has concurrent
  decisions, so the acting client stamps the next sequence number and broadcasts;
  every peer folds the same move log into the same state and verifies a full-state
  hash after each move (desync tripwire). Reconnects replay a localStorage log,
  then longer-log-wins resync.
- `src/ui/` — Svelte 5 components on a token-driven design system; all art is
  runtime-generated SVG/CSS, zero image binaries.
- `docs/RULES.md` — the numbered rules spec the engine implements; every fact has a
  test. Ambiguities are pinned in `rulings.md` (RL-1..RL-8), never resolved
  silently in code.

### Known limitations

- **Hidden hands are an honor system.** The whole deal derives from the shared
  seed, so every client technically holds every tile value; the UI redacts what
  the viewer shouldn't see (`engine/view.ts`), but a determined player could read
  opponents' racks with devtools. True cryptographic privacy over a shared pool
  needs mental-poker machinery this no-backend design deliberately skips — fine
  among friends.
- Jokers dealt in the opening hand auto-place rightmost (RL-7) instead of
  offering a free placement choice; the pre-game `arrange` move is the first
  post-1.0 candidate.
- If every player closes their browser, the room's game survives only in their
  localStorage logs — any one returning player restores it for everyone.
