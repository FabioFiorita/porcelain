import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

test('app.shell: an unpaired browser sees pairing instructions from the real server', async () => {
  history.replaceState({}, '', '/');
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);

  const health = await fetch('/api/health', { cache: 'no-store' });
  expect(health.status).toBe(200);

  await import('../../src/main.tsx');
  await expect
    .element(page.getByText('This browser is not paired', { exact: true }))
    .toBeVisible();
});
