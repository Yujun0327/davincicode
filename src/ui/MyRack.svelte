<script lang="ts">
  import type { RowTile } from '../engine'
  import Tile from './Tile.svelte'

  interface Props {
    row: RowTile[]
    /** Gap indices open for filing the in-hand tile; empty = not filing. */
    gaps?: number[]
    onFile?: (index: number) => void
    /** Own tile indices flippable on the pool-empty penalty. */
    flippable?: number[]
    onFlip?: (index: number) => void
  }

  const { row, gaps = [], onFile, flippable = [], onFlip }: Props = $props()
</script>

<div class="rack" aria-label="your rack">
  {#each row as tile, i (i)}
    {#if gaps.includes(i)}
      <button class="gap" onclick={() => onFile?.(i)} aria-label="file before tile {i + 1}">
        <span class="caret" aria-hidden="true"></span>
      </button>
    {/if}
    {#if flippable.includes(i)}
      <button class="slot flippable" onclick={() => onFlip?.(i)} aria-label="turn over your tile {i + 1}">
        <Tile color={tile.color} value={tile.value} revealed={tile.revealed} />
      </button>
    {:else}
      <span class="slot">
        <Tile color={tile.color} value={tile.value} revealed={tile.revealed} />
      </span>
    {/if}
  {/each}
  {#if gaps.includes(row.length)}
    <button class="gap" onclick={() => onFile?.(row.length)} aria-label="file at the right end">
      <span class="caret" aria-hidden="true"></span>
    </button>
  {/if}
</div>

<style>
  .rack {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    flex-wrap: wrap;
    min-height: 68px;
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

  .slot.flippable {
    outline: 2px solid color-mix(in srgb, var(--stamp) 45%, transparent);
    outline-offset: 1px;
  }

  .slot.flippable:hover {
    outline-color: var(--stamp);
    background: color-mix(in srgb, var(--stamp) 8%, transparent);
  }

  /* an open filing slot: a ruled gap with a crimson caret beneath */
  .gap {
    width: 26px;
    height: 64px;
    border: 1px dashed var(--stamp);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--stamp) 7%, transparent);
    cursor: pointer;
    display: grid;
    place-items: end center;
    padding-bottom: 4px;
  }

  .gap:hover {
    background: color-mix(in srgb, var(--stamp) 14%, transparent);
  }

  .caret {
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 7px solid var(--stamp);
  }
</style>
