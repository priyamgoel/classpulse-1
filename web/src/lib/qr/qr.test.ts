import { describe, expect, it } from 'vitest';
import { createFrameAccumulator } from './accumulator';
import { parseQrToken, type QrToken } from './token';

const compact = JSON.stringify({
  s: 'session-1',
  b: 'batch-1',
  i: 0,
  t: 1710000000000,
  k: 'token-0',
  h: 'hash-0',
});

const long = JSON.stringify({
  session_id: 'session-1',
  batch_id: 'batch-2',
  seq_idx: 2,
  timestamp: 1710000000000,
  token_id: 'token-2',
  hash: 'hash-2',
});

function token(seq: number, batch = 'batch-1'): QrToken {
  return {
    session_id: 'session-1',
    batch_id: batch,
    seq_idx: seq,
    timestamp: 1710000000000,
    token_id: `token-${seq}`,
    hash: `hash-${seq}`,
  };
}

describe('parseQrToken', () => {
  it('parses the compact projector format', () => {
    expect(parseQrToken(compact)).toEqual({
      session_id: 'session-1',
      batch_id: 'batch-1',
      seq_idx: 0,
      timestamp: 1710000000000,
      token_id: 'token-0',
      hash: 'hash-0',
    });
  });

  it('parses the long format', () => {
    expect(parseQrToken(long)).toEqual({
      session_id: 'session-1',
      batch_id: 'batch-2',
      seq_idx: 2,
      timestamp: 1710000000000,
      token_id: 'token-2',
      hash: 'hash-2',
    });
  });

  it('rejects malformed or incomplete frames', () => {
    expect(parseQrToken('not-json')).toBeNull();
    expect(parseQrToken('')).toBeNull();
    expect(parseQrToken('[]')).toBeNull();
    expect(
      parseQrToken(
        JSON.stringify({ s: 's', b: 'b', i: 3, t: 1, k: 'k', h: 'h' })
      )
    ).toBeNull();
    expect(
      parseQrToken(JSON.stringify({ s: 's', b: 'b', i: 0, h: 'h' }))
    ).toBeNull();
    expect(
      parseQrToken(JSON.stringify({ s: 's', b: 'b', i: 0, t: 1 }))
    ).toBeNull();
  });
});

describe('createFrameAccumulator', () => {
  it('collects out-of-order frames and returns them in order', () => {
    const accumulator = createFrameAccumulator(
      () => new Date('2026-01-01T10:00:00.000Z')
    );

    expect(accumulator.push(token(2)).status).toBe('collecting');
    expect(accumulator.push(token(0)).status).toBe('collecting');

    const result = accumulator.push(token(1));
    expect(result.status).toBe('ready');
    expect(result.tokens?.map((item) => item.seq_idx)).toEqual([0, 1, 2]);
    expect(result.scanStartedAt).toBe('2026-01-01T10:00:00.000Z');
    expect(result.sessionId).toBe('session-1');
  });

  it('ignores duplicate frames', () => {
    const accumulator = createFrameAccumulator();
    expect(accumulator.push(token(0)).status).toBe('collecting');
    const duplicate = accumulator.push(token(0));
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.collected).toEqual([0]);
  });

  it('resets when the batch changes', () => {
    const accumulator = createFrameAccumulator();
    accumulator.push(token(0, 'batch-old'));
    accumulator.push(token(1, 'batch-old'));

    const reset = accumulator.push(token(0, 'batch-new'));
    expect(reset.status).toBe('collecting');
    expect(reset.batchId).toBe('batch-new');
    expect(reset.collected).toEqual([0]);

    accumulator.push(token(1, 'batch-new'));
    const ready = accumulator.push(token(2, 'batch-new'));
    expect(ready.status).toBe('ready');
    expect(ready.batchId).toBe('batch-new');
    expect(ready.tokens?.every((item) => item.batch_id === 'batch-new')).toBe(
      true
    );
  });

  it('does not become ready with an incomplete batch', () => {
    const accumulator = createFrameAccumulator();
    accumulator.push(token(0));
    accumulator.push(token(1));
    const snapshot = accumulator.snapshot();
    expect(snapshot.status).toBe('collecting');
    expect(snapshot.collected).toEqual([0, 1]);
  });
});
