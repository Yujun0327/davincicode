import { buildPool } from '../data'
import { rank } from './legality'
import { mulberry32, seededShuffle } from './rng'
import { handSize } from './types'
import type { GameConfig, GameState, RowTile, Tile } from './types'

/**
 * Deterministic: the same config produces the identical state on every
 * client (the pool shuffle and the seat-order deal flow from one seeded
 * rng; never reorder these calls), which is what makes log replay and
 * resync work — and what makes hidden hands an honor system (README).
 */
export function createGame(cfg: GameConfig): GameState {
  const rng = mulberry32(cfg.sharedSeed)
  const pool = seededShuffle(buildPool(cfg.jokers), rng)

  const n = handSize(cfg.playerCount)
  const players = Array.from({ length: cfg.playerCount }, () => ({
    row: sortHand(pool.splice(pool.length - n, n)),
    eliminated: false,
  }))

  return {
    players,
    pool,
    turn: cfg.startingSeat,
    startingSeat: cfg.startingSeat,
    phase: 'draw', // the pool is never empty after the deal (worst case 24−12=12 tiles left)
    drawn: null,
    drawnFaceUp: false,
    mayStop: false,
    lastGuess: null,
    result: null,
  }
}

/** Opening rack: numbered tiles in RL-1 order, jokers rightmost (RL-7). */
function sortHand(hand: Tile[]): RowTile[] {
  const numbered = hand.filter((t) => t.value !== 'joker').sort((a, b) => rank(a) - rank(b))
  const jokers = hand.filter((t) => t.value === 'joker')
  return [...numbered, ...jokers].map((t) => ({ ...t, revealed: false }))
}
