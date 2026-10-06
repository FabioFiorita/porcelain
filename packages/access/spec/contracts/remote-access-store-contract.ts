import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RemoteAccessStore } from '../../src/ports/remote-access-store.ts';

export type RemoteAccessStoreSubject = {
  store: RemoteAccessStore;
  close: () => Promise<void> | void;
};

export function remoteAccessStoreContract(
  subject: string,
  openSubject: () =>
    | RemoteAccessStoreSubject
    | Promise<RemoteAccessStoreSubject>,
): void {
  describe(subject, () => {
    let opened: RemoteAccessStoreSubject;

    beforeEach(async () => {
      opened = await openSubject();
    });

    afterEach(async () => {
      await opened.close();
    });

    it('keeps every route off before anything is saved', async () => {
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        lan: false,
        tailnet: false,
        cloudflare: false,
      });
    });

    it('reads back the routes and the tunnel hostname it saved', async () => {
      await Effect.runPromise(
        opened.store.save({
          lan: true,
          tailnet: false,
          cloudflare: true,
          cloudflareHostname: 'porcelain.example.com',
        }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        lan: true,
        tailnet: false,
        cloudflare: true,
        cloudflareHostname: 'porcelain.example.com',
      });
    });

    it('reads back the network the local network was turned on for, and forgets it when a save leaves it out', async () => {
      const lanNetwork = {
        interfaceName: 'wlp2s0',
        subnet: '192.168.1.0/24',
        gateway: '192.168.1.1',
        gatewayHardware: 'a4:91:b1:0c:7e:11',
      };
      await Effect.runPromise(
        opened.store.save({
          lan: true,
          lanNetwork,
          tailnet: false,
          cloudflare: false,
        }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        lan: true,
        lanNetwork,
        tailnet: false,
        cloudflare: false,
      });
      await Effect.runPromise(
        opened.store.save({ lan: true, tailnet: false, cloudflare: false }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        lan: true,
        tailnet: false,
        cloudflare: false,
      });
    });

    it('reads back the Tailscale name and listener port it saved, and forgets the port when a save leaves it out', async () => {
      const tailnet = {
        lan: false,
        tailnet: true,
        tailnetHostname: 'laptop.tail0000.ts.net',
        cloudflare: false,
      };
      await Effect.runPromise(
        opened.store.save({ ...tailnet, tailnetPort: 41000 }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        ...tailnet,
        tailnetPort: 41000,
      });
      await Effect.runPromise(opened.store.save(tailnet));
      expect(await Effect.runPromise(opened.store.read())).toEqual(tailnet);
    });

    it('forgets the tunnel hostname when a save leaves it out', async () => {
      await Effect.runPromise(
        opened.store.save({
          lan: true,
          tailnet: false,
          cloudflare: false,
          cloudflareHostname: 'porcelain.example.com',
        }),
      );
      await Effect.runPromise(
        opened.store.save({ lan: true, tailnet: false, cloudflare: false }),
      );
      expect(await Effect.runPromise(opened.store.read())).toEqual({
        lan: true,
        tailnet: false,
        cloudflare: false,
      });
    });
  });
}
