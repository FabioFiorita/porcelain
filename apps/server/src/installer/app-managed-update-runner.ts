import type { ServiceUpdateRunner } from '../ports/service-update-runner.ts';
import { AppManagedUpdateError } from './errors/app-managed-update-error.ts';

type ServiceUpdateState = Awaited<ReturnType<ServiceUpdateRunner['read']>>;

class AppManagedUpdateRunner implements ServiceUpdateRunner {
  read(): Promise<ServiceUpdateState> {
    return Promise.resolve({
      managed: false,
      version: undefined,
      latest: undefined,
      available: false,
      running: false,
      last: undefined,
    });
  }

  start(): Promise<void> {
    return Promise.reject(new AppManagedUpdateError());
  }
}

export function openAppManagedUpdateRunner(): ServiceUpdateRunner {
  return new AppManagedUpdateRunner();
}
