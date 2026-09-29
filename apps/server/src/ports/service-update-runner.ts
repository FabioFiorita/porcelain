import type {
  ServiceUpdateCheck,
  ServiceUpdateState,
  ServiceUpdateTarget,
} from '@porcelain/access/models';

export interface ServiceUpdateRunner {
  read(
    input: ServiceUpdateCheck,
    signal?: AbortSignal,
  ): Promise<ServiceUpdateState>;
  start(input: ServiceUpdateTarget, signal?: AbortSignal): Promise<void>;
}
