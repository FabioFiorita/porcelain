import {
  ownerSocketPath,
  probeOwnerSocket,
} from '../lifecycle/owner-socket.ts';
import type { StatusSettings } from './arguments.ts';

export const statusExitCodes = {
  running: 0,
  notRunning: 1,
  /** The socket exists but could not be read, or the path is unusable. */
  failed: 2,
} as const;

/**
 * Report whether a server owns this data directory, through the same probe
 * startup uses so the two cannot disagree about it. "Not running" leaves a
 * distinct exit code from "could not tell", so a script can branch on it.
 */
export async function reportStatus(
  settings: StatusSettings,
  output: { stdout: (message: string) => void; stderr: (m: string) => void },
  timeoutMs = 5000,
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
