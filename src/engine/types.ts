/** Seat index, 0..playerCount-1. Turn order is seat order, skipping the eliminated. */
export type Seat = number

/** A tile's color is always public (the backs are colored). */
export type TileColor = 'black' | 'white'
export const COLORS: readonly TileColor[] = ['black', 'white']

/** Numbered tiles run 0..MAX_VALUE in each color. */
export const MAX_VALUE = 11

/** A tile's face: a number 0..11 or the dash joker. */
export type TileValue = number | 'joker'

/** Sentinel for values stripped by `redact` — never a legal tile value. */
export const HIDDEN_VALUE = -1

export interface Tile {
  color: TileColor
  value: TileValue
}

/** A tile standing in a rack. Position is the array index, left to right. */
export interface RowTile extends Tile {
  revealed: boolean
}

/** Opening rack size (R2.2): 4 tiles for 2–3 players, 3 for 4 players. */
export function handSize(playerCount: 2 | 3 | 4): number {
  return playerCount === 4 ? 3 : 4
}

export interface PlayerState {
  row: RowTile[]
  /** All tiles revealed (RL-6). Derived but stored for cheap checks. */
  eliminated: boolean
}

/**
 * The turn's state machine (R4):
 * - `draw`: turn start with a non-empty pool; the only legal move is `draw`.
 * - `guess`: a guess is owed; after a correct one (`mayStop`), `insert`
 *   (tile in hand) or `stop` (pool empty) also become legal.
 * - `insert`: a wrong guess forced the in-hand tile face-up; must `insert`.
 * - `reveal`: a wrong guess with an empty pool; must flip an own tile (RL-4).
 */
export type Phase = 'draw' | 'guess' | 'insert' | 'reveal'

/** The most recent guess, public information for every client's UI. */
export interface GuessRecord {
  actor: Seat
  target: Seat
  index: number
  claim: TileValue
  correct: boolean
}

export interface GameState {
  players: PlayerState[]
  /** Face-down pool; a draw takes the last tile of the chosen color. */
  pool: Tile[]
  turn: Seat
  startingSeat: Seat
  phase: Phase
  /** Drawn this turn, not yet filed into the rack. */
  drawn: Tile | null
  /** A wrong guess forces the in-hand tile to file face-up. */
  drawnFaceUp: boolean
  /** ≥1 correct guess this turn: stopping (filing/ending) is now legal. */
  mayStop: boolean
  lastGuess: GuessRecord | null
  result: { winner: Seat } | null
}

export interface GameConfig {
  playerCount: 2 | 3 | 4
  sharedSeed: number
  startingSeat: Seat
  names: string[]
  /** Include the two dash jokers (lobby option). */
  jokers: boolean
  rulesVersion: string
}

export type Move =
  /** Take the topmost pool tile of the chosen color; look at it privately. */
  | { type: 'draw'; color: TileColor }
  /** Claim the value of an opponent's hidden tile (RL-2, RL-3). */
  | { type: 'guess'; target: Seat; index: number; claim: TileValue }
  /**
   * File the in-hand tile into the own rack at `index`: face-down when
   * stopping after a correct guess, face-up when forced by a wrong one.
   * `index` must come from `legalInsertIndices` (jokers make it ambiguous).
   */
  | { type: 'insert'; index: number }
  /** End the turn after a correct guess with no tile in hand (RL-4). */
  | { type: 'stop' }
  /** Pool-empty wrong guess: flip one of your own hidden tiles (RL-4). */
  | { type: 'reveal'; index: number }
