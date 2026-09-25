import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { createPairingLive } from '../../src/features/access/api/pairing-live';
import { browserTransport } from '../../src/shared/api/transport';

test('access.pairing: a link for another installation is rejected', async () => {
  const pairing = createPairingLive(browserTransport(fetch));
  await expect(
    pairing.redeem({
      code: 'unused',
      environmentId: 'another-installation',
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow(
    'This link was made for a different Porcelain installation.',
  );
});

test('access.pairing: a one-time link opens the connected workspace', async () => {
  const code: unknown = import.meta.env.VITE_WEB_ACCESS_PAIRING_CODE;
  const environmentId: unknown = import.meta.env.VITE_WEB_ENVIRONMENT_ID;
  if (typeof code !== 'string' || typeof environmentId !== 'string')
    throw new Error('Browser verification did not issue a pairing link');
  const fragment = new URLSearchParams({ c: code, e: environmentId });
  history.replaceState({}, '', `/pair#${fragment.toString()}`);
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);

  await import('../../src/main.tsx');
  await expect
    .element(page.getByRole('region', { name: 'Review content' }))
    .toBeVisible();
  expect(location.hash).toBe('');
  const inventory = await fetch('/api/inventory', { cache: 'no-store' });
  expect(inventory.status).toBe(200);
});
