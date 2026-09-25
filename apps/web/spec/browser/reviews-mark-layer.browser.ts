import { expect } from 'vitest';
import { test } from '../kit/journey';

test('marking a published layer reviewed keeps the mark, a change to its code asks for review again, and unmarking removes it', async ({
  pairedPage,
  repo,
  server,
  agent,
}) => {
  const title = 'Readme layer';
  const marks = async () =>
    (await server.reviewedLayers()).marks.map((mark) =>
      mark.stale ? 'stale' : 'reviewed',
    );

  await agent.publishReview(title);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('button', { name: new RegExp(title) }).click();
  const layer = pairedPage.getByRole('region', {
    name: `Review layer ${title}`,
  });
  const mark = layer.getByRole('button', { name: 'Mark layer reviewed' });
  const reviewed = layer.getByRole('button', { name: 'Reviewed' });
  await expect.element(mark).toBeEnabled();
  await expect.poll(marks).toEqual([]);
  await mark.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(marks).toEqual(['reviewed']);

  await repo.write(
    repo.readme.path,
    `${repo.readme.committed}\nA revised change to review.\n`,
  );
  await expect
    .element(layer.getByText('Code changed since the review was written.'))
    .toBeVisible();
  const markChanged = layer.getByRole('button', {
    name: 'Mark changed layer reviewed',
  });
  await expect.element(markChanged).toBeEnabled();
  await expect.poll(marks).toEqual(['stale']);
  await markChanged.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(marks).toEqual(['reviewed']);

  await reviewed.click();
  await expect.element(mark).toBeEnabled();
  await expect.poll(marks).toEqual([]);
});
