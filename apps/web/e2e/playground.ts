import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { overSocket } from '../../server/src/development/pair-through-socket.ts';

/**
 * Each viewport project runs against its own playground server and repository,
 * so specs that write files or move HEAD cannot disturb another project's run.
 */
export function playgroundManifest() {
  const manifest =
    test.info().project.name === 'narrow'
      ? process.env.PORCELAIN_PLAYGROUND_INFO_NARROW
      : process.env.PORCELAIN_PLAYGROUND_INFO;
  if (!manifest) throw new Error('Missing isolated playground');
  return manifest;
}

export async function playgroundInfo<T>(): Promise<
  T & { address: string; socketPath: string }
> {
  return JSON.parse(await readFile(playgroundManifest(), 'utf8')) as T & {
    address: string;
    socketPath: string;
  };
}

/**
 * Give this browser context a device of its very own.
 *
 * A pairing grant is consumed once, so a link cannot be shared between
 * contexts — and a credential that could be shared is exactly the fixture
 * secret this design removed. Each context mints its own through the owner
 * socket, which only a process on this machine can reach, and redeems it the
 * way the owner would: by opening the link.
 *
 * Afterwards the context holds an HttpOnly cookie, so `page.request` carries
 * it too and direct API calls need no credential of their own.
 */
export async function pairBrowser(page: Page) {
  const info = await playgroundInfo();
  // The label names the run, so a leaked device is traceable to its test, and
  // so a test can find the device it paired in order to revoke it.
  const label = `Smoke ${test.info().project.name} ${randomUUID()}`;
  const issued = (await overSocket(info.socketPath, '/pairings', {
    labels: [label],
    // The link has to name an origin the server answers at; the page opens it
    // on the preview origin, which proxies to that same server.
    addresses: [new URL(info.address).origin],
  })) as { grants: { link: string }[] };
  const link = issued.grants[0]?.link;
  if (!link) throw new Error('The owner socket issued no pairing link');
  await page.goto(`/pair${new URL(link).hash}`);
  // Redeeming sends the browser on to the workspace, whose sidebar toggle is
  // the one control every viewport shows.
  await expect(
    page.getByRole('button', { name: 'Toggle Sidebar', exact: true }),
  ).toBeVisible();
  // The code must not survive in the address bar.
  expect(new URL(page.url()).hash).toBe('');
  return { label };
}

/**
 * Revoke a paired device through the owner door, the way the owner would with
 * `porcelain revoke`. Nothing a browser holds can do this.
 */
export async function revokeDevice(label: string) {
  const info = await playgroundInfo();
  const listing = (await overSocket(info.socketPath, '/access')) as {
    devices: { id: string; label: string }[];
  };
  const device = listing.devices.find((entry) => entry.label === label);
  if (!device) throw new Error(`No paired device labelled ${label}`);
  await overSocket(info.socketPath, '/access/revoke', { id: device.id });
}
