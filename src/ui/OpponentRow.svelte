<script lang="ts">
  import type { RowTile } from '../engine'
  import Tile from './Tile.svelte'

  interface Props {
    name: string
    /** Redacted row — hidden values arrive as HIDDEN_VALUE. */
    row: RowTile[]
    active: boolean
    eliminated: boolean
    /** Tile indices the actor may target with a guess right now. */
    targetable: number[]
    /** Index currently under the claim picker, if any. */
    picked: number | null
    onTarget: (index: number) => void
  }

  const { name, row, active, eliminated, targetable, picked, onTarget }: Props = $props()

  const hiddenLeft = $derived(row.filter((t) => !t.revealed).length)
</script>

<section class="dossier panel" class:active class:eliminated aria-label="dossier of {name}">
  <header class="tab">
    <span class="tab-name">{name}</span>
    <span class="tab-note label">
      {#if eliminated}
        decoded
      {:else}
        {hiddenLeft} sealed
      {/if}
    </span>
  </header>
  <div class="rack">
    {#each row as tile, i (i)}
      {#if targetable.includes(i)}
        <button
          class="slot targetable"
          class:picked={picked === i}
          onclick={() => onTarget(i)}
          aria-label="guess {name}'s tile {i + 1}"
        >
          <Tile color={tile.color} value={tile.value} revealed={tile.revealed} small />
        </button>
      {:else}
        <span class="slot">
          <Tile color={tile.color} value={tile.value} revealed={tile.revealed} small />
        </span>
      {/if}
    {/each}
  </div>
</section>

<style>
  .dossier {
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-width: 0;
  }

  .dossier.active {
    box-shadow:
      inset 0 0 0 2px var(--stamp),
      var(--shadow);
  }

  .dossier.eliminated {
    opacity: 0.62;
  }

  .tab {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-2);
    border-bottom: 1px solid var(--line);
    padding-bottom: var(--sp-1);
  }

  .tab-name {
    font-family: var(--font-ui);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: var(--fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .eliminated .tab-name {
    text-decoration: line-through;
  }

  .tab-note {
    flex: none;
  }

  .rack {
    display: flex;
    gap: var(--sp-1);
    flex-wrap: wrap;
  }

  .slot {
    display: inline-flex;
    padding: 2px;
    border: none;
    background: none;
    border-radius: var(--radius);
  }

  button.slot {
    cursor: pointer;
  }

  .slot.targetable {
    outline: 2px solid color-mix(in srgb, var(--stamp) 45%, transparent);
    outline-offset: 1px;
  }

  .slot.targetable:hover,
  .slot.picked {
    outline-color: var(--stamp);
    background: color-mix(in srgb, var(--stamp) 8%, transparent);
  }
</style>
