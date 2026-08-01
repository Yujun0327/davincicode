<script lang="ts">
  import type { Tile as TileT, TileColor } from '../engine'

  interface Props {
    /** Redacted pool — only colors and count are real information. */
    pool: TileT[]
    /** May the local player draw right now? */
    canDraw: boolean
    onDraw: (color: TileColor) => void
  }

  const { pool, canDraw, onDraw }: Props = $props()

  const count = (color: TileColor) => pool.filter((t) => t.color === color).length
</script>

<div class="pool" aria-label="draw pool">
  {#each ['black', 'white'] as const as color (color)}
    {@const n = count(color)}
    <button
      class="stack {color}"
      disabled={!canDraw || n === 0}
      onclick={() => onDraw(color)}
      aria-label="draw a {color} tile ({n} left)"
    >
      <span class="band label">{color}</span>
      <span class="left tabular">{String(n).padStart(2, '0')}</span>
    </button>
  {/each}
  <span class="caption label">remaining: {String(pool.length).padStart(2, '0')}</span>
</div>

<style>
  .pool {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .stack {
    width: 52px;
    height: 68px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    box-shadow:
      2px 2px 0 0 color-mix(in srgb, var(--ink) 22%, transparent),
      var(--shadow);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    font: inherit;
  }

  .stack.black {
    background: var(--redact);
    color: var(--tile-white);
  }

  .stack.white {
    background: var(--tile-white);
    color: var(--ink);
  }

  .stack:disabled {
    cursor: default;
    opacity: 0.55;
    box-shadow: var(--hairline);
  }

  .stack:not(:disabled):hover {
    transform: translateY(-1px);
  }

  .band {
    color: inherit;
    opacity: 0.75;
    font-size: 0.58rem;
  }

  .left {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: var(--fs-md);
  }

  .caption {
    writing-mode: vertical-rl;
    font-size: 0.58rem;
  }
</style>
