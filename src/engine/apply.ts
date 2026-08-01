import { deepClone } from './clone'
import { legalInsertIndices, validClaim } from './legality'
import type { GameState, Move, Seat } from './types'

/**
 * The single pure reducer. Throws on any illegal move; never mutates `prev`.
 * Every branch depends only on the state and the move itself, so all clients
 * fold the same move log into the identical state.
 */
export function applyMove(prev: GameState, actor: Seat, move: Move): GameState {
  if (prev.result) throw new Error('game is over')
  if (actor !== prev.turn) throw new Error('not your turn')

  const state = deepClone(prev)
  const player = state.players[actor]

  switch (move.type) {
    case 'draw': {
      if (state.phase !== 'draw') throw new Error('not in draw phase')
      // the pool is face-down but colors are public: the drawer picks a
      // color and takes that color's topmost tile
      const at = state.pool.map((t) => t.color).lastIndexOf(move.color)
      if (at < 0) throw new Error('no tiles of that color left')
      state.drawn = state.pool.splice(at, 1)[0]
      state.phase = 'guess'
      return state
    }

    case 'guess': {
      if (state.phase !== 'guess') throw new Error('no guess owed')
      if (move.target === actor) throw new Error('cannot guess your own rack') // RL-3
      const target = state.players[move.target]
      if (!target) throw new Error('no such seat')
      if (target.eliminated) throw new Error('target is eliminated') // RL-6
      const tile = target.row[move.index]
      if (!tile) throw new Error('no such tile')
      if (tile.revealed) throw new Error('tile already revealed')
      if (!validClaim(move.claim)) throw new Error('invalid claim')

      const correct = tile.value === move.claim
      state.lastGuess = { actor, target: move.target, index: move.index, claim: move.claim, correct }

      if (correct) {
        tile.revealed = true
        state.mayStop = true
        checkOutcome(state) // target may fall, actor may win mid-turn (RL-8)
        return state // phase stays 'guess': continue, or insert/stop via mayStop
      }
      if (state.drawn) {
        state.drawnFaceUp = true
        state.phase = 'insert'
      } else {
        state.phase = 'reveal' // pool-empty penalty (RL-4)
      }
      return state
    }

    case 'insert': {
      const voluntary = state.phase === 'guess'
      if (!voluntary && state.phase !== 'insert') throw new Error('nothing to file')
      if (!state.drawn) throw new Error('no tile in hand')
      if (voluntary && (!state.mayStop || state.drawnFaceUp)) throw new Error('may not stop yet')
      if (!legalInsertIndices(player.row, state.drawn).includes(move.index)) {
        throw new Error('illegal filing position')
      }
      player.row.splice(move.index, 0, { ...state.drawn, revealed: !voluntary })
      state.drawn = null
      state.drawnFaceUp = false
      advanceTurn(state)
      return state
    }

    case 'stop': {
      if (state.phase !== 'guess' || !state.mayStop) throw new Error('may not stop')
      if (state.drawn) throw new Error('file the tile in hand instead')
      advanceTurn(state)
      return state
    }

    case 'reveal': {
      if (state.phase !== 'reveal') throw new Error('no reveal owed')
      const tile = player.row[move.index]
      if (!tile || tile.revealed) throw new Error('not a hidden tile of yours')
      tile.revealed = true
      checkOutcome(state) // self-elimination can end the game (RL-8)
      advanceTurn(state)
      return state
    }
  }
}

/** Eliminate any fully revealed rack; last seat with a hidden tile wins. */
function checkOutcome(state: GameState): void {
  for (const p of state.players) {
    if (!p.eliminated && p.row.every((t) => t.revealed)) p.eliminated = true
  }
  const alive = state.players.flatMap((p, seat) => (p.eliminated ? [] : [seat]))
  if (alive.length === 1) state.result = { winner: alive[0] }
}

function advanceTurn(state: GameState): void {
  state.drawn = null
  state.drawnFaceUp = false
  state.mayStop = false
  if (state.result) return
  do {
    state.turn = (state.turn + 1) % state.players.length
  } while (state.players[state.turn].eliminated)
  state.phase = state.pool.length ? 'draw' : 'guess'
}
