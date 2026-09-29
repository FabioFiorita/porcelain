import type {
  ServiceUpdateState,
  ServiceUpdateTarget,
} from '@porcelain/access/models';

export interface ServiceUpdateRunner {
  read(): Promise<ServiceUpdateState>;
  start(input: ServiceUpdateTarget): Promise<void>;
}
