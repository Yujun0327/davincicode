import type { Move, Seat, TileValue } from '../engine'

/**
 * Guess-flow selection: tap an opponent's hidden tile (picker opens) →
 * name a value (guess dispatches). Filing enters `filing` mode, where the
 * own rack shows its legal gaps. Pure functions, zero DOM coupling.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'picking'; target: Seat; index: number }
  | { kind: 'filing' }

export const NO_SELECTION: Selection = { kind: 'none' }

/** Opponent tiles the actor may target right now, from the legal-move list. */
export function targetTiles(moves: readonly Move[]): { target: Seat; index: number }[] {
  const seen = new Set<string>()
  const out: { target: Seat; index: number }[] = []
  for (const m of moves) {
    if (m.type !== 'guess') continue
    const key = `${m.target}:${m.index}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ target: m.target, index: m.index })
  }
  return out
}

/** The dispatchable guess for the picked tile and claim, if legal. */
export function claimMove(sel: Selection, claim: TileValue, moves: readonly Move[]): Move | null {
  if (sel.kind !== 'picking') return null
  return (
    moves.find(
      (m) =>
        m.type === 'guess' && m.target === sel.target && m.index === sel.index && m.claim === claim,
    ) ?? null
  )
}

/** Gap indices of the own rack where the in-hand tile may file. */
export function fileGaps(moves: readonly Move[]): number[] {
  return moves.flatMap((m) => (m.type === 'insert' ? [m.index] : []))
}

/** Own-rack tile indices that may be flipped on a pool-empty penalty. */
export function revealChoices(moves: readonly Move[]): number[] {
  return moves.flatMap((m) => (m.type === 'reveal' ? [m.index] : []))
}
