/** Digits only, or null when this is not a retail barcode. UPC-A (12 digits) becomes
 *  EAN-13 with a leading zero, so the same product has one key whichever way it is read. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 8 || digits.length === 13 || digits.length === 14) return digits;
  return null;
}

/** The row id for a scanned product: the same on every device, so two phones that scan
 *  the same product while offline merge into one row. */
export const barcodeId = (barcode: string) => `b:${barcode}`;
