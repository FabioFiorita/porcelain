import { expect, test } from './fixtures.tsx';

test('while a published decision is read again after its code changed, marking it waits for the new reading and then records it', async ({
  agent,
  render,
  fetchGate,
  repo,
  server,
}) => {
  const title = 'Readme layer';
  const decisions = async () =>
    (await server.reviewedLayers()).marks.map((mark) =>
      mark.stale ? 'stale' : 'reviewed',
    );
  const held = fetchGate.holdNextReviewRead();
  await agent.publishReview(title);
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Review', exact: true }).click();
  await opened.getByRole('button', { name: new RegExp(title) }).click();
  const decision = opened.getByRole('region', {
    name: `1. ${title}`,
    exact: true,
  });
  const mark = decision.getByRole('button', {
    name: 'Mark decision reviewed',
    exact: true,
  });
  const reviewed = decision.getByRole('button', {
    name: 'Decision reviewed',
    exact: true,
  });
  await mark.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(decisions).toEqual(['reviewed']);

  held.arm();
  await repo.write(
    repo.readme.path,
    `${repo.readme.committed}\nA revised change to review.\n`,
  );
  await held.requested;
  await expect.poll(decisions).toEqual(['stale']);
  await expect.element(mark).toBeDisabled();

  held.release();
  await expect
    .element(
      decision.getByText('Code moved since it was explained', { exact: true }),
    )
    .toBeVisible();
  await expect.element(mark).toBeEnabled();
  await mark.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(decisions).toEqual(['reviewed']);
});
