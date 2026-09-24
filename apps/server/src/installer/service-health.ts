import type { OwnerProbe } from '../ports/owner-probe.ts';
import { delay } from '../runtime/delay.ts';

export async function waitForHealthyService(options: {
  ownerProbe: OwnerProbe;
  socketPath: string;
  dataDirectory: string;
  processId: () => Promise<number | undefined>;
  probeTimeoutMs: number;
  attempts: number;
  intervalMs: number;
}): Promise<boolean> {
  for (let attempt = 0; attempt < options.attempts; attempt++) {
    const [probe, servicePid] = await Promise.all([
      options.ownerProbe.probe({
        socketPath: options.socketPath,
        timeoutMs: options.probeTimeoutMs,
      }),
      options.processId(),
    ]);
    if (
      probe.kind === 'running' &&
      probe.status.dataDirectory === options.dataDirectory &&
      servicePid !== undefined &&
      probe.status.pid === servicePid
    )
      return true;
    await delay(options.intervalMs);
  }
  return false;
}
