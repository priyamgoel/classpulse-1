import type { QrToken } from './token';

export type AccumulatorStatus =
  | 'collecting'
  | 'duplicate'
  | 'ready'
  | 'ignored';

export interface AccumulatorResult {
  status: AccumulatorStatus;
  batchId: string | null;
  sessionId: string | null;
  scanStartedAt: string | null;
  collected: number[];
  tokens?: [QrToken, QrToken, QrToken];
}

export interface FrameAccumulator {
  push: (token: QrToken) => AccumulatorResult;
  reset: () => void;
  snapshot: () => AccumulatorResult;
}

/**
 * Collects the three frames of one rotating QR batch.
 *
 * Mirrors the Android client: a new batch resets the buffer, frames may arrive
 * out of order, and duplicate indices are ignored. Submission only happens when
 * indices 0, 1, and 2 all belong to the same batch.
 */
export function createFrameAccumulator(
  now: () => Date = () => new Date()
): FrameAccumulator {
  let batchId: string | null = null;
  let sessionId: string | null = null;
  let scanStartedAt: string | null = null;
  const frames = new Map<number, QrToken>();

  const collected = () =>
    Array.from(frames.keys()).sort((a, b) => a - b);

  const snapshot = (): AccumulatorResult => ({
    status: 'collecting',
    batchId,
    sessionId,
    scanStartedAt,
    collected: collected(),
  });

  const reset = () => {
    batchId = null;
    sessionId = null;
    scanStartedAt = null;
    frames.clear();
  };

  const push = (token: QrToken): AccumulatorResult => {
    if (!token || typeof token.batch_id !== 'string' || !token.batch_id) {
      return {
        status: 'ignored',
        batchId,
        sessionId,
        scanStartedAt,
        collected: collected(),
      };
    }

    if (token.batch_id !== batchId) {
      // A new batch always starts a new sequence. Frames from the previous
      // batch are discarded so a mixed sequence can never be submitted.
      frames.clear();
      batchId = token.batch_id;
      sessionId = token.session_id;
      scanStartedAt = now().toISOString();
    }

    if (frames.has(token.seq_idx)) {
      return {
        status: 'duplicate',
        batchId,
        sessionId,
        scanStartedAt,
        collected: collected(),
      };
    }

    frames.set(token.seq_idx, token);

    const hasAllFrames =
      frames.has(0) && frames.has(1) && frames.has(2) && frames.size === 3;

    if (hasAllFrames) {
      return {
        status: 'ready',
        batchId,
        sessionId,
        scanStartedAt,
        collected: [0, 1, 2],
        tokens: [frames.get(0)!, frames.get(1)!, frames.get(2)!],
      };
    }

    return {
      status: 'collecting',
      batchId,
      sessionId,
      scanStartedAt,
      collected: collected(),
    };
  };

  return { push, reset, snapshot };
}
