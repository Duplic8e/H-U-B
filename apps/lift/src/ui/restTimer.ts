import { useEffect, useState } from 'preact/hooks';

/** One rest countdown for the whole app. It keeps an end time rather than
 *  counting ticks, so it stays right while the phone is locked. */
interface Rest { endsAt: number; total: number }
let rest: Rest | null = null;
const listeners = new Set<() => void>();
let alarm: ReturnType<typeof setTimeout> | undefined;
const emit = () => listeners.forEach((l) => l());

function beep() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    for (const [at, f] of [[0, 880], [0.25, 880], [0.5, 1320]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.2);
    }
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Sound is a nicety; the on-screen timer is the signal.
  }
}

export function startRest(seconds: number) {
  clearTimeout(alarm);
  if (seconds <= 0) { rest = null; emit(); return; }
  rest = { endsAt: Date.now() + seconds * 1000, total: seconds };
  alarm = setTimeout(() => { beep(); rest = null; emit(); }, seconds * 1000);
  emit();
}

export function addRest(seconds: number) {
  if (!rest) return;
  const left = Math.max(0, rest.endsAt - Date.now()) / 1000 + seconds;
  const total = rest.total + seconds;
  startRest(left);
  if (rest) rest.total = Math.max(total, left);
  emit();
}

export function stopRest() {
  clearTimeout(alarm);
  rest = null;
  emit();
}

export function useRest(): Rest | null {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    const t = setInterval(l, 1000);
    return () => { listeners.delete(l); clearInterval(t); };
  }, []);
  return rest;
}
