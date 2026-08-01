<script lang="ts">
  import { fly } from 'svelte/transition'
  import { OnlineSession } from '../app/session.svelte'
  import type { BaseSession } from '../app/session.svelte'
  import Modal from './Modal.svelte'
  import Tile from './Tile.svelte'
  import { dur, settle } from './motion'

  interface Props {
    session: BaseSession
    onRematch: () => void
    onExit: () => void
  }

  const { session, onRematch, onExit }: Props = $props()

  const result = $derived(session.state.result)
  const online = $derived(session instanceof OnlineSession ? session : null)
</script>

{#if result}
  <Modal>
    <div class="dialog">
      <span class="label">final report</span>
      <h2 class="crown">{session.names[result.winner]} cracked the case</h2>

      <div class="tables">
        {#each session.state.players as p, seat (seat)}
          <div
            class="line"
            class:winner={seat === result.winner}
            in:fly={{ y: 14, duration: dur(300), delay: dur(180 + seat * 140), easing: settle }}
          >
            <span class="line-name">{session.names[seat]}</span>
            <span class="line-rack">
              {#each p.row as tile, i (i)}
                <!-- the ledger shows everything: the case is closed -->
                <Tile color={tile.color} value={tile.value} revealed={tile.revealed} small />
              {/each}
            </span>
          </div>
        {/each}
      </div>

      <p class="hint">Sealed tiles kept their secrets to the end — shown here for the record.</p>

      {#if online?.rematchWanted}
        <p class="hint">Rematch requested — waiting for the host to deal again&hellip;</p>
      {/if}

      <div class="row">
        <button class="btn btn--gold" onclick={onRematch}>Rematch</button>
        <button class="btn btn--quiet" onclick={onExit}>Leave the table</button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .dialog {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    min-width: min(84vw, 360px);
  }

  .crown {
    font-size: var(--fs-lg);
  }

  .tables {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    border-bottom: 1px solid var(--line);
    padding-bottom: var(--sp-2);
  }

  .line-name {
    font-family: var(--font-ui);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: var(--fs-xs);
    width: 9ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line.winner .line-name {
    color: var(--stamp);
  }

  .line-rack {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .hint {
    margin: 0;
    font-size: var(--fs-xs);
    font-style: italic;
    color: var(--ink-soft);
  }

  .row {
    display: flex;
    gap: var(--sp-2);
    justify-content: flex-end;
  }
</style>
