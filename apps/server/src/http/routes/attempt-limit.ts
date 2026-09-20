/**
 * A token bucket, in memory, for unauthenticated redemption.
 *
 * This is about amplification, not guessing: the code has 256 bits, so no rate
 * matters to an attacker trying to find one. What a limit buys is that a flood
 * of valid-shaped codes cannot make the server hash and read SQLite on the
 * event loop every legitimate request shares.
 */
const capacity = 10;
const refillPerMs = capacity / 60_000;
/**
 * A ceiling across every peer. Per-peer alone is not a limit when the attacker
 * chooses the peer: a LAN host with a /64 of IPv6 source addresses gets the
 * per-peer allowance thousands of times over, and each attempt is a synchronous
 * hash and SQLite read on the one event loop everything else shares.
 */
const globalCapacity = 60;
const globalRefillPerMs = globalCapacity / 60_000;
/** Bounded so the limiter itself cannot be turned into the memory attack. */
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
    // The shared ceiling is spent first, so rotating addresses cannot buy more
    // work than one attacker is allowed in total.
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
      // Still full: refuse rather than grow without bound. A shared limit is a
      // worse experience than a per-peer one, and a better failure than heap
      // exhaustion.
      if (this.peers.size >= maxPeers) return false;
    }
    const bucket = this.peers.get(peer) ?? { tokens: capacity, at };
    const refilled = Math.min(
      capacity,
      bucket.tokens + (at - bucket.at) * refillPerMs,
    );
    if (refilled < 1) {
      this.peers.set(peer, { tokens: refilled, at });
      // A peer over its own allowance does not spend the shared budget too.
      this.shared.tokens = sharedTokens;
      this.shared.at = at;
      return false;
    }
    this.peers.set(peer, { tokens: refilled - 1, at });
    this.shared.tokens = sharedTokens - 1;
    this.shared.at = at;
    return true;
  }
}
