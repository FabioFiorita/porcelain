import { setTimeout as sleep } from 'node:timers/promises';
import type { OwnerProbe } from '../ports/owner-probe.ts';

const attempts = 60;
const probeTimeoutMs = 500;
const intervalMs = 250;

export async function waitForHealthyService(options: {
  probe: OwnerProbe;
  socketPath: string;
  dataDirectory: string;
  processId: () => Promise<number | undefined>;
}): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const [probe, servicePid] = await Promise.all([
      options.probe(options.socketPath, probeTimeoutMs),
      options.processId(),
    ]);
    if (
      probe.kind === 'running' &&
      probe.status.dataDirectory === options.dataDirectory &&
      servicePid !== undefined &&
      probe.status.pid === servicePid
    )
      return true;
    await sleep(intervalMs);
  }
  return false;
}
