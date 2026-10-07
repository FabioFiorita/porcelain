import { Effect } from 'effect';
import type { OwnerProbe, OwnerProbeRequest } from '../ports/owner-probe.ts';

export const probeOwner = Effect.fn('Installer.probeOwner')(
  (ownerProbe: OwnerProbe, input: OwnerProbeRequest) => ownerProbe.probe(input),
);

export const waitForHealthyService = Effect.fn(
  'Installer.waitForHealthyService',
)(function* (options: {
  ownerProbe: OwnerProbe;
  socketPath: string;
  dataDirectory: string;
  processId: () => Effect.Effect<number | undefined>;
  probeTimeoutMs: number;
  attempts: number;
  intervalMs: number;
}) {
  for (let attempt = 0; attempt < options.attempts; attempt++) {
    const [probe, servicePid] = yield* Effect.all(
      [
        probeOwner(options.ownerProbe, {
          socketPath: options.socketPath,
          timeoutMs: options.probeTimeoutMs,
        }),
        options.processId(),
      ],
      { concurrency: 'unbounded' },
    );
    if (
      probe.kind === 'running' &&
      probe.status.dataDirectory === options.dataDirectory &&
      servicePid !== undefined &&
      probe.status.pid === servicePid
    )
      return true;
    yield* Effect.sleep(options.intervalMs);
  }
  return false;
});
