import { Context } from 'effect';
export interface HostNameReader {
  hostName(): string;
}

export const HostNameReader = Context.Service<
  '@porcelain/access/HostNameReader',
  HostNameReader
>('@porcelain/access/HostNameReader');
