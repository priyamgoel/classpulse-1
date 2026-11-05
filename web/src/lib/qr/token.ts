export interface QrToken {
  session_id: string;
  batch_id: string;
  seq_idx: number;
  timestamp: number;
  token_id: string;
  hash: string;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Parses both the compact projector payload (`s,b,i,t,k,h`) and the long form.
 * Returns null for anything that is not a complete ClassPulse frame.
 */
export function parseQrToken(raw: string): QrToken | null {
  if (!raw) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return null;
  }

  const data = decoded as Record<string, unknown>;
  const sessionId = asText(data.session_id ?? data.s);
  const batchId = asText(data.batch_id ?? data.b);
  const seqIdx = asFiniteNumber(data.seq_idx ?? data.i);
  const timestamp = asFiniteNumber(data.timestamp ?? data.t);
  const tokenId = asText(data.token_id ?? data.k);
  const hash = asText(data.hash ?? data.h);

  if (
    !sessionId ||
    !batchId ||
    seqIdx === null ||
    !Number.isInteger(seqIdx) ||
    seqIdx < 0 ||
    seqIdx > 2 ||
    timestamp === null ||
    !hash
  ) {
    return null;
  }

  return {
    session_id: sessionId,
    batch_id: batchId,
    seq_idx: seqIdx,
    timestamp,
    token_id: tokenId,
    hash,
  };
}
