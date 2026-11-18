/** A short tick for each scan in groceries mode. iPhones only allow sound after a tap, so `unlock`
 *  runs from the Scan button. Silent when the phone's ringer switch is off. */
let ctx: AudioContext | undefined;

export function unlockSound() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch { /* no Web Audio: scans are silent */ }
}

export function beep() {
  if (!ctx || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 1760;
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}
