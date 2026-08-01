# Rulings

Every rules ambiguity gets pinned here with a decision and a test. If a real-game
dispute finds a better answer, change the ruling here first, then the code, then bump
`rulesVersion`.

## RL-1 — Tie-break: black beats white to the left
Two tiles of equal number are ordered **black to the left of white** — black is
treated as strictly smaller. Together with the unique numbers per color this makes
the order over the 24 numbered tiles a strict total order: every numbered tile has
exactly one legal position in a rack without jokers. Test: `engine.test.ts`
("RL-1").

## RL-2 — Jokers are legal targets
An opponent's hidden joker may be targeted like any tile, and the claim `'joker'`
is a legal guess (the number pad offers `–`). Guessing a number against a joker is
simply wrong; guessing `'joker'` against a numbered tile is simply wrong. Test:
"RL-2".

## RL-3 — You may not guess your own tiles
A guess must target an opponent's hidden tile. Targeting your own rack, a revealed
tile, or an eliminated player's rack is illegal (eliminated racks stay on the table
per RL-6 but are inert). Test: "RL-3".

## RL-4 — Continuing after the pool is empty
A correct guess always offers the continue-or-stop choice, including when the pool
is empty (there is then no tile to file on stopping — `stop` simply ends the turn).
An incorrect guess with an empty pool forces the guesser to reveal one of their own
hidden tiles, of their choice (`reveal` move). Test: "RL-4".

## RL-5 — First player is seed-derived
The starting seat comes deterministically from `sharedSeed` (`cfg.startingSeat`,
computed at lobby start). No first-player auction, no host advantage. Test: "RL-5".

## RL-6 — Eliminated players
A player whose tiles are all revealed is eliminated immediately. Their rack stays
face-up on the table (public deduction information), their seat is skipped in turn
order, and they may not be targeted. Test: "RL-6".

## RL-7 — Jokers dealt in the opening hand sit rightmost
The physical game lets you place an initially dealt joker anywhere. To keep setup
deterministic and moveless (the whole deal derives from `sharedSeed`), an opening
joker is auto-placed at the **right end** of the rack (rightmost = highest; two
jokers keep their dealt order). This is the weakest ruling in the file — the
placement choice has real strategic value — and is the first candidate for a
pre-game `arrange` move after 1.0. Test: "RL-7".

## RL-8 — Mid-turn elimination and instant victory
Revealing a target's last hidden tile eliminates them at that moment, mid-turn. If
that elimination leaves the guesser as the only seat with a hidden tile, the game
ends immediately — the pending drawn tile is never filed. Self-elimination is also
possible: a pool-empty wrong guess forces `reveal`, and flipping your own last
hidden tile eliminates you — the win then goes to the last seat holding a hidden
tile (checked after every reveal, whoever caused it). A forced face-up filing can
never self-eliminate (it adds a revealed tile without flipping hidden ones, and a
live player always has ≥1 hidden tile at turn start). Test: "RL-8" + playout
invariants.
