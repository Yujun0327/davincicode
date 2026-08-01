<script lang="ts">
  import { HIDDEN_VALUE, MAX_VALUE } from '../engine'
  import DrawPool from './DrawPool.svelte'
  import MyRack from './MyRack.svelte'
  import OpponentRow from './OpponentRow.svelte'
  import Tile from './Tile.svelte'
  import { decodedRack, opponentRack, ownRack } from './gallery-fixtures'

  const pool = [
    ...Array.from({ length: 7 }, () => ({ color: 'black' as const, value: HIDDEN_VALUE })),
    ...Array.from({ length: 5 }, () => ({ color: 'white' as const, value: HIDDEN_VALUE })),
  ]
</script>

<!-- Dev-only visual QA: every tile state, racks, pool, dossiers. -->
<main class="gallery">
  <h1>Component Gallery</h1>

  <section class="panel">
    <h2 class="label">Tile faces, 0–11 + joker, both colors</h2>
    <div class="row">
      {#each ['black', 'white'] as const as color (color)}
        {#each Array.from({ length: MAX_VALUE + 1 }, (_, v) => v) as v (v)}
          <Tile {color} value={v} />
        {/each}
        <Tile {color} value="joker" />
      {/each}
    </div>
  </section>

  <section class="panel">
    <h2 class="label">Tile states: sealed (redacted), decoded, small</h2>
    <div class="row">
      <Tile color="black" value={HIDDEN_VALUE} />
      <Tile color="white" value={HIDDEN_VALUE} />
      <Tile color="black" value={7} revealed />
      <Tile color="white" value="joker" revealed />
      <Tile color="black" value={HIDDEN_VALUE} small />
      <Tile color="white" value={4} revealed small />
    </div>
  </section>

  <section class="panel">
    <h2 class="label">Your rack — filing gaps open</h2>
    <MyRack row={ownRack} gaps={[2, 3]} onFile={() => {}} />
  </section>

  <section class="panel">
    <h2 class="label">Your rack — pool-empty penalty, sealed tiles flippable</h2>
    <MyRack row={ownRack} flippable={[0, 1, 4, 5]} onFlip={() => {}} />
  </section>

  <section class="panel">
    <h2 class="label">Opponent dossiers: active, targetable, decoded</h2>
    <div class="dossiers">
      <OpponentRow
        name="Vesper"
        row={opponentRack}
        active
        eliminated={false}
        targetable={[0, 1, 4, 5]}
        picked={4}
        onTarget={() => {}}
      />
      <OpponentRow
        name="Kim"
        row={decodedRack}
        active={false}
        eliminated
        targetable={[]}
        picked={null}
        onTarget={() => {}}
      />
    </div>
  </section>

  <section class="panel">
    <h2 class="label">The draw pool</h2>
    <DrawPool {pool} canDraw onDraw={() => {}} />
  </section>
</main>

<style>
  .gallery {
    max-width: 1240px;
    margin: 0 auto;
    padding: var(--sp-6) var(--sp-5) var(--sp-7);
    display: flex;
    flex-direction: column;
    gap: var(--sp-6);
  }

  h1 {
    font-size: var(--fs-2xl);
  }

  section {
    padding: var(--sp-5);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    align-items: center;
  }

  .dossiers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--sp-3);
  }
</style>
