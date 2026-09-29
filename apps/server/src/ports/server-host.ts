import type { ServiceUpdateRunner } from './service-update-runner.ts';
import type { DesktopSession } from '@porcelain/access/models';

export type ServerHost = {
  serviceUpdateRunner: ServiceUpdateRunner;
  desktopSession?: DesktopSession | undefined;
};
