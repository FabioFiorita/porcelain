import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the server keeps a project name nobody gave it', async ({
  pairedPage,
  server,
}) => {
  await expect
    .element(pairedPage.getByRole('region', { name: 'Review content' }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.project()).name)
    .toBe('A name nobody gave the project');
});
