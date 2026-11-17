import { useEffect, useRef, useState } from 'preact/hooks';
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import { normalizeBarcode } from '../data/barcode';
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

/** Full-screen camera that reports the first retail barcode it reads. */
export function Scanner({ onCode, onClose, onManual }: { onCode: (barcode: string) => void; onClose: () => void; onManual: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const handlers = useRef({ onCode });
  handlers.current = { onCode };

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

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
                const code = normalizeBarcode(found.rawValue);
                if (code && !stopped) { stopped = true; handlers.current.onCode(code); return; }
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

  return (
    <div class="scanner" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      {!error && <video ref={video} playsInline muted autoplay />}
      <div class="scanner-top">
        <h2>Scan a barcode</h2>
        <button type="button" class="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      {error ? (
        <div class="scanner-error">
          <p role="alert">{error}</p>
          <button type="button" class="btn" onClick={onManual}>Add by hand instead</button>
        </div>
      ) : (
        <>
          <div class="scanner-frame"><div /></div>
          <div class="scanner-bottom">
            <p>Hold the barcode inside the frame</p>
            <button type="button" class="btn small" onClick={onManual}>No barcode? Add by hand</button>
          </div>
        </>
      )}
    </div>
  );
}
