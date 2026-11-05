type PonyfillDetector = {
  detect: (
    source: CanvasImageSource | ImageData
  ) => Promise<Array<{ rawValue: string }>>;
};

export interface QrDiagnostics {
  attempts: number;
  frames: number;
  decodeMs: number;
  fps: number;
  lastError: string | null;
}

export interface QrDecodeOptions {
  video: HTMLVideoElement;
  onToken: (rawValue: string) => void;
  onDiagnostics?: (diagnostics: QrDiagnostics) => void;
  onError?: (error: Error) => void;
  /** Minimum gap between decode attempts. */
  intervalMs?: number;
  /** Longest edge of the frame sent to the decoder. */
  maxDimension?: number;
}

export interface QrDecodeLoop {
  start: () => Promise<void>;
  stop: () => void;
  setDigitalZoom: (zoom: number) => void;
  isRunning: () => boolean;
}

let detectorPromise: Promise<PonyfillDetector> | null = null;

async function getDetector(): Promise<PonyfillDetector> {
  if (detectorPromise) return detectorPromise;

  detectorPromise = (async () => {
    const { BarcodeDetector, prepareZXingModule } = await import(
      'barcode-detector/ponyfill'
    );

    // Self-host the WASM binary so the scanner works offline, behind a strict
    // CSP, and without depending on a third-party CDN at scan time.
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => {
          if (path.endsWith('.wasm')) {
            return '/student/wasm/zxing_reader.wasm';
          }
          return `${prefix}${path}`;
        },
      },
    });

    return new BarcodeDetector({ formats: ['qr_code'] }) as unknown as PonyfillDetector;
  })();

  try {
    return await detectorPromise;
  } catch (error) {
    detectorPromise = null;
    throw error;
  }
}

/**
 * Runs a throttled QR decode loop against a live <video> element.
 *
 * The loop is deliberately conservative on mobile: it decodes at roughly
 * 8-10 fps, caps the frame at 960 px, and never runs two detects concurrently.
 */
export function createQrDecodeLoop({
  video,
  onToken,
  onDiagnostics,
  onError,
  intervalMs = 110,
  maxDimension = 960,
}: QrDecodeOptions): QrDecodeLoop {
  let running = false;
  let decoding = false;
  let detector: PonyfillDetector | null = null;
  let frameRequest = 0;
  let lastDecodeAt = 0;
  let lastDiagnosticsAt = 0;
  let attempts = 0;
  let frames = 0;
  let decodeMs = 0;
  let lastError: string | null = null;
  let lastRaw = '';
  let lastRawAt = 0;
  let digitalZoom = 1;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  const emitDiagnostics = (now: number) => {
    if (!onDiagnostics || now - lastDiagnosticsAt < 500) return;
    const seconds = Math.max(1, (now - lastDiagnosticsAt) / 1000);
    lastDiagnosticsAt = now;
    onDiagnostics({
      attempts,
      frames,
      decodeMs,
      fps: Math.round(attempts / seconds),
      lastError,
    });
    attempts = 0;
    frames = 0;
  };

  const tick = async (now: number) => {
    if (!running) return;
    frameRequest = requestAnimationFrame((next) => {
      void tick(next);
    });

    if (decoding || !detector) return;
    if (now - lastDecodeAt < intervalMs) return;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;
    if (!context) return;
    if (document.visibilityState !== 'visible') return;

    lastDecodeAt = now;
    decoding = true;
    attempts += 1;

    try {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const scale = Math.min(1, maxDimension / Math.max(videoWidth, videoHeight));
      const width = Math.max(1, Math.round(videoWidth * scale));
      const height = Math.max(1, Math.round(videoHeight * scale));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Digital zoom crops the centre of the frame before decoding. This is the
      // fallback for iOS devices that do not expose hardware zoom constraints.
      const zoom = Math.max(1, digitalZoom);
      const sourceWidth = videoWidth / zoom;
      const sourceHeight = videoHeight / zoom;
      const sourceX = (videoWidth - sourceWidth) / 2;
      const sourceY = (videoHeight - sourceHeight) / 2;
      context.drawImage(
        video,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height
      );

      const startedAt = performance.now();
      const results = await detector.detect(canvas);
      decodeMs = Math.round(performance.now() - startedAt);
      frames += results.length;
      lastError = null;

      for (const result of results) {
        const rawValue = result.rawValue;
        if (!rawValue) continue;
        const nowRaw = performance.now();
        if (rawValue === lastRaw && nowRaw - lastRawAt < 400) continue;
        lastRaw = rawValue;
        lastRawAt = nowRaw;
        onToken(rawValue);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      onError?.(error instanceof Error ? error : new Error(lastError));
    } finally {
      decoding = false;
      emitDiagnostics(performance.now());
    }
  };

  return {
    async start() {
      if (running) return;
      detector = await getDetector();
      running = true;
      lastDecodeAt = 0;
      lastDiagnosticsAt = performance.now();
      frameRequest = requestAnimationFrame((now) => {
        void tick(now);
      });
    },
    stop() {
      running = false;
      if (frameRequest) {
        cancelAnimationFrame(frameRequest);
        frameRequest = 0;
      }
    },
    setDigitalZoom(zoom: number) {
      digitalZoom = Math.min(3, Math.max(1, zoom));
    },
    isRunning() {
      return running;
    },
  };
}
