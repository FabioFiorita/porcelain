import { type Clock, Effect } from 'effect';

export class InMemoryClock implements Clock.Clock {
  private offset = 0;
  private readonly clock: Clock.Clock;
  constructor(clock: Clock.Clock) {
    this.clock = clock;
  }
  advance(milliseconds: number): void {
    this.offset = this.offset + milliseconds;
  }
  readonly currentTimeMillisUnsafe = () =>
    this.clock.currentTimeMillisUnsafe() + this.offset;
  readonly currentTimeNanosUnsafe = () =>
    this.clock.currentTimeNanosUnsafe() + BigInt(this.offset) * 1_000_000n;
  readonly monotonicTimeNanosUnsafe = () =>
    this.clock.monotonicTimeNanosUnsafe() + BigInt(this.offset) * 1_000_000n;
  readonly currentTimeMillis = Effect.sync(this.currentTimeMillisUnsafe);
  readonly currentTimeNanos = Effect.sync(this.currentTimeNanosUnsafe);
  readonly monotonicTimeNanos = Effect.sync(this.monotonicTimeNanosUnsafe);
  readonly sleep: Clock.Clock['sleep'] = (duration) =>
    this.clock.sleep(duration);
}
