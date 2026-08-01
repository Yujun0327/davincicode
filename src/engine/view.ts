import { deepClone } from './clone'
import { HIDDEN_VALUE } from './types'
import type { GameState, Seat } from './types'

/**
 * The viewer's redacted picture of the table: hidden values of other racks,
 * of the pool, and of another actor's in-hand tile become HIDDEN_VALUE.
 * Colors, positions, revealed faces, counts and the last guess stay public.
 *
 * Display-only privacy (honor system): every client still derives the full
 * state from the shared seed, and `publicHash` covers all of it — see
 * README Known limitations.
 */
export function redact(state: GameState, viewer: Seat | null): GameState {
  const view = deepClone(state)
  view.players.forEach((p, seat) => {
    if (seat === viewer) return
    for (const t of p.row) if (!t.revealed) t.value = HIDDEN_VALUE
  })
  for (const t of view.pool) t.value = HIDDEN_VALUE
  if (view.drawn && viewer !== view.turn) view.drawn.value = HIDDEN_VALUE
  return view
}
