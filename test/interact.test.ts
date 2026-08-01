import { describe, expect, it } from 'vitest'
import type { Move } from '../src/engine'
import { claimMove, fileGaps, NO_SELECTION, revealChoices, targetTiles } from '../src/ui/interact'

const guess = (target: number, index: number, claim: number | 'joker'): Move => ({
  type: 'guess',
  target,
  index,
  claim,
})

describe('guess-flow interaction helpers', () => {
  it('collapses the guess moves to unique target tiles', () => {
    const moves: Move[] = [guess(1, 0, 0), guess(1, 0, 1), guess(1, 2, 0), guess(2, 1, 'joker')]
    expect(targetTiles(moves)).toEqual([
      { target: 1, index: 0 },
      { target: 1, index: 2 },
      { target: 2, index: 1 },
    ])
  })

  it('resolves a picked claim to its dispatchable move, or null', () => {
    const moves: Move[] = [guess(1, 0, 0), guess(1, 0, 'joker')]
    const sel = { kind: 'picking', target: 1, index: 0 } as const
    expect(claimMove(sel, 'joker', moves)).toEqual(guess(1, 0, 'joker'))
    expect(claimMove(sel, 5, moves)).toBeNull()
    expect(claimMove(NO_SELECTION, 0, moves)).toBeNull()
  })

  it('lists filing gaps and reveal choices from the move list', () => {
    const moves: Move[] = [
      { type: 'insert', index: 2 },
      { type: 'insert', index: 3 },
      { type: 'reveal', index: 1 },
    ]
    expect(fileGaps(moves)).toEqual([2, 3])
    expect(revealChoices(moves)).toEqual([1])
    expect(fileGaps([guess(1, 0, 0)])).toEqual([])
  })
})
