import { createGame } from '../src/engine'
import type { GameConfig, GameState } from '../src/engine'

export function makeConfig(
  playerCount: 2 | 3 | 4,
  sharedSeed = 42,
  startingSeat = 0,
  jokers = false,
): GameConfig {
  return {
    playerCount,
    sharedSeed,
    startingSeat,
    names: Array.from({ length: playerCount }, (_, i) => `P${i}`),
    jokers,
    rulesVersion: '1',
  }
}

export function newGame(playerCount: 2 | 3 | 4, seed = 42, jokers = false): GameState {
  return createGame(makeConfig(playerCount, seed, 0, jokers))
}
