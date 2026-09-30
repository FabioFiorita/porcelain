import { expect } from 'vitest';
import { test } from '../kit/journey';

test('marking and unmarking a changed file as reviewed updates its control and the server', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const marked = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);
  const mark = pairedPage.getByRole('button', {
    name: `Mark ${readme} as reviewed`,
    exact: true,
  });
  const unmark = pairedPage.getByRole('button', {
    name: `Unmark ${readme} as unreviewed`,
    exact: true,
  });
  await expect.element(mark).toBeVisible();
  await mark.click();
  await expect.element(unmark).toBeEnabled();
  await expect.poll(marked).toContain(readme);

  await unmark.click();
  await expect.element(mark).toBeEnabled();
  await expect.poll(marked).not.toContain(readme);
});
