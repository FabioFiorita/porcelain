import type { EnvironmentName } from '../models/environment-name.ts';
import type { EnvironmentNameStore } from '../ports/environment-name-store.ts';
import type { HostNameReader } from '../ports/host-name-reader.ts';
import { environmentName } from '../rules/environment-name.ts';

export class ReadEnvironmentNameService {
  private readonly names: EnvironmentNameStore;
  private readonly hostNames: HostNameReader;

  constructor(names: EnvironmentNameStore, hostNames: HostNameReader) {
    this.names = names;
    this.hostNames = hostNames;
  }

  execute(): EnvironmentName {
    return environmentName(this.names.read(), this.hostNames.hostName());
  }
}
