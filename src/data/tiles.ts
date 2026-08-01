import { COLORS, MAX_VALUE } from '../engine/types'
import type { Tile } from '../engine/types'

/**
 * The canonical unshuffled tile set: 0..11 in black and white (24), plus
 * the two dash jokers when the lobby option is on. Order matters — the
 * seeded shuffle in `createGame` starts from exactly this list.
 */
export function buildPool(jokers: boolean): Tile[] {
  const tiles: Tile[] = []
  for (const color of COLORS) {
    for (let value = 0; value <= MAX_VALUE; value++) tiles.push({ color, value })
  }
  if (jokers) for (const color of COLORS) tiles.push({ color, value: 'joker' })
  return tiles
}
