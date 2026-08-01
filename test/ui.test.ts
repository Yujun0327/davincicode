// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte'
import { describe, expect, it } from 'vitest'
import { BaseSession } from '../src/app/session.svelte'
import { createGame } from '../src/engine'
import type { GameConfig, Move, Seat, TileValue } from '../src/engine'
import GameScreen from '../src/ui/GameScreen.svelte'
import Home from '../src/ui/Home.svelte'

// jsdom has no ResizeObserver; bind:clientWidth needs a quiet stand-in
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom has no Web Animations API; give Svelte transitions an instantly-
// finishing stand-in so intros/outros complete synchronously.
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

function render(component: Parameters<typeof mount>[0], props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const instance = mount(component, { target, props })
  flushSync()
  return {
    target,
    cleanup: () => {
      unmount(instance)
      target.remove()
    },
  }
}

describe('Home', () => {
  it('renders the title and starts a hotseat game with the jokers option', () => {
    let started: { count: number; names: string[]; jokers: boolean } | null = null
    const { target, cleanup } = render(Home, {
      onHotseat: (count: number, names: string[], jokers: boolean) =>
        (started = { count, names, jokers }),
    })
    expect(target.textContent).toContain('Davinci Code')

    const jokersBox = target.querySelector('.jokers input') as HTMLInputElement
    expect(jokersBox.checked).toBe(true)
    jokersBox.click()
    flushSync()

    const begin = [...target.querySelectorAll('button')].find((b) => b.textContent!.includes('Begin'))!
    begin.click()
    flushSync()
    expect(started).toMatchObject({ count: 2, jokers: false })
    cleanup()
  })

  it('offers the create/join room controls when online play is wired', () => {
    const { target, cleanup } = render(Home, {
      onHotseat: () => {},
      onCreateRoom: () => {},
      onJoinRoom: () => {},
    })

    const open = [...target.querySelectorAll('button')].find((b) =>
      b.textContent!.includes('Open a room'),
    ) as HTMLButtonElement
    expect(open).toBeDefined()
    expect(open.disabled).toBe(false)

    const code = target.querySelector('input[aria-label="room code"]') as HTMLInputElement
    expect(code).not.toBe(null)
    cleanup()
  })
})

/* ------------------------------------------------------------------ */
/* GameScreen: click-through against a deterministic local session     */
/* ------------------------------------------------------------------ */

/** Hotseat-style session with a FIXED seed so racks are stable. */
class TestSession extends BaseSession {
  readonly mode = 'hotseat'

  constructor(seed = 7) {
    const cfg: GameConfig = {
      playerCount: 2,
      sharedSeed: seed,
      startingSeat: 0,
      names: ['Ana', 'Bo'],
      jokers: true,
      rulesVersion: '1',
    }
    super(cfg, createGame(cfg))
  }

  get mySeat(): Seat | null {
    return null
  }

  get viewer(): Seat | null {
    return this.actor
  }

  submit(move: Move): void {
    this.applyLocal(this.actor, move)
  }
}

function click(el: Element | null | undefined) {
  expect(el, 'expected element to click').toBeTruthy()
  ;(el as HTMLElement).click()
  flushSync()
}

const byText = (root: ParentNode, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent!.includes(text))

function newScreen() {
  const session = new TestSession()
  const r = render(GameScreen, { session, onExit: () => {}, onRematch: () => {} })
  // hotseat: the first actor claims the device through the peek shield
  click(byText(r.target, 'open my dossier'))
  return { session, ...r }
}

/** Click the picker key for the given claim (number pad or dash). */
function pickClaim(target: HTMLElement, claim: TileValue) {
  if (claim === 'joker') {
    click(target.querySelector('button[aria-label="claim joker"]'))
  } else {
    const key = [...target.querySelectorAll('.pad button')].find((b) => b.textContent!.trim() === String(claim))
    click(key)
  }
}

describe('GameScreen', () => {
  it('renders the table: opponent dossier, pool stacks, own rack, shield flow', () => {
    const session = new TestSession()
    const { target, cleanup } = render(GameScreen, {
      session,
      onExit: () => {},
      onRematch: () => {},
    })

    // the peek shield covers the first actor's rack until claimed
    expect(target.textContent).toContain('Pass to Ana')
    click(byText(target, 'open my dossier'))

    expect(target.querySelector('[aria-label="dossier of Bo"]')).not.toBe(null)
    expect(target.querySelector('[aria-label="draw pool"]')).not.toBe(null)
    expect(target.querySelector('[aria-label="your rack"]')).not.toBe(null)
    expect(target.textContent).toContain('Draw a tile')
    cleanup()
  })

  it('walks a correct guess: draw, target, claim, file face-down, turn passes', () => {
    const { session, target, cleanup } = newScreen()

    click(target.querySelector('button[aria-label^="draw a black"]'))
    expect(session.state.drawn).not.toBe(null)
    expect(target.querySelector('[aria-label="tile in hand"]')).not.toBe(null)

    // target Bo's first tile and (honor system!) claim its true value
    const truth = session.state.players[1].row[0].value
    click(target.querySelector(`button[aria-label="guess Bo's tile 1"]`))
    pickClaim(target, truth)
    expect(session.state.players[1].row[0].revealed).toBe(true)
    expect(session.state.mayStop).toBe(true)

    // stop: file the in-hand tile face-down into an offered gap
    click(byText(target, 'File my tile'))
    click(target.querySelector('.gap'))
    expect(session.actor).toBe(1) // turn passed
    expect(target.textContent).toContain('Pass to Bo') // shield re-arms for hotseat
    cleanup()
  })

  it('walks a wrong guess: the drawn tile files face-up through the marked gap', () => {
    const { session, target, cleanup } = newScreen()

    click(target.querySelector('button[aria-label^="draw a white"]'))
    const truth = session.state.players[1].row[0].value
    const lie = truth === 0 ? 1 : 0
    click(target.querySelector(`button[aria-label="guess Bo's tile 1"]`))
    pickClaim(target, lie)

    expect(session.state.phase).toBe('insert')
    expect(target.textContent).toContain('file it face-up')
    const before = session.state.players[0].row.length
    click(target.querySelector('.gap'))
    expect(session.state.players[0].row.length).toBe(before + 1)
    expect(session.state.players[0].row.some((t) => t.revealed)).toBe(true)
    expect(session.actor).toBe(1)
    cleanup()
  })
})
