import { httpErrors } from '@fastify/sensible';
import type { FastifyReply, FastifyRequest } from 'fastify';

const capacity = 10;
const refillPerMs = capacity / 60_000;
const globalCapacity = 60;
const globalRefillPerMs = globalCapacity / 60_000;
const maxPeers = 1024;

type Bucket = { tokens: number; at: number };

export class AttemptLimit {
  private readonly peers = new Map<string, Bucket>();
  private readonly shared: Bucket;
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
    this.shared = { tokens: globalCapacity, at: now() };
  }

  take(peer: string): boolean {
    const at = this.now();
    const sharedTokens = Math.min(
      globalCapacity,
      this.shared.tokens + (at - this.shared.at) * globalRefillPerMs,
    );
    if (sharedTokens < 1) {
      this.shared.tokens = sharedTokens;
      this.shared.at = at;
      return false;
    }
    if (this.peers.size >= maxPeers && !this.peers.has(peer)) {
      for (const [key, bucket] of this.peers)
        if (at - bucket.at > 60_000) this.peers.delete(key);
      if (this.peers.size >= maxPeers) return false;
    }
    const bucket = this.peers.get(peer) ?? { tokens: capacity, at };
    const refilled = Math.min(
      capacity,
      bucket.tokens + (at - bucket.at) * refillPerMs,
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
    const at = this.now();
    this.shared.tokens = Math.min(globalCapacity, this.shared.tokens + 1);
    this.shared.at = at;
    const bucket = this.peers.get(peer);
    if (bucket)
      this.peers.set(peer, {
        tokens: Math.min(capacity, bucket.tokens + 1),
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
