import { httpErrors } from '@fastify/sensible';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MonotonicClock } from '../../ports/monotonic-clock.ts';

const WINDOW_MS = 60_000;
const CAPACITY = 10;
const REFILL_PER_MS = CAPACITY / WINDOW_MS;
const GLOBAL_CAPACITY = 60;
const GLOBAL_REFILL_PER_MS = GLOBAL_CAPACITY / WINDOW_MS;
const MAX_PEERS = 1024;

type Bucket = { tokens: number; at: number };

export class AttemptLimit {
  private readonly peers = new Map<string, Bucket>();
  private readonly shared: Bucket;
  private readonly clock: MonotonicClock;

  constructor(clock: MonotonicClock) {
    this.clock = clock;
    this.shared = { tokens: GLOBAL_CAPACITY, at: clock.elapsedMs() };
  }

  take(peer: string): boolean {
    const at = this.clock.elapsedMs();
    const sharedTokens = Math.min(
      GLOBAL_CAPACITY,
      this.shared.tokens + (at - this.shared.at) * GLOBAL_REFILL_PER_MS,
    );
    if (sharedTokens < 1) {
      this.shared.tokens = sharedTokens;
      this.shared.at = at;
      return false;
    }
    if (this.peers.size >= MAX_PEERS && !this.peers.has(peer)) {
      for (const [key, bucket] of this.peers)
        if (at - bucket.at > WINDOW_MS) this.peers.delete(key);
      if (this.peers.size >= MAX_PEERS) return false;
    }
    const bucket = this.peers.get(peer) ?? { tokens: CAPACITY, at };
    const refilled = Math.min(
      CAPACITY,
      bucket.tokens + (at - bucket.at) * REFILL_PER_MS,
    );
    if (refilled < 1) {
      this.peers.set(peer, { tokens: refilled, at });
      this.shared.tokens = sharedTokens;
      this.shared.at = at;
      return false;
    }
    this.peers.set(peer, { tokens: refilled - 1, at });
    this.shared.tokens = sharedTokens - 1;
    this.shared.at = at;
    return true;
  }

  refund(peer: string): void {
    const at = this.clock.elapsedMs();
    this.shared.tokens = Math.min(GLOBAL_CAPACITY, this.shared.tokens + 1);
    this.shared.at = at;
    const bucket = this.peers.get(peer);
    if (bucket)
      this.peers.set(peer, {
        tokens: Math.min(CAPACITY, bucket.tokens + 1),
        at: bucket.at,
      });
  }
}

export function takeAttempt(limit: AttemptLimit) {
  return async (request: FastifyRequest) => {
    if (!limit.take(request.ip))
      throw httpErrors.tooManyRequests(
        'Too many pairing attempts. Wait a moment and try again.',
      );
  };
}

export function refundSucceededAttempt(limit: AttemptLimit) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (reply.statusCode === 200) limit.refund(request.ip);
  };
}
