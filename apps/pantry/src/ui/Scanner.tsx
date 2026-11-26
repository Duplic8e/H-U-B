import { useEffect, useRef, useState } from 'preact/hooks';
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { normalizeBarcode } from '../data/barcode';
import { beep } from './beep';
import { Icon } from './kit';

// The decoder ships with the app instead of loading from a CDN, so scanning works offline.
prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } });

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

function reason(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Pantry is not allowed to use the camera. Allow it in Settings → Safari → Camera, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is in use by another app.';
  return 'The camera could not be started.';
}

export type ScanMode = 'one' | 'many' | 'remove';

/** What the camera sees, as a small JPEG data URL, so a product nobody recognises can be told apart later. */
export function grabFrame(video: HTMLVideoElement, maxWidth = 360): string | undefined {
  try {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return undefined;
    const scale = Math.min(1, maxWidth / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.6);
    return url.startsWith('data:image/jpeg') ? url : undefined;
  } catch {
    return undefined;
  }
}

/** The result of the last scan in Use up mode. */
export interface Removal { text: string; tone: 'ok' | 'warn'; undo?: () => void }

/** In groceries mode, the same barcode counts again only after it has been out of view this long,
 *  so holding one pack in front of the camera adds it once. */
export const AWAY_MS = 1200;

/** Decides which reads count in groceries mode. */
export function repeatFilter(awayMs = AWAY_MS) {
  const seen = new Map<string, number>();
  return (code: string, now: number): boolean => {
    const last = seen.get(code);
    seen.set(code, now);
    return last === undefined || now - last > awayMs;
  };
}

export interface Batch {
  /** Packs scanned so far. */
  count: number;
  /** What the last scan was, for the confirmation line. */
  last?: { name: string; count: number };
}

/** Full-screen camera. One item: reports the first barcode it reads and closes. Groceries: stays
 *  open and reports every pack, with a tick and a flash for each. Use up: stays open and takes one
 *  pack of each scanned product out of the pantry. */
export function Scanner({ mode, onMode, onCode, onBatchCode, onRemoveCode, batch, removal, onReview, onClose, onManual }: {
  mode: ScanMode;
  onMode: (mode: ScanMode) => void;
  onCode: (barcode: string, photo?: string) => void;
  onBatchCode: (barcode: string, photo?: string) => void;
  onRemoveCode: (barcode: string) => void;
  batch: Batch;
  removal?: Removal;
  onReview: () => void;
  onClose: () => void;
  onManual: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const [flash, setFlash] = useState(0);
  const handlers = useRef({ onCode, onBatchCode, onRemoveCode, mode });
  handlers.current = { onCode, onBatchCode, onRemoveCode, mode };

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), 350);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fresh = repeatFilter();

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        const el = video.current;
        if (stopped || !el) { stream.getTracks().forEach((t) => t.stop()); return; }
        el.srcObject = stream;
        await el.play().catch(() => undefined);
        const detector = new BarcodeDetector({ formats: [...FORMATS] });
        const tick = async () => {
          if (stopped) return;
          try {
            if (el.readyState >= 2 && el.videoWidth) {
              for (const found of await detector.detect(el)) {
                const code = normalizeBarcode(found.rawValue, found.format);
                if (!code || stopped) continue;
                const h = handlers.current;
                if (h.mode === 'one') { stopped = true; h.onCode(code, grabFrame(el)); return; }
                if (!fresh(code, Date.now())) continue;
                beep();
                setFlash(Date.now());
                if (h.mode === 'many') h.onBatchCode(code, grabFrame(el));
                else h.onRemoveCode(code);
              }
            }
          } catch (e) {
            console.error('Barcode detection failed', e);
          }
          timer = setTimeout(() => void tick(), 120);
        };
        void tick();
      } catch (e) {
        if (!stopped) setError(reason(e));
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const many = mode === 'many';
  const remove = mode === 'remove';
  const title = many ? 'Scan groceries' : remove ? 'Use up items' : 'Scan a barcode';
  return (
    <div class={`scanner${remove ? ' removing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      {!error && <video ref={video} playsInline muted autoplay />}
      <div class="scanner-top">
        <h2>{title}</h2>
        <button type="button" class="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      {error ? (
        <div class="scanner-error">
          <p role="alert">{error}</p>
          <button type="button" class="btn" onClick={onManual}>Add by hand instead</button>
        </div>
      ) : (
        <>
          <div class={`scanner-frame${flash ? ' hit' : ''}`}><div /></div>
          <div class="scanner-bottom">
            <div class="scan-modes" role="radiogroup" aria-label="Scan mode">
              <button type="button" role="radio" aria-checked={mode === 'one'} onClick={() => onMode('one')}>One item</button>
              <button type="button" role="radio" aria-checked={many} onClick={() => onMode('many')}>Groceries</button>
              <button type="button" role="radio" aria-checked={remove} onClick={() => onMode('remove')}>Use up</button>
            </div>
            {remove ? (
              <>
                <p class={`scan-last${removal?.tone === 'warn' ? ' warn' : ''}`} role="status" aria-live="polite">
                  {removal ? <>{removal.text}{removal.undo && <button type="button" class="scan-undo" onClick={removal.undo}>Undo</button>}</> : 'Scan what you finished. Each scan takes one out of the pantry.'}
                </p>
                <button type="button" class="btn primary block" onClick={onClose}>Done</button>
              </>
            ) : many ? (
              <>
                <p class="scan-last" role="status" aria-live="polite">
                  {batch.last ? <>{batch.last.name}{batch.last.count > 1 && <b> ×{batch.last.count}</b>}</> : 'Scan each item. Move it away before scanning another of the same.'}
                </p>
                <button type="button" class="btn primary block" disabled={!batch.count} onClick={onReview}>
                  {batch.count ? `Review ${batch.count} ${batch.count === 1 ? 'item' : 'items'}` : 'Nothing scanned yet'}
                </button>
              </>
            ) : (
              <>
                <p>Hold the barcode inside the frame</p>
                <button type="button" class="btn small" onClick={onManual}>No barcode? Add by hand</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
