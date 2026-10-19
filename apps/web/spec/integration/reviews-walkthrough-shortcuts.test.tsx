import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('N and P move between retained decisions without moving their published revision', async ({
  agent,
  render,
}) => {
  await agent.publishArchitecture();
  const workspace = await render.workspace();
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await review
    .getByRole('button', { name: '3. Publish an immutable note', exact: true })
    .click();
  await expect
    .element(
      review.getByRole('region', {
        name: '3. Publish an immutable note',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('n');
  await expect
    .element(
      review.getByRole('region', {
        name: '4. Export history without blocking writes',
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.keyboard('p');
  await expect
    .element(
      review.getByRole('region', {
        name: '3. Publish an immutable note',
        exact: true,
      }),
    )
    .toBeVisible();
});
