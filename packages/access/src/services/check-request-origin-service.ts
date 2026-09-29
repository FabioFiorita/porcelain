import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '../models/check-request-origin.ts';
import type { RemoteAccessStore } from '../ports/remote-access-store.ts';
import { tunnelHosts } from '../rules/remote-access.ts';
import { requestOriginCheck } from '../rules/request-origin-check.ts';

export class CheckRequestOriginService {
  private readonly remoteAccess: RemoteAccessStore;

  constructor(remoteAccess: RemoteAccessStore) {
    this.remoteAccess = remoteAccess;
  }

  execute(input: CheckRequestOriginInput): CheckRequestOriginResult {
    return requestOriginCheck(input, tunnelHosts(this.remoteAccess.read()));
  }
}
