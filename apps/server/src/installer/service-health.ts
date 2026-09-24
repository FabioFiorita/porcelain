import { setTimeout as sleep } from 'node:timers/promises';
import { OWNER_QUICK_PROBE_TIMEOUT_MS } from '../config/owner-socket-settings.ts';
import type { OwnerProbe } from '../ports/owner-probe.ts';

const ATTEMPTS = 60;
const INTERVAL_MS = 250;

export async function waitForHealthyService(options: {
  probe: OwnerProbe;
  socketPath: string;
  dataDirectory: string;
  processId: () => Promise<number | undefined>;
}): Promise<boolean> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const [probe, servicePid] = await Promise.all([
      options.probe(options.socketPath, OWNER_QUICK_PROBE_TIMEOUT_MS),
      options.processId(),
    ]);
    if (
      probe.kind === 'running' &&
      probe.status.dataDirectory === options.dataDirectory &&
      servicePid !== undefined &&
      probe.status.pid === servicePid
    )
      return true;
    await sleep(INTERVAL_MS);
  }
  return false;
}
