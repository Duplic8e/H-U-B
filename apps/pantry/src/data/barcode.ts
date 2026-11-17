/** UPC-E, the 8-digit code on small packs, written out as the 12-digit UPC-A that databases list. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [n, a, b, c, d, e, f, check] = code;
  const body = f === '0' || f === '1' || f === '2' ? `${a}${b}${f}0000${c}${d}${e}`
    : f === '3' ? `${a}${b}${c}00000${d}${e}`
      : f === '4' ? `${a}${b}${c}${d}00000${e}`
        : `${a}${b}${c}${d}${e}0000${f}`;
  return `${n}${body}${check}`;
}

/** True when the last digit is the right GS1 check digit for the rest. */
export function validCheckDigit(code: string): boolean {
  if (!/^\d{8,14}$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Digits only, or null when this is not a retail barcode. UPC-A (12 digits) becomes EAN-13 with a
 *  leading zero, and UPC-E is written out in full, so one product has one key however it is read. */
export function normalizeBarcode(raw: string, format?: string): string | null {
  let digits = raw.replace(/\D/g, '');
  // The bundled decoder already writes UPC-E out in full; other readers give the 8 (or 7) printed digits.
  if (format === 'upc_e' && digits.length <= 8) {
    const full = expandUpcE(digits.length === 7 ? `0${digits}` : digits);
    if (!full) return null;
    digits = full;
  }
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 8 || digits.length === 13 || digits.length === 14) return digits;
  return null;
}

/** The same product's code without leading zeros, for comparing codes written at different lengths. */
export const bareBarcode = (code: string) => code.replace(/\D/g, '').replace(/^0+/, '');

/** The row id for a scanned product: the same on every device, so two phones that scan
 *  the same product while offline merge into one row. */
export const barcodeId = (barcode: string) => `b:${barcode}`;
