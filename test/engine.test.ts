import { describe, expect, it } from 'vitest'
import {
  applyMove,
  createGame,
  handSize,
  HIDDEN_VALUE,
  legalInsertIndices,
  legalMoves,
  publicHash,
  rank,
  redact,
  rowOrdered,
} from '../src/engine'
import type { GameState, PlayerState, RowTile, TileColor, TileValue } from '../src/engine'
import { makeConfig, newGame } from './helpers'

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

function rt(color: TileColor, value: TileValue, revealed = false): RowTile {
  return { color, value, revealed }
}

function player(row: RowTile[], eliminated = false): PlayerState {
  return { row, eliminated }
}

/** A minimal hand-built 2P state for reducer edge cases. */
function fixture(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [
      player([rt('black', 1), rt('white', 4), rt('black', 7), rt('white', 9)]),
      player([rt('black', 2), rt('white', 5), rt('black', 8), rt('white', 11)]),
    ],
    pool: [
      { color: 'white', value: 0 },
      { color: 'black', value: 3 },
    ],
    turn: 0,
    startingSeat: 0,
    phase: 'draw',
    drawn: null,
    drawnFaceUp: false,
    mayStop: false,
    lastGuess: null,
    result: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */

describe('setup', () => {
  it('is deterministic per seed and differs across seeds', () => {
    expect(publicHash(newGame(3, 7))).toBe(publicHash(newGame(3, 7)))
    expect(publicHash(newGame(3, 7))).not.toBe(publicHash(newGame(3, 8)))
  })

  it('deals 4 tiles for 2–3 players, 3 for 4 players, rest to the pool', () => {
    for (const [count, hand] of [
      [2, 4],
      [3, 4],
      [4, 3],
    ] as const) {
      expect(handSize(count)).toBe(hand)
      const plain = newGame(count, 5)
      expect(plain.players).toHaveLength(count)
      for (const p of plain.players) expect(p.row).toHaveLength(hand)
      expect(plain.pool).toHaveLength(24 - count * hand)
      expect(newGame(count, 5, true).pool).toHaveLength(26 - count * hand)
    }
  })

  it('starts in the draw phase with no result and every tile hidden', () => {
    const state = newGame(2, 9)
    expect(state.phase).toBe('draw')
    expect(state.result).toBeNull()
    for (const p of state.players) for (const t of p.row) expect(t.revealed).toBe(false)
  })

  it('RL-5: the starting seat comes from the config', () => {
    const state = createGame(makeConfig(3, 42, 2))
    expect(state.turn).toBe(2)
    expect(state.startingSeat).toBe(2)
  })

  it('RL-7: opening racks are ordered, jokers rightmost, across many seeds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const p of newGame(3, seed, true).players) {
        expect(rowOrdered(p.row)).toBe(true)
        const firstJoker = p.row.findIndex((t) => t.value === 'joker')
        if (firstJoker >= 0) {
          for (const t of p.row.slice(firstJoker)) expect(t.value).toBe('joker')
        }
      }
    }
  })
})

describe('RL-1 ordering', () => {
  it('ranks black strictly below white on equal numbers', () => {
    expect(rank({ color: 'black', value: 5 })).toBeLessThan(rank({ color: 'white', value: 5 }))
    expect(rank({ color: 'white', value: 4 })).toBeLessThan(rank({ color: 'black', value: 5 }))
  })

  it('gives a numbered tile exactly one slot in a joker-free rack', () => {
    const row = fixture().players[0].row // b1 w4 b7 w9
    expect(legalInsertIndices(row, { color: 'white', value: 5 })).toEqual([2])
    expect(legalInsertIndices(row, { color: 'black', value: 0 })).toEqual([0])
    expect(legalInsertIndices(row, { color: 'black', value: 11 })).toEqual([4])
    // the tie-break itself: black 4 files LEFT of white 4, white 1 RIGHT of black 1
    expect(legalInsertIndices(row, { color: 'black', value: 4 })).toEqual([1])
    expect(legalInsertIndices(row, { color: 'white', value: 1 })).toEqual([1])
  })

  it('widens the choice next to a joker and lets a joker file anywhere', () => {
    const row = [rt('black', 3), rt('black', 'joker'), rt('white', 5)]
    expect(legalInsertIndices(row, { color: 'white', value: 4 })).toEqual([1, 2])
    expect(legalInsertIndices(row, { color: 'white', value: 'joker' })).toEqual([0, 1, 2, 3])
  })
})

describe('the turn machine', () => {
  it('draw takes the topmost tile of the chosen color and moves to guessing', () => {
    const state = applyMove(fixture(), 0, { type: 'draw', color: 'white' })
    expect(state.drawn).toEqual({ color: 'white', value: 0 })
    expect(state.pool).toEqual([{ color: 'black', value: 3 }])
    expect(state.phase).toBe('guess')
  })

  it('rejects drawing a color that ran out, guessing before drawing, and off-turn moves', () => {
    const onlyBlack = fixture({ pool: [{ color: 'black', value: 3 }] })
    expect(() => applyMove(onlyBlack, 0, { type: 'draw', color: 'white' })).toThrow(/no tiles/)
    expect(() =>
      applyMove(fixture(), 0, { type: 'guess', target: 1, index: 0, claim: 2 }),
    ).toThrow(/no guess/)
    expect(() => applyMove(fixture(), 1, { type: 'draw', color: 'black' })).toThrow(/not your turn/)
  })

  it('a wrong guess forces the drawn tile face-up into its slot and passes the turn', () => {
    let state = applyMove(fixture(), 0, { type: 'draw', color: 'black' }) // b3 in hand
    state = applyMove(state, 0, { type: 'guess', target: 1, index: 0, claim: 7 }) // b2 ≠ 7
    expect(state.lastGuess).toMatchObject({ correct: false, claim: 7 })
    expect(state.phase).toBe('insert')
    expect(state.drawnFaceUp).toBe(true)
    expect(legalMoves(state, 0)).toEqual([{ type: 'insert', index: 1 }]) // b1 < b3 < w4
    state = applyMove(state, 0, { type: 'insert', index: 1 })
    expect(state.players[0].row[1]).toEqual({ color: 'black', value: 3, revealed: true })
    expect(state.turn).toBe(1)
    expect(state.phase).toBe('draw')
    expect(state.drawn).toBeNull()
  })

  it('a correct guess reveals, then allows continuing or filing face-down', () => {
    let state = applyMove(fixture(), 0, { type: 'draw', color: 'black' })
    state = applyMove(state, 0, { type: 'guess', target: 1, index: 0, claim: 2 }) // b2 ✓
    expect(state.players[1].row[0].revealed).toBe(true)
    expect(state.phase).toBe('guess')
    expect(state.mayStop).toBe(true)
    // continue with a second correct guess…
    state = applyMove(state, 0, { type: 'guess', target: 1, index: 1, claim: 5 }) // w5 ✓
    expect(state.players[1].row[1].revealed).toBe(true)
    // …then stop by filing the in-hand tile face-DOWN
    state = applyMove(state, 0, { type: 'insert', index: 1 })
    expect(state.players[0].row[1]).toEqual({ color: 'black', value: 3, revealed: false })
    expect(state.turn).toBe(1)
  })

  it('rejects stopping without a correct guess and filing at an illegal slot', () => {
    let state = applyMove(fixture(), 0, { type: 'draw', color: 'black' })
    expect(() => applyMove(state, 0, { type: 'insert', index: 1 })).toThrow(/may not stop/)
    state = applyMove(state, 0, { type: 'guess', target: 1, index: 0, claim: 2 })
    expect(() => applyMove(state, 0, { type: 'insert', index: 0 })).toThrow(/illegal filing/)
    expect(() => applyMove(state, 0, { type: 'stop' })).toThrow(/file the tile/)
  })

  it('RL-2: jokers are guessable and "joker" is a claim like any other', () => {
    const withJoker = fixture()
    withJoker.players[1].row.push(rt('white', 'joker'))
    let state = applyMove(withJoker, 0, { type: 'draw', color: 'black' })
    state = applyMove(state, 0, { type: 'guess', target: 1, index: 4, claim: 'joker' })
    expect(state.players[1].row[4].revealed).toBe(true)
    // joker claimed against a numbered tile is simply wrong
    const miss = applyMove(state, 0, { type: 'guess', target: 1, index: 0, claim: 'joker' })
    expect(miss.lastGuess!.correct).toBe(false)
  })

  it('RL-3/RL-6: own racks, revealed tiles, and eliminated seats are untouchable', () => {
    const state = fixture({ phase: 'guess' })
    state.players[1].row[2].revealed = true
    expect(() => applyMove(state, 0, { type: 'guess', target: 0, index: 0, claim: 1 })).toThrow(
      /your own/,
    )
    expect(() => applyMove(state, 0, { type: 'guess', target: 1, index: 2, claim: 8 })).toThrow(
      /already revealed/,
    )
    expect(() => applyMove(state, 0, { type: 'guess', target: 1, index: 9, claim: 8 })).toThrow(
      /no such tile/,
    )
    const three = fixture({
      players: [
        player([rt('black', 1)]),
        player([rt('black', 2, true)], true),
        player([rt('black', 4)]),
      ],
      phase: 'guess',
    })
    expect(() => applyMove(three, 0, { type: 'guess', target: 1, index: 0, claim: 2 })).toThrow(
      /eliminated/,
    )
  })

  it('RL-6: eliminated seats are skipped in turn order', () => {
    const three = fixture({
      players: [
        player([rt('black', 1), rt('white', 4)]),
        player([rt('black', 2, true), rt('white', 5, true)], true),
        player([rt('black', 8), rt('white', 9)]),
      ],
      pool: [{ color: 'white', value: 0 }],
    })
    let state = applyMove(three, 0, { type: 'draw', color: 'white' })
    state = applyMove(state, 0, { type: 'guess', target: 2, index: 0, claim: 11 }) // wrong
    state = applyMove(state, 0, { type: 'insert', index: 0 })
    expect(state.turn).toBe(2) // seat 1 skipped
  })

  it('RL-4: pool-empty turns start at guess; stop needs no filing; wrong guesses flip your own', () => {
    const dry = fixture({ pool: [], phase: 'guess' })
    // correct guess, then stop outright — nothing to file
    let state = applyMove(dry, 0, { type: 'guess', target: 1, index: 0, claim: 2 })
    expect(legalMoves(state, 0)).toContainEqual({ type: 'stop' })
    state = applyMove(state, 0, { type: 'stop' })
    expect(state.turn).toBe(1)
    expect(state.phase).toBe('guess')
    // wrong guess forces revealing one of your OWN hidden tiles
    state = applyMove(state, 1, { type: 'guess', target: 0, index: 0, claim: 9 })
    expect(state.phase).toBe('reveal')
    expect(legalMoves(state, 1)).toHaveLength(3) // row[0] was already revealed above
    state = applyMove(state, 1, { type: 'reveal', index: 3 })
    expect(state.players[1].row[3].revealed).toBe(true)
    expect(state.turn).toBe(0)
  })

  it('RL-8: revealing the last hidden tile eliminates mid-turn and can end the game', () => {
    const endgame = fixture({
      players: [
        player([rt('black', 1), rt('white', 4)]),
        player([rt('black', 2, true), rt('white', 5)]),
      ],
    })
    let state = applyMove(endgame, 0, { type: 'draw', color: 'white' })
    state = applyMove(state, 0, { type: 'guess', target: 1, index: 1, claim: 5 })
    expect(state.players[1].eliminated).toBe(true)
    expect(state.result).toEqual({ winner: 0 })
    // game over: the pending drawn tile is never filed
    expect(state.drawn).not.toBeNull()
    expect(() => applyMove(state, 0, { type: 'insert', index: 0 })).toThrow(/game is over/)
  })

  it('RL-8: a pool-empty forced reveal can self-eliminate; last hidden rack wins', () => {
    const dry = fixture({
      players: [
        player([rt('black', 1), rt('white', 4, true)]),
        player([rt('black', 2), rt('white', 5)]),
      ],
      pool: [],
      phase: 'guess',
    })
    let state = applyMove(dry, 0, { type: 'guess', target: 1, index: 0, claim: 9 }) // wrong
    state = applyMove(state, 0, { type: 'reveal', index: 0 }) // flips own last hidden tile
    expect(state.players[0].eliminated).toBe(true)
    expect(state.result).toEqual({ winner: 1 })
  })

  it('in a 3P game a mid-turn elimination lets the guesser keep going', () => {
    const three = fixture({
      players: [
        player([rt('black', 1), rt('white', 4)]),
        player([rt('black', 2, true), rt('white', 5)]),
        player([rt('black', 8), rt('white', 9)]),
      ],
    })
    let state = applyMove(three, 0, { type: 'draw', color: 'white' })
    state = applyMove(state, 0, { type: 'guess', target: 1, index: 1, claim: 5 })
    expect(state.players[1].eliminated).toBe(true)
    expect(state.result).toBeNull()
    // continue against the remaining opponent
    state = applyMove(state, 0, { type: 'guess', target: 2, index: 0, claim: 8 })
    expect(state.players[2].row[0].revealed).toBe(true)
  })
})

describe('redaction', () => {
  it('hides exactly the other racks, the pool, and a foreign in-hand tile', () => {
    const state = applyMove(fixture(), 0, { type: 'draw', color: 'black' })
    state.players[1].row[0].revealed = true

    const mine = redact(state, 0)
    expect(mine.players[0].row.map((t) => t.value)).toEqual([1, 4, 7, 9])
    expect(mine.players[1].row.map((t) => t.value)).toEqual([
      2,
      HIDDEN_VALUE,
      HIDDEN_VALUE,
      HIDDEN_VALUE,
    ])
    expect(mine.players[1].row.map((t) => t.color)).toEqual(state.players[1].row.map((t) => t.color))
    expect(mine.pool.map((t) => t.value)).toEqual([HIDDEN_VALUE])
    expect(mine.drawn!.value).toBe(3) // the actor sees their own hand

    const theirs = redact(state, 1)
    expect(theirs.drawn).toEqual({ color: 'black', value: HIDDEN_VALUE })
    expect(theirs.players[0].row.every((t) => t.value === HIDDEN_VALUE)).toBe(true)

    const spectator = redact(state, null)
    expect(
      spectator.players.every((p) => p.row.every((t) => t.revealed || t.value === HIDDEN_VALUE)),
    ).toBe(true)
    // redact never mutates the source
    expect(state.players[0].row[0].value).toBe(1)
  })
})
