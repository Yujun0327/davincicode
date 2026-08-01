import type { RowTile } from '../engine'
import { HIDDEN_VALUE } from '../engine'

/** Dev-only fixtures for the #gallery route. */

const t = (
  color: RowTile['color'],
  value: RowTile['value'],
  revealed = false,
): RowTile => ({ color, value, revealed })

/** An own rack mid-game: sealed faces, one decoded, a joker. */
export const ownRack: RowTile[] = [
  t('black', 0),
  t('white', 3),
  t('black', 5, true),
  t('white', 'joker'),
  t('black', 9),
  t('white', 11),
]

/** The same rack as an opponent sees it (redacted). */
export const opponentRack: RowTile[] = ownRack.map((tile) =>
  tile.revealed ? tile : { ...tile, value: HIDDEN_VALUE },
)

/** A decoded (eliminated) rack — everything face-up. */
export const decodedRack: RowTile[] = [
  t('black', 2, true),
  t('white', 4, true),
  t('black', 'joker', true),
  t('white', 8, true),
]
