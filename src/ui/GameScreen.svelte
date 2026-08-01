<script lang="ts">
  import type { Seat, TileColor, TileValue } from '../engine'
  import { OnlineSession } from '../app/session.svelte'
  import type { BaseSession } from '../app/session.svelte'
  import { isMuted, play, setMuted } from './audio'
  import { claimMove, fileGaps, NO_SELECTION, revealChoices, targetTiles } from './interact'
  import type { Selection } from './interact'
  import DrawPool from './DrawPool.svelte'
  import GuessPicker from './GuessPicker.svelte'
  import MyRack from './MyRack.svelte'
  import OpponentRow from './OpponentRow.svelte'
  import PeekShield from './PeekShield.svelte'
  import RulesLeaflet from './RulesLeaflet.svelte'
  import Tile from './Tile.svelte'
  import VictoryOverlay from './VictoryOverlay.svelte'

  interface Props {
    session: BaseSession
    onExit: () => void
    onRematch: () => void
  }

  const { session, onExit, onRematch }: Props = $props()

  let sel = $state<Selection>(NO_SELECTION)
  let muted = $state(isMuted())
  let rulesOpen = $state(false)

  // foley: play whatever the session just emitted (seen-cursor pattern)
  let seenEvent = -1
  $effect(() => {
    const last = session.events.at(-1)
    if (last && last.id > seenEvent) {
      seenEvent = last.id
      play(last.sfx)
    }
  })

  // a selection must not survive losing the turn (remote move landed)
  $effect(() => {
    if (!session.myTurn && sel.kind !== 'none') sel = NO_SELECTION
  })

  function toggleMute() {
    muted = !muted
    setMuted(muted)
  }

  /** The seat shown as "mine" at the bottom: fixed online, the actor in hotseat. */
  const me = $derived<Seat>(session.mySeat ?? session.actor)
  const others = $derived.by(() => {
    const n = session.state.players.length
    return Array.from({ length: n - 1 }, (_, i) => (me + 1 + i) % n)
  })

  const online = $derived(session instanceof OnlineSession ? session : null)
  const view = $derived(session.visibleState)
  const game = $derived(session.state)

  const moves = $derived(session.myMoves())
  const targets = $derived(targetTiles(moves))
  const targetsAt = (seat: Seat) => targets.flatMap((t) => (t.target === seat ? [t.index] : []))
  const flips = $derived(revealChoices(moves))
  const canDraw = $derived(moves.some((m) => m.type === 'draw'))
  const canStop = $derived(moves.some((m) => m.type === 'stop'))
  /** Filing after a correct guess is an explicit choice; a wrong guess forces it. */
  const forcedFiling = $derived(game.phase === 'insert' && session.myTurn)
  const mayFile = $derived(game.phase === 'guess' && fileGaps(moves).length > 0)
  const gaps = $derived(forcedFiling || sel.kind === 'filing' ? fileGaps(moves) : [])

  // hotseat: shield the incoming player's rack until they claim the device
  let lastActor = $state<Seat | null>(null)
  let shieldFor = $state<Seat | null>(null)
  $effect(() => {
    if (session.mode !== 'hotseat' || game.result) return
    if (lastActor !== session.actor) {
      lastActor = session.actor
      shieldFor = session.actor
    }
  })

  const turnLine = $derived.by(() => {
    if (game.result) return 'Case closed'
    if (!session.myTurn) {
      const who = session.names[session.actor]
      return online?.spectator ? `Watching — ${who} works` : `${who} is working…`
    }
    switch (game.phase) {
      case 'draw':
        return 'Draw a tile — black or white'
      case 'guess':
        return game.mayStop ? 'Keep guessing, or stop' : 'Point at a tile and name it'
      case 'insert':
        return 'Wrong — file it face-up'
      case 'reveal':
        return 'Wrong — turn over one of yours'
    }
  })

  const guessLine = $derived.by(() => {
    const g = game.lastGuess
    if (!g) return null
    const claim = g.claim === 'joker' ? 'the dash' : `a ${g.claim}`
    return `${session.names[g.actor]} named ${session.names[g.target]}'s tile ${g.index + 1}: ${claim} — ${g.correct ? 'CORRECT' : 'WRONG'}`
  })

  function onDraw(color: TileColor) {
    session.submit({ type: 'draw', color })
  }

  function onTarget(target: Seat, index: number) {
    sel = { kind: 'picking', target, index }
  }

  function onClaim(claim: TileValue) {
    const move = claimMove(sel, claim, moves)
    sel = NO_SELECTION
    if (move) session.submit(move)
  }

  function onFile(index: number) {
    sel = NO_SELECTION
    session.submit({ type: 'insert', index })
  }

  function onFlip(index: number) {
    session.submit({ type: 'reveal', index })
  }
</script>

<div class="screen">
  <header class="topbar">
    <button class="btn btn--quiet small" onclick={onExit}>Leave</button>
    <h1 class="turnline" class:stamped={session.myTurn && !game.result}>{turnLine}</h1>
    <div class="top-actions">
      <button class="btn btn--quiet small" onclick={toggleMute} aria-label={muted ? 'unmute' : 'mute'}>
        {muted ? 'Sound off' : 'Sound on'}
      </button>
      <button class="btn btn--quiet small" onclick={() => (rulesOpen = true)}>Rules</button>
    </div>
  </header>

  {#if online?.status === 'desync'}
    <div class="notice">Out of step with the table — resynchronizing&hellip;</div>
  {:else if online?.waitingOn}
    <div class="notice">Waiting on {online.waitingOn}&hellip; (disconnected)</div>
  {/if}

  <div class="opponents">
    {#each others as seat (seat)}
      <OpponentRow
        name={session.names[seat]}
        row={view.players[seat].row}
        active={session.actor === seat && !game.result}
        eliminated={game.players[seat].eliminated}
        targetable={session.myTurn && sel.kind !== 'filing' ? targetsAt(seat) : []}
        picked={sel.kind === 'picking' && sel.target === seat ? sel.index : null}
        onTarget={(index) => onTarget(seat, index)}
      />
    {/each}
  </div>

  <main class="table">
    <section class="depot panel">
      <h2 class="area-title label">The pool</h2>
      <div class="depot-row">
        <DrawPool pool={view.pool} {canDraw} {onDraw} />
        {#if view.drawn}
          <div class="tray" aria-label="tile in hand">
            <Tile color={view.drawn.color} value={view.drawn.value} />
            <span class="tray-note label">
              {session.myTurn ? 'in hand — do not show' : `${session.names[session.actor]} holds a tile`}
            </span>
          </div>
        {/if}
      </div>
      {#if guessLine}
        <p class="guess-line" class:stamped={game.lastGuess?.correct === false}>{guessLine}</p>
      {/if}
    </section>

    <section class="me panel">
      <header class="me-head">
        <h2 class="area-title label">
          {online?.spectator ? `dossier of ${session.names[me]}` : 'your dossier'}
        </h2>
        <span class="label">{game.players[me].row.filter((t) => !t.revealed).length} sealed</span>
      </header>
      <MyRack row={view.players[me].row} {gaps} {onFile} flippable={flips} {onFlip} />
      {#if session.myTurn && !game.result}
        <div class="action-bar">
          {#if forcedFiling}
            <span class="prompt">Choose the marked slot — the tile files face-up.</span>
          {:else if game.phase === 'reveal'}
            <span class="prompt">Pick one of your sealed tiles to turn over.</span>
          {:else if sel.kind === 'filing'}
            <span class="prompt">Choose a slot — the tile stays sealed.</span>
            <button class="btn btn--quiet small" onclick={() => (sel = NO_SELECTION)}>Keep guessing</button>
          {:else if mayFile}
            <button class="btn btn--gold" onclick={() => (sel = { kind: 'filing' })}>
              File my tile &amp; stop
            </button>
          {:else if canStop}
            <button class="btn btn--gold" onclick={() => session.submit({ type: 'stop' })}>
              Stop here
            </button>
          {/if}
        </div>
      {/if}
    </section>
  </main>
</div>

{#if rulesOpen}
  <RulesLeaflet onClose={() => (rulesOpen = false)} />
{/if}
{#if sel.kind === 'picking'}
  <GuessPicker
    targetName={session.names[sel.target]}
    jokers={session.cfg.jokers}
    onClaim={onClaim}
    onClose={() => (sel = NO_SELECTION)}
  />
{/if}
{#if shieldFor !== null && !game.result}
  <PeekShield name={session.names[shieldFor]} onOpen={() => (shieldFor = null)} />
{/if}
<VictoryOverlay {session} {onRematch} {onExit} />

<style>
  .screen {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-3);
    max-width: 980px;
    margin: 0 auto;
  }

  .topbar {
    display: flex;
    gap: var(--sp-2);
    align-items: center;
  }

  .small {
    padding: 8px 12px;
    min-height: 36px;
    font-size: var(--fs-xs);
  }

  .turnline {
    font-size: var(--fs-md);
    flex: 1;
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .top-actions {
    display: flex;
    gap: var(--sp-1);
  }

  .notice {
    background: color-mix(in srgb, var(--stamp) 12%, var(--paper));
    color: var(--stamp);
    border: 1px solid var(--stamp);
    border-radius: var(--radius);
    padding: var(--sp-2) var(--sp-4);
    text-align: center;
    font-style: italic;
  }

  .opponents {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--sp-2);
  }

  .table {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  .table > section {
    min-width: 0;
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  .area-title {
    margin: 0;
  }

  .depot-row {
    display: flex;
    align-items: center;
    gap: var(--sp-5);
    flex-wrap: wrap;
  }

  .tray {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    padding: var(--sp-2) var(--sp-3);
  }

  .tray-note {
    max-width: 14ch;
  }

  .guess-line {
    margin: 0;
    font-size: var(--fs-xs);
    color: var(--ink-soft);
    border-top: 1px solid var(--line);
    padding-top: var(--sp-2);
  }

  .guess-line.stamped {
    color: var(--stamp);
  }

  .me-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-2);
  }

  .action-bar {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
    border-top: 1px solid var(--line);
    padding-top: var(--sp-2);
    min-height: 44px;
  }

  .prompt {
    font-style: italic;
    color: var(--ink-soft);
    font-size: var(--fs-xs);
  }
</style>
