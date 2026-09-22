// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import { Mesh } from '@yujun/game-net/mesh'
import { OnlineSession } from '../src/app/session.svelte'
import { mulberry32, publicHash } from '../src/engine'
import type { Move } from '../src/engine'
import GameScreen from '../src/ui/GameScreen.svelte'
import PlayingProbe from './support/PlayingProbe.svelte'
import { HIDDEN_VALUE } from '../src/engine'

// jsdom has no Web Animations API; Svelte transitions need a finishing stub
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    const anim = {
      cancel() {},
      finish() {},
      finished: Promise.resolve(),
      set onfinish(fn: (() => void) | null) {
        fn?.()
      },
    }
    return anim as unknown as Animation
  }
}

const ROOM = 'TESTROOM'
let clock = 1_000_000
const now = () => clock

/** Deterministic room: an in-memory broadcast mesh plus a manual clock. */
class World {
  mesh = new Mesh<never>()
  sessions: OnlineSession[] = []

  add(i: number, creator = false): OnlineSession {
    const s = new OnlineSession(
      ROOM,
      creator,
      { key: `key-${i}`, name: `P${i}` },
      { transport: this.mesh.peer(`peer-${i}`), now, timers: false },
    )
    this.sessions.push(s)
    return s
  }

  /** One second passes: everyone ticks, then the mesh delivers. */
  second(times = 1): void {
    for (let i = 0; i < times; i++) {
      clock += 1000
      for (const s of this.sessions) s.net.tick()
      this.mesh.flush()
    }
  }

  flush(): void {
    this.mesh.flush()
  }

  remove(s: OnlineSession): void {
    s.destroy()
    this.sessions = this.sessions.filter((x) => x !== s)
  }

  /** Host + n-1 joiners, everyone ready, host starts. */
  start(n: number, setup?: (host: OnlineSession) => void): OnlineSession[] {
    const host = this.add(0, true)
    for (let i = 1; i < n; i++) this.add(i)
    this.second(2)
    setup?.(host)
    for (const s of this.sessions) s.setReady(true)
    this.flush()
    host.startGame()
    this.flush()
    return this.sessions
  }

  acting(): OnlineSession {
    return this.sessions.find((s) => s.myTurn)!
  }

  /** Deliver nothing to one peer until restored (a flaky phone). */
  isolate(i: number): void {
    this.mesh.filter = (_m, _from, to) => to !== `peer-${i}`
  }

  restore(): void {
    this.mesh.filter = () => true
  }
}

function mountGame(session: OnlineSession) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const instance = mount(GameScreen, {
    target,
    props: { session, onExit: () => {}, onRematch: () => {} },
  })
  flushSync()
  return {
    target,
    cleanup: () => {
      unmount(instance)
      target.remove()
      document.querySelectorAll('.backdrop').forEach((n) => n.remove())
    },
  }
}

function click(el: Element | null | undefined) {
  expect(el, 'expected element to click').toBeTruthy()
  ;(el as HTMLElement).click()
  flushSync()
}

const byText = (root: ParentNode, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent!.includes(text))

/** Submit the first legal move (a single wire message, never a full turn). */
function submitFirst(session: OnlineSession): void {
  const move = session.myMoves()[0]
  expect(move).toBeDefined()
  session.submit(move)
}

/**
 * Drive the acting seat through a complete turn (draw → guesses → filing or
 * penalty). First-legal-move picks terminate: correct guesses run out of
 * hidden tiles, a wrong guess forces the turn-ending branch.
 */
function turn(w: World): void {
  const acting = w.sessions.find((s) => s.myTurn)
  if (!acting) return
  const before = acting.state.turn
  while (!acting.state.result && acting.state.turn === before) {
    submitFirst(acting)
    w.flush()
  }
}

beforeEach(() => {
  localStorage.clear()
  clock = 1_000_000
})

describe('lobby', () => {
  it('seats joiners in order and gates start on ready', () => {
    const w = new World()
    const host = w.add(0, true)
    w.flush()
    const b = w.add(1)
    w.second()
    const c = w.add(2)
    w.second()

    expect(host.seats.map((s) => s.name)).toEqual(['P0', 'P1', 'P2'])
    expect(b.seats.length).toBe(3) // roster reached joiners
    expect(b.hostKey).toBe('key-0')
    expect(host.canStart).toBe(false)

    host.setReady(true)
    b.setReady(true)
    c.setReady(true)
    w.flush()
    expect(host.canStart).toBe(true)

    host.startGame()
    w.flush()
    for (const s of [host, b, c]) {
      expect(s.playing).toBe(true)
      expect(s.cfg.playerCount).toBe(3)
    }
    expect([host.seat, b.seat, c.seat]).toEqual([0, 1, 2])
    expect(publicHash(b.state)).toBe(publicHash(host.state))
  })

  it('renders the lobby→game transition reactively on every client', () => {
    // regression: templates must track something while `playing` is false
    const w = new World()
    const host = w.add(0, true)
    const guest = w.add(1)
    w.second()

    const targets = [host, guest].map((session) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const instance = mount(PlayingProbe, { target, props: { session } })
      return { target, instance }
    })
    flushSync()
    expect(targets.map((t) => t.target.textContent)).toEqual(['LOBBY', 'LOBBY'])

    host.setReady(true)
    guest.setReady(true)
    w.flush()
    host.startGame()
    w.flush()
    flushSync()

    expect(targets.map((t) => t.target.textContent)).toEqual(['GAME', 'GAME'])
    for (const t of targets) {
      unmount(t.instance)
      t.target.remove()
    }
  })

  it('drops a departed seat so it cannot ghost-block the start', () => {
    const w = new World()
    const host = w.add(0, true)
    const b = w.add(1)
    const c = w.add(2)
    w.second()
    for (const s of [host, b, c]) s.setReady(true)
    w.flush()
    expect(host.canStart).toBe(true)

    w.remove(c) // closes the tab without un-readying
    w.second(16) // presence timeout
    expect(host.seats.length).toBe(2)
    expect(host.canStart).toBe(true)

    host.startGame()
    w.flush()
    expect(host.cfg.playerCount).toBe(2)
    expect(b.playing).toBe(true)
  })

  it('turns a fifth arrival away', () => {
    const w = new World()
    w.add(0, true)
    for (let i = 1; i < 5; i++) w.add(i)
    w.second(3)
    expect(w.sessions[4].status).toBe('room-full')
    expect(w.sessions[0].seats.length).toBe(4)
  })

  it("carries the host's jokers option into every client's deal", () => {
    const w = new World()
    const [host, guest] = w.start(2, (h) => (h.jokersWanted = false))
    for (const s of [host, guest]) {
      expect(s.cfg.jokers).toBe(false)
      expect(s.state.pool.length).toBe(24 - 2 * 4) // no dash tiles dealt
    }
    expect(publicHash(guest.state)).toBe(publicHash(host.state))
  })
})

describe('play across the mesh', () => {

  function playRandomGame(n: 2 | 3 | 4, seed: number, lossy = false) {
    const w = new World()
    const sessions = w.start(n)
    const rng = mulberry32(seed)
    const maxSteps = 1200

    for (let step = 0; !sessions[0].state.result; step++) {
      expect(step).toBeLessThan(maxSteps)
      const current = sessions.find((s) => s.myTurn)
      if (current && !current.state.result) {
        const moves = current.myMoves()
        expect(moves.length).toBeGreaterThan(0)
        current.submit(moves[Math.floor(rng() * moves.length)])
      }
      if (lossy) w.mesh.filter = () => rng() > 0.4
      w.second()
    }
    w.restore()
    w.second(4)

    const reference = publicHash(sessions[0].state)
    for (const s of sessions) {
      expect(s.state.result).not.toBe(null)
      expect(s.state.players.filter((p) => !p.eliminated).length).toBe(1)
      expect(publicHash(s.state)).toBe(reference)
      expect(s.status).toBe('playing')
    }
  }

  it('2 peers finish a full random game in lockstep', () => playRandomGame(2, 10))
  it('3 peers finish a full random game in lockstep', () => playRandomGame(3, 11))
  it('4 peers finish a full random game in lockstep', () => playRandomGame(4, 12))
  it('3 peers converge through 40% beacon loss', () => playRandomGame(3, 13, true))

  it('catches an isolated peer up once its beacons flow again', () => {
    const w = new World()
    const sessions = w.start(3)

    // the victim is the seat two turns away: not the current or the next actor,
    // so play can continue while it is behind (seat i belongs to peer-i)
    const victimSeat = (w.acting().seat! + 2) % 3
    const victim = sessions.find((s) => s.seat === victimSeat)!
    const reference = sessions.find((s) => s !== victim)!

    w.isolate(victimSeat)
    turn(w)
    w.flush()
    expect(publicHash(victim.state)).not.toBe(publicHash(reference.state)) // missed it

    w.restore()
    turn(w)
    w.second(2)

    expect(publicHash(victim.state)).toBe(publicHash(reference.state))
    expect(victim.status).toBe('playing')
  })
})

describe('online play through the rendered UI', () => {
  it('lets the acting player draw and guess via clicks and syncs to the peer', () => {
    const w = new World()
    const sessions = w.start(2)
    const acting = w.acting()
    const peer = sessions.find((s) => !s.myTurn)!
    const { target, cleanup } = mountGame(acting)

    click(target.querySelector('button[aria-label^="draw a black"]'))
    w.flush()
    expect(acting.state.drawn).not.toBe(null)
    expect(publicHash(peer.state)).toBe(publicHash(acting.state))
    expect(peer.visibleState.drawn!.value).toBe(HIDDEN_VALUE)

    const targetSeat = peer.seat!
    const truth = acting.state.players[targetSeat].row[0].value
    click(target.querySelector(`button[aria-label="guess ${peer.myName}'s tile 1"]`))
    const key =
      truth === 'joker'
        ? target.querySelector('button[aria-label="claim joker"]')
        : [...target.querySelectorAll('.pad button')].find(
            (b) => b.textContent!.trim() === String(truth),
          )
    click(key)
    w.flush()

    expect(acting.state.players[targetSeat].row[0].revealed).toBe(true)
    expect(publicHash(peer.state)).toBe(publicHash(acting.state))

    click(byText(target, 'File my tile'))
    click(target.querySelector('.gap'))
    w.flush()
    expect(acting.myTurn).toBe(false)
    expect(publicHash(peer.state)).toBe(publicHash(acting.state))
    cleanup()
  })

  it('gives the waiting player no targets and names the actor', () => {
    const w = new World()
    const sessions = w.start(2)
    const waiting = sessions.find((s) => !s.myTurn)!
    const actorName = waiting.names[waiting.state.turn]
    const { target, cleanup } = mountGame(waiting)

    expect(target.textContent).toContain(`${actorName} is working`)
    expect(target.querySelectorAll('button[aria-label^="guess"]').length).toBe(0)
    const stacks = [...target.querySelectorAll('[aria-label^="draw a"]')]
    expect(stacks.length).toBe(2)
    expect(stacks.every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    cleanup()
  })
})


describe('reconnect and spectators', () => {
  it('replays from local storage and catches up over the wire', () => {
    const w = new World()
    const sessions = w.start(3)
    const gone = sessions[2]
    const lostSeat = gone.seat

    for (let i = 0; i < 3; i++) {
      turn(w)
      w.second()
    }
    w.remove(gone)

    // more play happens while they are away (unless it is their turn)
    for (let i = 0; i < 2; i++) {
      if (!w.sessions.some((x) => x.myTurn)) break
      turn(w)
      w.second()
    }

    // same playerKey returns on a fresh transport: storage replay + beacon catch-up
    const revived = w.add(2)
    expect(revived.playing).toBe(true) // restored from localStorage before any wire traffic
    w.second(2)

    expect(revived.seat).toBe(lostSeat) // seat reclaimed
    expect(publicHash(revived.state)).toBe(publicHash(sessions[0].state))
  })

  it('marks the table as waiting when the acting player disconnects', () => {
    const w = new World()
    const sessions = w.start(2)
    const acting = w.acting()
    const waiting = sessions.find((s) => s !== acting)!
    w.remove(acting)
    w.second(16)
    expect(waiting.waitingOn).toBe(acting.myName)
  })

  it('recovers a mid-turn draw from local storage and finishes the turn', () => {
    const w = new World()
    const sessions = w.start(2)
    const acting = w.acting()
    const actingIdx = sessions.indexOf(acting)
    const other = sessions[1 - actingIdx]

    submitFirst(acting) // the draw — turn is now mid-flight
    w.flush()
    expect(acting.state.drawn).not.toBe(null)
    expect(acting.myTurn).toBe(true)
    expect(publicHash(other.state)).toBe(publicHash(acting.state))

    w.remove(acting)
    const revived = w.add(actingIdx)
    expect(revived.playing).toBe(true) // restored before any wire traffic
    expect(revived.myTurn).toBe(true)
    expect(revived.state.drawn).not.toBe(null) // the drawn tile survived
    w.second()
    expect(publicHash(revived.state)).toBe(publicHash(other.state))

    const before = revived.state.turn
    while (!revived.state.result && revived.state.turn === before) {
      submitFirst(revived)
      w.flush()
    }
    expect(revived.myTurn).toBe(false) // turn passed
    expect(publicHash(other.state)).toBe(publicHash(revived.state))
    expect(other.status).toBe('playing')
    expect(revived.status).toBe('playing')
  })

  it('gives a latecomer a fully redacted spectator view', () => {
    const w = new World()
    const sessions = w.start(2)
    const acting = w.acting()
    submitFirst(acting)
    w.flush()

    const spec = w.add(7)
    w.second(2)

    expect(spec.playing).toBe(true)
    expect(spec.spectator).toBe(true)
    expect(spec.myTurn).toBe(false)
    expect(spec.myMoves()).toEqual([])
    expect(publicHash(spec.state)).toBe(publicHash(sessions[0].state))
    const view = spec.visibleState
    expect(view.drawn!.value).toBe(HIDDEN_VALUE)
    for (const p of view.players) {
      for (const t of p.row) if (!t.revealed) expect(t.value).toBe(HIDDEN_VALUE)
    }
  })
})
