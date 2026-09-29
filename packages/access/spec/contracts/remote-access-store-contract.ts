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

    it('reads back the network the local network was turned on for, and forgets it when a save leaves it out', () => {
      const lanNetwork = { interfaceName: 'wlp2s0', subnet: '192.168.1.0/24' };
      opened.store.save({
        lan: true,
        lanNetwork,
        tailnet: false,
        cloudflare: false,
      });
      expect(opened.store.read()).toEqual({
        lan: true,
        lanNetwork,
        tailnet: false,
        cloudflare: false,
      });
      opened.store.save({ lan: true, tailnet: false, cloudflare: false });
      expect(opened.store.read()).toEqual({
        lan: true,
        tailnet: false,
        cloudflare: false,
      });
    });

    it('reads back the Tailscale Serve target it saved, and forgets it when a save leaves it out', () => {
      opened.store.save({
        lan: false,
        tailnet: true,
        tailnetServeTarget: 'http://127.0.0.1:41000',
        cloudflare: false,
      });
      expect(opened.store.read()).toEqual({
        lan: false,
        tailnet: true,
        tailnetServeTarget: 'http://127.0.0.1:41000',
        cloudflare: false,
      });
      opened.store.save({ lan: false, tailnet: true, cloudflare: false });
      expect(opened.store.read()).toEqual({
        lan: false,
        tailnet: true,
        cloudflare: false,
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
