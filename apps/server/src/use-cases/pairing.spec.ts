import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openApplication } from '../app.ts';
import type { PairingReach } from './pairing.ts';

const lan = '192.168.15.64';

async function application(reach: PairingReach) {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-pairing-reach-'));
  const app = await openApplication({
    dataDirectory: join(root, 'state'),
    projectHome: join(root, 'home'),
    pairingReach: () => reach,
  });
  return {
    app,
    close: async () => {
      await app.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function reachFor(extra: Partial<PairingReach['policy']> = {}): PairingReach {
  return {
    port: 4321,
    policy: { allowedHosts: [], localAddresses: [], ...extra },
  };
}

/**
 * The owner's `serve --lan` case. The request hook accepts a connection that
 * arrives on the LAN address, so pairing has to accept a link naming it —
 * they disagreed once, and the owner met that as the server refusing the
 * address it was answering on.
 */
it('accepts a link at an address the server answers on, including under --lan', async () => {
  const context = await application(
    reachFor({ localAddresses: ['127.0.0.1', lan, 'fe80::1'] }),
  );
  try {
    for (const origin of [
      `http://${lan}:4321`,
      'http://127.0.0.1:4321',
      'http://localhost:4321',
      // The same address, spelled as a dual-stack listener reports it.
      `http://[::ffff:${lan}]:4321`,
    ]) {
      const [issued] = await context.app.issuePairing(['iPhone'], [origin]);
      expect(issued?.link, origin).toContain(
        origin.replace(/\[|\]/g, (m) => m),
      );
    }
  } finally {
    await context.close();
  }
});

it('refuses a link aimed where the server does not answer', async () => {
  const context = await application(
    reachFor({ localAddresses: ['127.0.0.1', lan] }),
  );
  try {
    for (const origin of [
      // A different machine on the same network.
      'http://192.168.15.99:4321',
      // A name nobody told this server about.
      'http://porcelain.example:4321',
      // The right host at a port this server never bound.
      `http://${lan}:9999`,
      'not-an-origin',
    ]) {
      await expect(
        context.app.issuePairing(['iPhone'], [origin]),
        origin,
      ).rejects.toMatchObject({ name: 'InvalidPairingAddressError' });
    }
    // And a link with no address at all is not a link.
    await expect(
      context.app.issuePairing(['iPhone'], []),
    ).rejects.toMatchObject({ name: 'InvalidPairingAddressError' });
  } finally {
    await context.close();
  }
});

it('accepts a name given on the command line but not its neighbours', async () => {
  const context = await application(
    reachFor({
      allowedHosts: ['porcelain.tail1234.ts.net'],
      localAddresses: ['100.64.0.1'],
    }),
  );
  try {
    const [issued] = await context.app.issuePairing(
      ['iPad'],
      ['http://porcelain.tail1234.ts.net:4321'],
    );
    expect(issued).toBeDefined();
    await expect(
      context.app.issuePairing(['iPad'], ['http://other.tail1234.ts.net:4321']),
    ).rejects.toMatchObject({ name: 'InvalidPairingAddressError' });
  } finally {
    await context.close();
  }
});

/**
 * 3c refuses a link meant for another installation before sending its secret,
 * which it can only do if the id travels with the code.
 */
it('carries the environment id in the link', async () => {
  const context = await application(
    reachFor({ localAddresses: ['127.0.0.1'] }),
  );
  try {
    const environmentId = context.app.inventory().environmentId;
    expect(environmentId).not.toBe('');
    const [issued] = await context.app.issuePairing(
      ['iPhone'],
      ['http://127.0.0.1:4321'],
    );
    const fragment = new URLSearchParams(
      (issued?.link ?? '').split('#', 2)[1] ?? '',
    );
    expect(fragment.get('e')).toBe(environmentId);
    expect(fragment.get('c')).toBe(issued?.code);
  } finally {
    await context.close();
  }
});

it('lists every address it was given, and issues one link per name', async () => {
  const context = await application(
    reachFor({ localAddresses: ['127.0.0.1', lan] }),
  );
  try {
    const origins = [`http://${lan}:4321`, 'http://127.0.0.1:4321'];
    const issued = await context.app.issuePairing(['iPhone', 'iPad'], origins);
    expect(issued.map((entry) => entry.grant.label)).toEqual([
      'iPhone',
      'iPad',
    ]);
    // Every link points at the first address and carries the rest, so a native
    // client can try whichever is reachable.
    for (const entry of issued) {
      expect(entry.link.startsWith(origins[0] ?? '')).toBe(true);
      const fragment = new URLSearchParams(entry.link.split('#', 2)[1] ?? '');
      expect(fragment.get('a')).toBe(origins.join(','));
    }
    expect(new Set(issued.map((entry) => entry.code)).size).toBe(2);
  } finally {
    await context.close();
  }
});

it('keeps the codes it issued out of what it lists back', async () => {
  const context = await application(
    reachFor({ localAddresses: ['127.0.0.1'] }),
  );
  try {
    const [issued] = await context.app.issuePairing(
      ['iPhone'],
      ['http://127.0.0.1:4321'],
    );
    const listing = await context.app.listAccess();
    expect(listing.grants).toHaveLength(1);
    // Only a digest is stored, so nothing here can reconstruct the link.
    expect(JSON.stringify(listing)).not.toContain(issued?.code ?? 'missing');
  } finally {
    await context.close();
  }
});
