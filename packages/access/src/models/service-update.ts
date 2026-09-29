type ServiceUpdateStage =
  | 'downloading'
  | 'installing'
  | 'restarting'
  | 'updated'
  | 'failed';

type ServiceUpdateRecord = {
  from: string;
  target: string;
  stage: ServiceUpdateStage;
  reason: string | undefined;
};

export type ServiceUpdateState = {
  managed: boolean;
  version: string | undefined;
  latest: string | undefined;
  available: boolean;
  running: boolean;
  last: ServiceUpdateRecord | undefined;
};

export type ServiceUpdateCheck = {
  now: string;
  staleBefore: string;
};

export type ServiceUpdateTarget = {
  version: string;
};

export type CheckServiceUpdateInput = {
  state: ServiceUpdateState;
  target: ServiceUpdateTarget;
};

export type ServiceUpdateRefusal =
  | { kind: 'unmanaged' }
  | { kind: 'running' }
  | { kind: 'not-offered' };
