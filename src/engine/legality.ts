import { MAX_VALUE } from './types'
import type { GameState, Move, RowTile, Seat, Tile, TileValue } from './types'

/**
 * The RL-1 strict total order over numbered tiles: by value, black before
 * white on ties. Undefined for jokers — callers must branch on them first.
 */
export function rank(tile: Tile): number {
  if (tile.value === 'joker') throw new Error('jokers have no rank')
  return (tile.value as number) * 2 + (tile.color === 'white' ? 1 : 0)
}

/** Every claimable value: 0..11 or 'joker'. */
export function validClaim(claim: TileValue): boolean {
  return claim === 'joker' || (Number.isInteger(claim) && claim >= 0 && claim <= MAX_VALUE)
}

/** The rack ordering invariant (R3): numbered ranks strictly increase. */
export function rowOrdered(row: readonly Tile[]): boolean {
  let last = -1
  for (const t of row) {
    if (t.value === 'joker') continue
    const r = rank(t)
    if (r <= last) return false
    last = r
  }
  return true
}

/**
 * Every gap index (0..row.length) where filing `tile` keeps the rack
 * ordered. Unique for a numbered tile in a joker-free rack (RL-1); a
 * neighboring joker widens the choice, and a joker tile fits anywhere.
 */
export function legalInsertIndices(row: readonly RowTile[], tile: Tile): number[] {
  const out: number[] = []
  for (let i = 0; i <= row.length; i++) {
    if (tile.value === 'joker') {
      out.push(i)
      continue
    }
    const r = rank(tile)
    const leftOk = row.slice(0, i).every((t) => t.value === 'joker' || rank(t) < r)
    const rightOk = row.slice(i).every((t) => t.value === 'joker' || rank(t) > r)
    if (leftOk && rightOk) out.push(i)
  }
  return out
}

const ALL_CLAIMS: readonly TileValue[] = [...Array.from({ length: MAX_VALUE + 1 }, (_, v) => v), 'joker']

/**
 * Every legal move for `actor` in `state` — drives playout tests and UI
 * affordances. Claims enumerate all 13 values ('joker' included even in
 * jokerless games, where it is simply always wrong; the UI gates the key
 * on `cfg.jokers`).
 */
export function legalMoves(state: GameState, actor: Seat): Move[] {
  if (state.result || actor !== state.turn) return []
  const moves: Move[] = []

  switch (state.phase) {
    case 'draw': {
      for (const color of ['black', 'white'] as const) {
        if (state.pool.some((t) => t.color === color)) moves.push({ type: 'draw', color })
      }
      return moves
    }

    case 'guess': {
      for (let target = 0; target < state.players.length; target++) {
        if (target === actor || state.players[target].eliminated) continue
        state.players[target].row.forEach((tile, index) => {
          if (tile.revealed) return
          for (const claim of ALL_CLAIMS) moves.push({ type: 'guess', target, index, claim })
        })
      }
      if (state.mayStop) {
        if (state.drawn && !state.drawnFaceUp) {
          for (const index of legalInsertIndices(state.players[actor].row, state.drawn)) {
            moves.push({ type: 'insert', index })
          }
        } else if (!state.drawn) {
          moves.push({ type: 'stop' })
        }
      }
      return moves
    }

    case 'insert': {
      for (const index of legalInsertIndices(state.players[actor].row, state.drawn!)) {
        moves.push({ type: 'insert', index })
      }
      return moves
    }

    case 'reveal': {
      state.players[actor].row.forEach((tile, index) => {
        if (!tile.revealed) moves.push({ type: 'reveal', index })
      })
      return moves
    }
  }
}
