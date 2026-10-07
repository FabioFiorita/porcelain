import { it, expect } from '@effect/vitest';
import { TestClock } from 'effect/testing';
import { Effect } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { networkDiscoveryLimits } from '../../../spec/fixtures/network-discovery-limits.ts';
import { readMacPrimaryService, readMacRoute } from './mac-network-command.ts';
it.effect(
  'returns no partial discovery data when real commands exceed the output limit or cannot be spawned',
  () =>
    Effect.gen(function* () {
      const limits = { ...networkDiscoveryLimits, outputBytes: 0 };
      expect(
        yield* Effect.all([
          readMacRoute(limits),
          readMacPrimaryService(limits),
        ]),
      ).toEqual(['', '']);
    }).pipe(Effect.provide(NodeServices.layer), TestClock.withLive),
);
