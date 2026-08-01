// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import { OnlineSession } from '../src/app/session.svelte'
import { HIDDEN_VALUE, mulberry32, publicHash } from '../src/engine'
import GameScreen from '../src/ui/GameScreen.svelte'
import { Mesh } from './mesh'
import PlayingProbe from './support/PlayingProbe.svelte'

// jsdom has no ResizeObserver; bind:clientWidth needs a quiet stand-in
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

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

function addPeer(mesh: Mesh, i: number, creator = false): OnlineSession {
  const transport = mesh.createPeer(`peer-${i}`)
  const session = new OnlineSession(
    ROOM,
    creator,
    { key: `key-${i}`, name: `P${i}` },
    transport,
  )
  mesh.announce(`peer-${i}`)
  return session
}

/** Host + n-1 joiners through the full lobby handshake, everyone ready, deal. */
function startGame(mesh: Mesh, n: number): OnlineSession[] {
  const sessions = [addPeer(mesh, 0, true)]
  mesh.flush()
  for (let i = 1; i < n; i++) {
    sessions.push(addPeer(mesh, i))
    mesh.flush()
  }
  for (const s of sessions) {
    s.setReady(true)
    mesh.flush()
  }
  sessions[0].startGame()
  mesh.flush()
  return sessions
}

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
function playFullTurn(sessions: OnlineSession[], mesh: Mesh): void {
  const acting = sessions.find((s) => s.myTurn)
  if (!acting) return
  const before = acting.state.turn
  while (!acting.state.result && acting.state.turn === before) {
    submitFirst(acting)
    mesh.flush()
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('lobby', () => {
  it('seats joiners in order and gates start on ready', () => {
    const mesh = new Mesh()
    const host = addPeer(mesh, 0, true)
    mesh.flush()
    const b = addPeer(mesh, 1)
    const c = addPeer(mesh, 2)
    mesh.flush()

    expect(host.seats.map((s) => s.name)).toEqual(['P0', 'P1', 'P2'])
    expect(b.seats.length).toBe(3) // roster broadcast reached joiners
    expect(host.canStart).toBe(false)

    host.setReady(true)
    b.setReady(true)
    c.setReady(true)
    mesh.flush()
    expect(host.canStart).toBe(true)

    host.startGame()
    mesh.flush()
    for (const s of [host, b, c]) {
      expect(s.playing).toBe(true)
      expect(s.cfg.playerCount).toBe(3)
    }
    expect([host.seat, b.seat, c.seat].sort()).toEqual([0, 1, 2])
    expect(publicHash(b.state)).toBe(publicHash(host.state))
  })

  it("carries the host's jokers option into every client's deal", () => {
    const mesh = new Mesh()
    const host = addPeer(mesh, 0, true)
    mesh.flush()
    const guest = addPeer(mesh, 1)
    mesh.flush()
    host.jokersWanted = false
    host.setReady(true)
    guest.setReady(true)
    mesh.flush()
    host.startGame()
    mesh.flush()

    for (const s of [host, guest]) {
      expect(s.cfg.jokers).toBe(false)
      expect(s.state.pool.length).toBe(24 - 2 * 4) // no dash tiles dealt
    }
    expect(publicHash(guest.state)).toBe(publicHash(host.state))
  })

  it('renders the lobby→game transition reactively on every client', () => {
    // regression: `playing` short-circuits on `started`; if that field is not
    // reactive the template tracks nothing while false and never flips
    const mesh = new Mesh()
    const host = addPeer(mesh, 0, true)
    mesh.flush()
    const guest = addPeer(mesh, 1)
    mesh.flush()

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
    mesh.flush()
    host.startGame()
    mesh.flush()
    flushSync()

    expect(targets.map((t) => t.target.textContent)).toEqual(['GAME', 'GAME'])
    for (const t of targets) {
      unmount(t.instance)
      t.target.remove()
    }
  })

  it('drops a departed seat so it cannot ghost-block the start', () => {
    const mesh = new Mesh()
    const host = addPeer(mesh, 0, true)
    mesh.flush()
    const b = addPeer(mesh, 1)
    const c = addPeer(mesh, 2)
    mesh.flush()
    for (const s of [host, b, c]) {
      s.setReady(true)
      mesh.flush()
    }
    expect(host.canStart).toBe(true)

    // c closes the tab without un-readying — the seat must vanish, not linger
    mesh.drop('peer-2')
    c.destroy()
    mesh.flush()
    expect(host.seats.length).toBe(2)
    expect(host.canStart).toBe(true)

    host.startGame()
    mesh.flush()
    expect(host.cfg.playerCount).toBe(2)
    expect(b.playing).toBe(true)
  })

  it('seats a ready claim that raced ahead of its hello', () => {
    const mesh = new Mesh()
    const host = addPeer(mesh, 0, true)
    mesh.flush()

    // the joiner's hello to the host is lost; only the host's hello arrives
    mesh.filter = (msg, from, to) => !(msg.t === 'hello' && from === 'peer-1' && to === 'peer-0')
    const guest = addPeer(mesh, 1)
    mesh.flush()
    expect(host.seats.length).toBe(1) // hello never landed

    mesh.filter = () => true
    guest.setReady(true) // claimSeat reaches the host and seats them
    mesh.flush()
    expect(host.seats.length).toBe(2)
    expect(host.seats[1]).toMatchObject({ playerKey: 'key-1', ready: true, connected: true })
  })

  it('turns a fifth arrival away', () => {
    const mesh = new Mesh()
    const sessions = [addPeer(mesh, 0, true)]
    mesh.flush()
    for (let i = 1; i < 5; i++) {
      sessions.push(addPeer(mesh, i))
      mesh.flush()
    }
    expect(sessions[4].status).toBe('room-full')
    expect(sessions[0].seats.length).toBe(4)
  })
})

describe('play across the mesh', () => {
  function playRandomGame(n: 2 | 3 | 4, seed: number) {
    const mesh = new Mesh()
    const sessions = startGame(mesh, n)
    const rng = mulberry32(seed)
    const maxSteps = 800

    for (let step = 0; !sessions[0].state.result; step++) {
      expect(step).toBeLessThan(maxSteps)
      const current = sessions.find((s) => s.myTurn)!
      const moves = current.myMoves()
      expect(moves.length).toBeGreaterThan(0)
      current.submit(moves[Math.floor(rng() * moves.length)])
      mesh.flush()
    }

    const reference = publicHash(sessions[0].state)
    for (const s of sessions) {
      expect(s.state.result).not.toBe(null)
      // exactly one seat still holds a sealed tile — the winner
      expect(s.state.players.filter((p) => !p.eliminated).length).toBe(1)
      expect(publicHash(s.state)).toBe(reference)
      expect(s.status).not.toBe('desync')
    }
  }

  it('2 peers finish a full random game in lockstep', () => playRandomGame(2, 10))
  it('3 peers finish a full random game in lockstep', () => playRandomGame(3, 11))
  it('4 peers finish a full random game in lockstep', () => playRandomGame(4, 12))

  it('recovers from a dropped move via resync', () => {
    const mesh = new Mesh()
    const sessions = startGame(mesh, 3)

    // the victim is a seat that is not acting, so play continues while it lags
    const firstActor = sessions[0].state.turn
    const victimSeat = (firstActor + 2) % 3
    const victim = sessions.find((s) => s.seat === victimSeat)!
    const reference = sessions.find((s) => s !== victim && s.seat !== victimSeat)!

    let dropped = false
    mesh.filter = (msg, _from, to) => {
      if (!dropped && msg.t === 'move' && to === `peer-${victimSeat}`) {
        dropped = true
        return false
      }
      return true
    }

    const acting = sessions.find((s) => s.myTurn)!
    submitFirst(acting) // the draw — dropped on its way to the victim
    mesh.flush()
    expect(dropped).toBe(true)
    expect(publicHash(victim.state)).not.toBe(publicHash(reference.state)) // missed it

    // the next move arrives with a seq gap → the victim requests a resync
    submitFirst(acting) // the guess
    mesh.flush()

    expect(publicHash(victim.state)).toBe(publicHash(reference.state))
    expect(victim.status).toBe('playing')
  })
})

describe('online play through the rendered UI', () => {
  function mountScreen(session: OnlineSession) {
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

  it('lets the acting player draw and guess via clicks and syncs to the peer', () => {
    const mesh = new Mesh()
    const sessions = startGame(mesh, 2)
    const acting = sessions.find((s) => s.myTurn)!
    const peer = sessions.find((s) => !s.myTurn)!
    const { target, cleanup } = mountScreen(acting)

    // no peek shield online — the pool is immediately drawable
    click(target.querySelector('button[aria-label^="draw a black"]'))
    mesh.flush()
    expect(acting.state.drawn).not.toBe(null)
    expect(publicHash(peer.state)).toBe(publicHash(acting.state))
    // the peer sees a redacted in-hand tile
    expect(peer.visibleState.drawn!.value).toBe(HIDDEN_VALUE)

    // target the opponent's first tile and claim its true value (honor system)
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
    mesh.flush()

    expect(acting.state.players[targetSeat].row[0].revealed).toBe(true)
    expect(publicHash(peer.state)).toBe(publicHash(acting.state))

    // stop: file the in-hand tile face-down
    click(byText(target, 'File my tile'))
    click(target.querySelector('.gap'))
    mesh.flush()
    expect(acting.myTurn).toBe(false)
    expect(publicHash(peer.state)).toBe(publicHash(acting.state))
    cleanup()
  })

  it('gives the waiting player no targets and names the actor', () => {
    const mesh = new Mesh()
    const sessions = startGame(mesh, 2)
    const waiting = sessions.find((s) => !s.myTurn)!
    const actorName = waiting.names[waiting.state.turn]
    const { target, cleanup } = mountScreen(waiting)

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
    const mesh = new Mesh()
    const sessions = startGame(mesh, 3)
    const lostSeat = sessions[2].seat

    // play a few full turns, then peer-2 vanishes
    for (let i = 0; i < 3; i++) playFullTurn(sessions, mesh)
    mesh.drop('peer-2')
    sessions[2].destroy()
    mesh.flush()

    // more play happens while they are away (skip if it's their turn)
    for (let i = 0; i < 2; i++) {
      if (!sessions.slice(0, 2).some((x) => x.myTurn)) break
      playFullTurn(sessions.slice(0, 2), mesh)
    }

    // same playerKey returns on a fresh transport: storage replay + resync
    const revived = addPeer(mesh, 2)
    expect(revived.playing).toBe(true) // restored from localStorage before any wire traffic
    mesh.flush()

    expect(revived.seat).toBe(lostSeat) // seat reclaimed
    expect(publicHash(revived.state)).toBe(publicHash(sessions[0].state))
  })

  it('recovers a mid-turn draw from local storage and finishes the turn', () => {
    // the turn machine's two-move turns must survive a refresh in between
    const mesh = new Mesh()
    const sessions = startGame(mesh, 2)
    const actingIdx = sessions.findIndex((s) => s.myTurn)
    const acting = sessions[actingIdx]
    const other = sessions[1 - actingIdx]

    submitFirst(acting) // the draw — turn is now mid-flight
    mesh.flush()
    expect(acting.state.drawn).not.toBe(null)
    expect(acting.myTurn).toBe(true) // still the same seat's turn
    expect(publicHash(other.state)).toBe(publicHash(acting.state))

    // the acting client's tab refreshes mid-turn: transport gone, then a new
    // session for the same playerKey reconstructs from localStorage
    mesh.drop(`peer-${actingIdx}`)
    acting.destroy()
    mesh.flush()
    const revived = addPeer(mesh, actingIdx)
    expect(revived.playing).toBe(true) // restored before any wire traffic
    expect(revived.myTurn).toBe(true)
    expect(revived.state.drawn).not.toBe(null) // the drawn tile survived
    mesh.flush()
    expect(publicHash(revived.state)).toBe(publicHash(other.state))

    // it can now finish the interrupted turn
    const before = revived.state.turn
    while (!revived.state.result && revived.state.turn === before) {
      submitFirst(revived)
      mesh.flush()
    }
    expect(revived.myTurn).toBe(false) // turn passed
    expect(publicHash(other.state)).toBe(publicHash(revived.state))
    expect(other.status).toBe('playing')
    expect(revived.status).toBe('playing')
  })

  it('marks the table as waiting when the acting player disconnects', () => {
    const mesh = new Mesh()
    const sessions = startGame(mesh, 2)
    const actingIdx = sessions.findIndex((s) => s.myTurn)
    const waitingIdx = 1 - actingIdx

    mesh.drop(`peer-${actingIdx}`)
    mesh.flush()
    expect(sessions[waitingIdx].waitingOn).toBe(`P${actingIdx}`)
  })

  it('gives a latecomer a fully redacted spectator view', () => {
    const mesh = new Mesh()
    const sessions = startGame(mesh, 2)

    // the acting player draws, so hidden in-hand info exists
    const acting = sessions.find((s) => s.myTurn)!
    submitFirst(acting)
    mesh.flush()

    const spec = addPeer(mesh, 7)
    mesh.flush()

    expect(spec.playing).toBe(true)
    expect(spec.spectator).toBe(true)
    expect(spec.myTurn).toBe(false)
    expect(spec.myMoves()).toEqual([])
    expect(publicHash(spec.state)).toBe(publicHash(sessions[0].state))
    // hidden hands stay hidden from the watcher: every sealed value is redacted
    const view = spec.visibleState
    expect(view.drawn!.value).toBe(HIDDEN_VALUE)
    for (const p of view.players) {
      for (const t of p.row) if (!t.revealed) expect(t.value).toBe(HIDDEN_VALUE)
    }
  })
})
