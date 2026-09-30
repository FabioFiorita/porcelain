import { expect } from 'vitest';
import { test } from '../kit/journey';

test('while a published layer is read again after its code changed, its mark waits for the new layer and then marks it', async ({
  agent,
  app,
  fetchGate,
  repo,
  server,
}) => {
  const title = 'Readme layer';
  const marks = async () =>
    (await server.reviewedLayers()).marks.map((mark) =>
      mark.stale ? 'stale' : 'reviewed',
    );
  const held = fetchGate.holdNextReviewRead();
  await agent.publishReview(title);
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('button', { name: new RegExp(title) }).click();
  const layer = opened.getByRole('region', {
    name: `Review layer ${title}`,
    exact: true,
  });
  const reviewed = layer.getByRole('button', { name: 'Reviewed', exact: true });
  await layer
    .getByRole('button', { name: 'Mark layer reviewed', exact: true })
    .click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(marks).toEqual(['reviewed']);

  held.arm();
  await repo.write(
    repo.readme.path,
    `${repo.readme.committed}\nA revised change to review.\n`,
  );
  await held.requested;
  await expect.poll(marks).toEqual(['stale']);
  const markChanged = layer.getByRole('button', {
    name: 'Mark changed layer reviewed',
    exact: true,
  });
  await expect.element(markChanged).toBeDisabled();

  held.release();
  await expect
    .element(
      layer.getByText('Code changed since the review was written.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.element(markChanged).toBeEnabled();
  await markChanged.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(marks).toEqual(['reviewed']);
  await expect
    .element(
      layer.getByText('The layer mark could not be updated. Try again.', {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
});
