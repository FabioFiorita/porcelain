import type { ReadEnvironmentResponse } from '@porcelain/contracts/access';

export type RemoteAnswer =
  | { kind: 'described'; environment: ReadEnvironmentResponse }
  | { kind: 'unauthorized' }
  | { kind: 'unreachable' };
