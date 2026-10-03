import type { HostNameReader } from '../../src/ports/host-name-reader.ts';

export class FixedHostNameReader implements HostNameReader {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  hostName(): string {
    return this.name;
  }
}
