import { expect, test, withoutRandomUUID } from './fixtures.tsx';

test('Merge opens its confirmation on an HTTP LAN address, where crypto.randomUUID does not exist', async ({
  render,
  onTestFinished,
}) => {
  withoutRandomUUID(onTestFinished);
  const page = await render.mergePullRequest({
    number: 12,
    title: 'Ship the merge confirmation',
    url: 'https://github.com/FabioFiorita/porcelain/pull/12',
    state: 'open',
    draft: false,
    headBranch: 'merge-fixture',
    baseBranch: 'main',
    updatedAt: '2026-11-26T12:00:00Z',
    checksSummary: 'SUCCESS',
    checksTruncated: false,
    description: '',
    headSha: '653d8396c7c1b6a503c3096d3f46a0f45cf33ca8',
    mergeable: 'MERGEABLE',
    mergeMethods: ['squash'],
    labels: [],
    checks: [],
    timeline: [],
    truncated: false,
  });
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  const dialog = page.getByRole('alertdialog', {
    name: 'Merge pull request #12?',
    exact: true,
  });
  await expect.element(dialog).toBeVisible();
  await expect
    .element(
      dialog.getByText(
        'merge-fixture at 653d839 goes into main on GitHub. A merge cannot be undone.',
        { exact: true },
      ),
    )
    .toBeVisible();
});
