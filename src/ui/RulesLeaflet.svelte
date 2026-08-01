<script lang="ts">
  import Modal from './Modal.svelte'

  interface Props {
    onClose: () => void
  }

  const { onClose }: Props = $props()
</script>

<Modal {onClose}>
  <article class="leaflet">
    <h2>Field manual</h2>

    <section>
      <h3>The setup</h3>
      <p>
        Every tile is a cipher slip, 0–11 in black and white — plus two dash jokers when the
        table plays with them. Each agent stands their dealt slips in a rack, hidden from the
        others, always in ascending order left to right. Equal numbers: black stands left of
        white. Jokers may stand anywhere, and once placed they never move.
      </p>
    </section>

    <section>
      <h3>The turn</h3>
      <p>
        Draw a tile from the pool — you choose black or white — and look at it privately. Then
        you must point at one hidden enemy tile and name it: a number, or the dash.
      </p>
    </section>

    <section>
      <h3>Right and wrong</h3>
      <p>
        Named it right? The tile flips face-up for good, and you choose: keep guessing, or stop
        and file your drawn tile into your rack still sealed. Named it wrong? Your drawn tile
        files itself into your rack face-up, for everyone to read, and your turn ends.
      </p>
    </section>

    <section>
      <h3>When the pool runs dry</h3>
      <p>
        With nothing left to draw you simply guess. Right still lets you continue or stop.
        Wrong now costs you one of your own sealed tiles — your choice which one turns over.
      </p>
    </section>

    <section>
      <h3>Decoded</h3>
      <p>
        An agent whose every tile lies face-up is decoded and out — their rack stays on the
        table for everyone's deductions. The last agent still holding a sealed tile wins.
      </p>
    </section>

    <button class="btn btn--gold" onclick={onClose}>Back to the table</button>
  </article>
</Modal>

<style>
  .leaflet {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    max-width: 60ch;
  }

  h2 {
    font-size: var(--fs-xl);
  }

  h3 {
    font-size: var(--fs-sm);
    margin-bottom: var(--sp-1);
    color: var(--stamp);
  }

  p {
    margin: 0;
    font-size: var(--fs-sm);
    line-height: 1.55;
  }

  .btn {
    align-self: flex-end;
  }
</style>
