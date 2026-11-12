import type { Unit } from './types';

const LB_PER_KG = 2.2046226218;

export function toKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

export function fromKg(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG;
}

/** Weight in the user's unit, to the nearest 0.1, without trailing zeros. */
export function formatWeight(kg: number, unit: Unit): string {
  const v = Math.round(fromKg(kg, unit) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** The usual plate jump: 2.5 kg or 5 lb. */
export function weightStep(unit: Unit): number {
  return unit === 'kg' ? 2.5 : 5;
}

export function formatVolume(kg: number, unit: Unit): string {
  return `${Math.round(fromKg(kg, unit)).toLocaleString()} ${unit}`;
}
