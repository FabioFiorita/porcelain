export type OwnerProbeResult =
  | { kind: 'running'; status: { pid: number; dataDirectory: string } }
  | { kind: 'absent' }
  | { kind: 'unreadable'; reason: string };

export type OwnerProbe = (
  socketPath: string,
  timeoutMs: number,
) => Promise<OwnerProbeResult>;
