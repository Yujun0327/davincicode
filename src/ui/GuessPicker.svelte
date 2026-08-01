<script lang="ts">
  import { MAX_VALUE } from '../engine'
  import type { TileValue } from '../engine'
  import Modal from './Modal.svelte'

  interface Props {
    targetName: string
    /** Offer the dash key (lobby jokers option). */
    jokers: boolean
    onClaim: (claim: TileValue) => void
    onClose: () => void
  }

  const { targetName, jokers, onClaim, onClose }: Props = $props()

  const numbers = Array.from({ length: MAX_VALUE + 1 }, (_, v) => v)
</script>

<Modal {onClose}>
  <div class="picker">
    <h2 class="ask">Name {targetName}'s tile</h2>
    <div class="pad" role="group" aria-label="claim a value">
      {#each numbers as v (v)}
        <button class="btn key tabular" onclick={() => onClaim(v)}>{v}</button>
      {/each}
      {#if jokers}
        <button class="btn key joker" onclick={() => onClaim('joker')} aria-label="claim joker">–</button>
      {/if}
    </div>
    <button class="btn btn--quiet" onclick={onClose}>Never mind</button>
  </div>
</Modal>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    align-items: stretch;
  }

  .ask {
    font-size: var(--fs-lg);
    text-align: center;
  }

  .pad {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-2);
  }

  .key {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: var(--fs-md);
    padding: 12px 0;
    min-width: 58px;
  }

  .key.joker {
    grid-column: span 2;
    background: var(--redact);
    color: var(--tile-white);
  }
</style>
