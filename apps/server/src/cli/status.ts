import {
  OWNER_PROBE_TIMEOUT_MS,
  ownerSocketPath,
} from '../config/owner-socket-settings.ts';
import { probeOwnerSocket } from './owner-client.ts';
import type { StatusSettings } from './arguments.ts';

export const statusExitCodes = {
  running: 0,
  notRunning: 1,
  failed: 2,
} as const;

export async function reportStatus(
  settings: StatusSettings,
  output: { stdout: (message: string) => void; stderr: (m: string) => void },
  timeoutMs = OWNER_PROBE_TIMEOUT_MS,
): Promise<number> {
  let socketPath: string;
  try {
    socketPath = ownerSocketPath(settings.dataDirectory);
  } catch (error) {
    output.stderr(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return statusExitCodes.failed;
  }
  const probe = await probeOwnerSocket(socketPath, timeoutMs);
  if (probe.kind === 'running') {
    output.stdout(
      `Porcelain is running at ${probe.status.address}\n` +
        `Data directory: ${probe.status.dataDirectory}\n` +
        `Process: ${probe.status.pid}\n`,
    );
    return statusExitCodes.running;
  }
  if (probe.kind === 'absent') {
    output.stdout(`Porcelain is not running for ${settings.dataDirectory}\n`);
    return statusExitCodes.notRunning;
  }
  output.stderr(`Could not read the Porcelain status: ${probe.reason}\n`);
  return statusExitCodes.failed;
}
