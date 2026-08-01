<script lang="ts">
  interface Props {
    name: string
    onOpen: () => void
  }

  const { name, onOpen }: Props = $props()
</script>

<div class="shield" role="dialog" aria-label="pass the device">
  <div class="cover panel">
    <span class="label">eyes only</span>
    <h2>Pass to {name}</h2>
    <p class="hint">Their sealed tiles are about to show. Everyone else, look away.</p>
    <button class="btn btn--gold" onclick={onOpen}>I am {name} — open my dossier</button>
  </div>
</div>

<style>
  .shield {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    /* fully opaque: the incoming player's rack must not read through */
    background: var(--manila);
    padding: var(--sp-5);
  }

  .cover {
    padding: var(--sp-6);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    align-items: center;
    text-align: center;
    width: min(94vw, 420px);
  }

  h2 {
    font-size: var(--fs-xl);
  }

  .hint {
    margin: 0;
    color: var(--ink-soft);
  }
</style>
