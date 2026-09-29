import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RemoteAccessStore } from '../../src/ports/remote-access-store.ts';

export type RemoteAccessStoreSubject = {
  store: RemoteAccessStore;
  close: () => void;
};

export function remoteAccessStoreContract(
  subject: string,
  openSubject: () => RemoteAccessStoreSubject,
): void {
  describe(subject, () => {
    let opened: RemoteAccessStoreSubject;

    beforeEach(() => {
      opened = openSubject();
    });

    afterEach(() => {
      opened.close();
    });

    it('keeps every route off before anything is saved', () => {
      expect(opened.store.read()).toEqual({
        lan: false,
        tailnet: false,
        cloudflare: false,
      });
    });

    it('reads back the routes and the tunnel hostname it saved', () => {
      opened.store.save({
        lan: true,
        tailnet: false,
        cloudflare: true,
        cloudflareHostname: 'porcelain.example.com',
      });
      expect(opened.store.read()).toEqual({
        lan: true,
        tailnet: false,
        cloudflare: true,
        cloudflareHostname: 'porcelain.example.com',
      });
    });

    it('forgets the tunnel hostname when a save leaves it out', () => {
      opened.store.save({
        lan: false,
        tailnet: true,
        cloudflare: false,
        cloudflareHostname: 'porcelain.example.com',
      });
      opened.store.save({ lan: false, tailnet: true, cloudflare: false });
      expect(opened.store.read()).toEqual({
        lan: false,
        tailnet: true,
        cloudflare: false,
      });
    });
  });
}
