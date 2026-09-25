import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the workspace opens while the page reports a console error', async ({
  pairedPage,
}) => {
  console.error('A failure the journey never declared');
  await expect
    .element(pairedPage.getByRole('region', { name: 'Review content' }))
    .toBeVisible();
});
