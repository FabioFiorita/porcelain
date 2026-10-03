import type {
  PairingAttemptBucket,
  PairingAttemptLimits,
  PairingAttempts,
  PairingAttemptTaken,
} from '../models/pairing-attempts.ts';

function elapsedMs(since: string, now: string): number {
  return Date.parse(now) - Date.parse(since);
}

function refilled(
  bucket: PairingAttemptBucket,
  now: string,
  capacity: number,
  windowMs: number,
): number {
  return Math.min(
    capacity,
    bucket.tokens + (elapsedMs(bucket.at, now) * capacity) / windowMs,
  );
}

function withRoom(
  peers: ReadonlyMap<string, PairingAttemptBucket>,
  peer: string,
  now: string,
  limits: PairingAttemptLimits,
): ReadonlyMap<string, PairingAttemptBucket> {
  if (peers.size < limits.maxPeers || peers.has(peer)) return peers;
  return new Map(
    [...peers].filter(
      ([, bucket]) => elapsedMs(bucket.at, now) <= limits.windowMs,
    ),
  );
}

export function takePairingAttempt(
  attempts: PairingAttempts,
  peer: string,
  now: string,
  limits: PairingAttemptLimits,
): PairingAttemptTaken {
  const shared = refilled(
    attempts.shared ?? { tokens: limits.attemptsOverall, at: now },
    now,
    limits.attemptsOverall,
    limits.windowMs,
  );
  if (shared < 1)
    return {
      attempts: { ...attempts, shared: { tokens: shared, at: now } },
      taken: false,
    };
  const peers = withRoom(attempts.peers, peer, now, limits);
  if (peers.size >= limits.maxPeers && !peers.has(peer))
    return { attempts: { ...attempts, peers }, taken: false };
  const tokens = refilled(
    peers.get(peer) ?? { tokens: limits.attemptsPerPeer, at: now },
    now,
    limits.attemptsPerPeer,
    limits.windowMs,
  );
  const taken = tokens >= 1;
  return {
    attempts: {
      shared: { tokens: taken ? shared - 1 : shared, at: now },
      peers: new Map(peers).set(peer, {
        tokens: taken ? tokens - 1 : tokens,
        at: now,
      }),
    },
    taken,
  };
}

export function refundPairingAttempt(
  attempts: PairingAttempts,
  peer: string,
  now: string,
  limits: PairingAttemptLimits,
): PairingAttempts {
  const bucket = attempts.peers.get(peer);
  return {
    shared: {
      tokens: Math.min(
        limits.attemptsOverall,
        (attempts.shared?.tokens ?? limits.attemptsOverall) + 1,
      ),
      at: now,
    },
    peers:
      bucket === undefined
        ? attempts.peers
        : new Map(attempts.peers).set(peer, {
            tokens: Math.min(limits.attemptsPerPeer, bucket.tokens + 1),
            at: bucket.at,
          }),
  };
}
