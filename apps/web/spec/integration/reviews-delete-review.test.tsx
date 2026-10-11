import { expect, test } from './fixtures.tsx';

test('deleting a published review asks for confirmation, Cancel keeps it and Confirm leaves the review index empty', async ({
  workspace,
  server,
  agent,
}) => {
  await agent.publishReview('Readme layer');
  const saved = async () => {
    const { review } = await server.publishedReview();
    return (
      review && {
        worktreeId: review.worktreeId,
        revision: review.revision,
        publishedAt: review.publishedAt,
        layers: review.layers,
      }
    );
  };
  const original = await saved();
  await expect.poll(async () => (await saved())?.revision).toBe(1);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  const openConfirmation = async () => {
    await workspace
      .getByRole('button', { name: 'Review actions', exact: true })
      .click();
    await workspace
      .getByRole('menuitem', { name: 'Delete review', exact: true })
      .click();
  };
  await openConfirmation();
  const confirm = workspace.getByRole('alertdialog');
  await expect
    .element(confirm.getByText('Delete review?', { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toEqual(original);
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.element(confirm).not.toBeInTheDocument();
  await expect.poll(saved).toEqual(original);
  await expect
    .element(
      workspace.getByRole('button', { name: 'Review actions', exact: true }),
    )
    .toBeVisible();

  await openConfirmation();
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.element(confirm).not.toBeInTheDocument();
  await expect.poll(saved).toBeUndefined();
  await expect
    .element(workspace.getByText('No review published', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Review actions', exact: true }),
    )
    .not.toBeInTheDocument();
});
