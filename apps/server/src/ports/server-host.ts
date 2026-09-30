import type { ServiceUpdateRunner } from './service-update-runner.ts';

export type ServerHost = {
  serviceUpdateRunner: ServiceUpdateRunner;
  version: string | undefined;
};
