# Davinci Code — Rules Specification (ground truth for the engine)

The deduction game of hidden ascending ciphers, for 2–4 players. This document is
the implementation spec; ambiguities are decided in `../rulings.md` (RL-n), never
resolved silently in code, and every numbered fact here is encoded as at least one
test.

## 1. Components

- 24 numbered tiles: values **0–11**, one of each value in **black** and **white**.
- 2 joker tiles (the "dash" tiles): one black, one white, no number. Included only
  when the lobby's **jokers** option is on (`cfg.jokers`).

A tile's color is always public (tile backs are colored). A tile's value is hidden
until revealed.

## 2. Setup

1. All tiles form a face-down, shuffled **pool** (seeded by `cfg.sharedSeed`).
2. Each player draws their opening rack: **4 tiles** in a 2–3 player game,
   **3 tiles** in a 4 player game.
3. Each rack stands hidden from opponents, ordered ascending **left to right from
   the owner's perspective**:
   - lower numbers left of higher numbers;
   - equal numbers: black left of white (RL-1);
   - opening jokers auto-place rightmost (RL-7).
4. The starting seat is derived from the seed (RL-5).

## 3. Rack ordering invariant

At all times every rack is a legal ascending sequence: for any two numbered tiles
at positions i < j, tile_i precedes tile_j under the RL-1 order (by value, then
black before white). Jokers are unordered wildcards: once placed they **never
move** and impose no constraint on their neighbors.

## 4. Turn structure

On your turn:

1. **Draw** — if the pool is non-empty, draw one tile and look at it privately.
   It stays "in hand" (not yet in your rack). If the pool is empty, skip to
   guessing.
2. **Guess** — you must guess at least once: point at any one **hidden** tile in
   an opponent's rack (RL-2, RL-3) and claim its value: a number 0–11 or "joker".
3. **Resolution**:
   - **Correct** → the owner flips that tile face-up in place. You choose:
     - **continue** — guess again (any opponent, any hidden tile), or
     - **stop** — end your guessing; file your in-hand tile **face-down** into
       your rack at its legal position. With the pool empty there is nothing to
       file — stopping just ends your turn (RL-4).
   - **Wrong** →
     - with a tile in hand: file it into your rack **face-up** at its legal
       position; turn ends.
     - with the pool empty: flip one of your **own** hidden tiles, your choice
       (RL-4); turn ends.

Filing position is forced by the ordering invariant; when a joker makes multiple
positions legal (or the filed tile is itself a joker), the filer picks among the
legal gaps (`legalInsertIndices` in `src/engine/apply.ts`).

## 5. Elimination and victory

- A player with zero hidden tiles is **eliminated** immediately, whenever that
  occurs (RL-6, RL-8). Their rack stays face-up on the table; their seat is
  skipped; they cannot be targeted.
- **Last seat holding at least one hidden tile wins.** This can trigger mid-turn
  (RL-8), including by self-elimination on a pool-empty forced reveal.

## 6. Public information summary

Public: every tile's color and position, which tiles are revealed (and their
values), the pool count, whether the current player holds a drawn tile, all
guesses and their outcomes. Private: values of hidden rack tiles (to everyone but
the owner) and of the in-hand tile (to everyone but the holder).

> Implementation note: this build syncs full state to every client and hides
> values in the UI only (honor system) — see README Known limitations.
