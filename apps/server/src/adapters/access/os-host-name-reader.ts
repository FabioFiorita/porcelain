import { hostname } from 'node:os';
import type { HostNameReader } from '@porcelain/access/ports';

export class OsHostNameReader implements HostNameReader {
  hostName(): string {
    return hostname();
  }
}
