<script lang="ts">
  import { HIDDEN_VALUE } from '../engine'
  import type { TileColor, TileValue } from '../engine'

  interface Props {
    color: TileColor
    /** HIDDEN_VALUE renders the redaction bar instead of a numeral. */
    value: TileValue
    revealed?: boolean
    /** Compact rendering for opponent racks. */
    small?: boolean
  }

  const { color, value, revealed = false, small = false }: Props = $props()

  const hidden = $derived(value === HIDDEN_VALUE)
  const glyph = $derived(value === 'joker' ? '–' : hidden ? '' : String(value))
</script>

<span class="tile {color}" class:small class:revealed aria-hidden="true">
  {#if hidden}
    <span class="bar"></span>
  {:else}
    <span class="numeral">{glyph}</span>
  {/if}
  {#if revealed}
    <span class="stamp-mark">✕</span>
  {/if}
</span>

<style>
  .tile {
    --tile-w: 44px;
    --tile-h: 60px;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--tile-w);
    height: var(--tile-h);
    border-radius: var(--radius);
    box-shadow:
      inset 0 0 0 1px var(--line),
      var(--shadow);
    flex: none;
    user-select: none;
  }

  .tile.small {
    --tile-w: 32px;
    --tile-h: 44px;
  }

  .tile.black {
    background: var(--redact);
    color: var(--tile-white);
  }

  .tile.white {
    background: var(--tile-white);
    color: var(--ink);
  }

  .numeral {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: calc(var(--tile-h) * 0.42);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    position: relative;
    z-index: 1; /* the numeral must stay readable under the DECODED strike */
  }

  /* the redaction bar: paper-tone on black slips, ink on white ones */
  .bar {
    width: 62%;
    height: calc(var(--tile-h) * 0.2);
    border-radius: 1px;
  }

  .black .bar {
    background: var(--tile-white);
    opacity: 0.85;
  }

  .white .bar {
    background: var(--ink);
    opacity: 0.88;
  }

  /* decoded: the slip lies exposed, struck with stamp ink */
  .tile.revealed {
    opacity: 0.82;
  }

  .stamp-mark {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-size: calc(var(--tile-h) * 0.72);
    color: var(--stamp);
    opacity: 0.38;
    transform: rotate(-6deg);
    pointer-events: none;
  }
</style>
