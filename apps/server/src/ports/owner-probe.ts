export type OwnerProbeRequest = { socketPath: string; timeoutMs: number };

export type OwnerStatus = {
  address: string;
  dataDirectory: string;
  pid: number;
};

export type OwnerProbeResult =
  | { kind: 'running'; status: OwnerStatus }
  | { kind: 'absent' }
  | { kind: 'unreadable'; reason: string };

export interface OwnerProbe {
  probe(input: OwnerProbeRequest): Promise<OwnerProbeResult>;
}
