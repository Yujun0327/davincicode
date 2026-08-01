/**
 * Tiny WebAudio foley kit — synthesized chip clinks, card slides and
 * fanfares, so the repo ships zero audio binaries. Adapted from toybattle.
 */
import type { SfxEvent } from '../app/session.svelte'

let ctx: AudioContext | null = null
let muted = localStorage.getItem('davincicode:muted') === '1'

function ac(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setMuted(m: boolean): void {
  muted = m
  localStorage.setItem('davincicode:muted', m ? '1' : '0')
}

export function isMuted(): boolean {
  return muted
}

function tone(
  freq: number,
  { t = 0, dur = 0.12, type = 'triangle' as OscillatorType, vol = 0.18, glide = 0 } = {},
): void {
  const a = ac()
  const osc = a.createOscillator()
  const gain = a.createGain()
  const start = a.currentTime + t
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

/** Filtered noise burst — the body of clinks and card slides. */
function noise({ t = 0, vol = 0.4, cutoff = 1200, dur = 0.05, type = 'lowpass' as BiquadFilterType } = {}): void {
  const a = ac()
  const buffer = a.createBuffer(1, a.sampleRate * dur, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = type
  filter.frequency.value = cutoff
  const gain = a.createGain()
  gain.gain.value = vol
  src.connect(filter).connect(gain).connect(a.destination)
  src.start(a.currentTime + t)
}

/** Glassy chip clink: bright ping over a metallic noise tick. */
function clink({ t = 0, vol = 1 } = {}): void {
  noise({ t, vol: 0.16 * vol, cutoff: 5200, dur: 0.03, type: 'highpass' })
  tone(2300 + Math.random() * 500, { t, dur: 0.07, vol: 0.1 * vol, type: 'sine', glide: -300 })
}

/** Soft card-on-felt slide. */
function slide({ t = 0, vol = 1 } = {}): void {
  noise({ t, vol: 0.2 * vol, cutoff: 900, dur: 0.09 })
}

export function play(sfx: SfxEvent | 'select' | 'error'): void {
  if (muted) return
  try {
    switch (sfx) {
      case 'select':
        clink({ vol: 0.5 })
        return
      case 'error':
        tone(180, { dur: 0.18, vol: 0.12, type: 'sawtooth', glide: -60 })
        return
      case 'draw':
        // a slip slides off the pool
        slide()
        return
      case 'place':
        // typewriter clack: dry click and a low thock as the slip files
        clink({ vol: 0.6 })
        tone(320, { t: 0.06, dur: 0.05, vol: 0.12, type: 'square' })
        return
      case 'reveal':
        // the stamp comes down: muffled thunk with a papery burst
        noise({ vol: 0.35, cutoff: 700, dur: 0.08 })
        tone(140, { t: 0.01, dur: 0.14, vol: 0.16, type: 'sine', glide: -40 })
        return
      case 'wrong':
        // a dud key: flat descending buzz
        tone(220, { dur: 0.16, vol: 0.11, type: 'sawtooth', glide: -80 })
        return
      case 'win':
        // the teletype bell
        for (const [i, f] of [1319, 1319, 1760].entries())
          tone(f, { t: i * 0.14, dur: 0.3, vol: 0.14, type: 'sine' })
        return
      case 'lose':
        for (const [i, f] of [392, 330, 262].entries())
          tone(f, { t: i * 0.16, dur: 0.3, vol: 0.14, type: 'sawtooth' })
        return
    }
  } catch {
    /* audio context unavailable — stay silent */
  }
}
