import { describe, expect, it } from 'vitest'
import { applyMove, createGame, legalMoves, mulberry32, publicHash, rowOrdered } from '../src/engine'
import type { GameState, Move } from '../src/engine'
import { makeConfig } from './helpers'

/**
 * Random playouts: the game always terminates, the turn holder always has a
 * legal move, the log replays identically, tiles are conserved, and every
 * rack keeps the RL-1 ordering invariant.
 */

function conservation(state: GameState): number {
  return (
    state.pool.length +
    (state.drawn ? 1 : 0) +
    state.players.reduce((n, p) => n + p.row.length, 0)
  )
}

describe('random playouts', () => {
  for (const playerCount of [2, 3, 4] as const) {
    for (const jokers of [false, true]) {
      for (const seed of [1, 2, 3]) {
        const tiles = jokers ? 26 : 24
        it(`${playerCount}P${jokers ? '+jokers' : ''} seed ${seed}: terminates, stays legal, replays, conserves tiles`, () => {
          const cfg = makeConfig(playerCount, seed * 1000 + playerCount, 0, jokers)
          const rng = mulberry32(seed)
          let state = createGame(cfg)
          const log: { actor: number; move: Move }[] = []
          // every turn consumes a pool tile or reveals ≥1; guesses are the slack
          const maxSteps = 800

          let steps = 0
          while (!state.result) {
            expect(steps++).toBeLessThan(maxSteps)
            const moves = legalMoves(state, state.turn)
            expect(moves.length).toBeGreaterThan(0)
            const move = moves[Math.floor(rng() * moves.length)]
            log.push({ actor: state.turn, move })
            state = applyMove(state, state.turn, move)

            expect(conservation(state)).toBe(tiles)
            for (const p of state.players) {
              expect(rowOrdered(p.row)).toBe(true)
              expect(p.eliminated).toBe(p.row.every((t) => t.revealed))
            }
          }

          // exactly one seat still holds a hidden tile — the winner
          const winner = state.result!.winner
          expect(state.players[winner].eliminated).toBe(false)
          state.players.forEach((p, seat) => {
            if (seat !== winner) expect(p.eliminated).toBe(true)
          })

          // the log folds back to the identical state on a fresh client
          let replayed = createGame(cfg)
          for (const { actor, move } of log) replayed = applyMove(replayed, actor, move)
          expect(publicHash(replayed)).toBe(publicHash(state))
        })
      }
    }
  }
})
