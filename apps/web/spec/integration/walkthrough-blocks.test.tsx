import { page as browserPage, userEvent } from 'vite-plus/test/browser';
import { blocksFixture, expect, test } from './fixtures.tsx';

const LABEL_LINE = "export const EMPTY_LABEL = 'No notes yet';";
const FILTER_LINE = 'return notes.filter((note) => note.includes(query));';

type Page = typeof browserPage;

const stepItem = (page: Page, title: string) =>
  page.getByRole('listitem').filter({ hasText: title });

async function ready(page: Page) {
  await expect
    .element(
      page.getByRole('heading', {
        name: 'Find notes by title',
        exact: true,
      }),
    )
    .toBeVisible();
  return page;
}

test('a call shows its comparison as a table, and each excerpt opens its own saved lines', async ({
  render,
}) => {
  await blocksFixture();
  await browserPage.viewport(1280, 896);
  const page = await ready((await render.route('/')).page);
  const calls = page.getByRole('table');
  await expect
    .element(
      calls.getByRole('columnheader', { name: 'Show all notes', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      calls.getByRole('columnheader', { name: 'Show no notes', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      calls.getByRole('cell', {
        name: 'The first view stays quiet',
        exact: true,
      }),
    )
    .toBeVisible();

  const first = stepItem(page, 'Choose the empty search behavior');
  const labels = 'src/labels.ts · New line 1';
  const search = 'src/search.ts · New line 2';
  const labelLine = first.getByText(LABEL_LINE, { exact: true });
  const filterLine = first.getByText(FILTER_LINE, { exact: true });
  const hide = (location: string) =>
    first.getByRole('button', {
      name: `Hide the lines: ${location}`,
      exact: true,
    });
  const show = (location: string) =>
    first.getByRole('button', {
      name: `Show the lines: ${location}`,
      exact: true,
    });
  await expect.element(labelLine).toBeVisible();
  await expect.element(filterLine).toBeVisible();
  await expect
    .element(
      first.getByText('An empty list gets its own words.', { exact: true }),
    )
    .toBeVisible();
  await hide(labels).click();
  await expect.element(labelLine).not.toBeInTheDocument();
  await expect.element(filterLine).toBeVisible();
  await expect.element(show(labels)).toHaveFocus();
  await hide(search).click();
  await expect.element(filterLine).not.toBeInTheDocument();
  await show(labels).click();
  await expect.element(labelLine).toBeVisible();
  await expect.element(filterLine).not.toBeInTheDocument();
});

test('files open the file, checks list their results, and screenshots come as a before and after pair', async ({
  render,
}) => {
  const head = await blocksFixture();
  await browserPage.viewport(1280, 896);
  const app = await render.route('/');
  const page = await ready(app.page);
  const second = stepItem(page, 'Describe the result count');

  const checks = second.getByRole('region', {
    name: `Checks failing at ${head.slice(0, 7)}`,
    exact: true,
  });
  for (const [name, result] of [
    ['Unit tests', 'Passed'],
    ['Browser tests', 'Failed'],
    ['Lint', 'Running'],
    ['Docs', 'Skipped'],
  ] as const)
    await expect
      .element(
        checks
          .getByRole('listitem')
          .filter({ hasText: name })
          .getByRole('img', { name: result, exact: true }),
      )
      .toBeVisible();
  await expect
    .element(
      checks
        .getByRole('listitem')
        .filter({ hasText: 'Docs' })
        .getByText('Skipped', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      checks.getByText('More checks on the pull request', { exact: true }),
    )
    .toBeVisible();

  await second
    .getByRole('button', { name: 'Enlarge after screenshot', exact: true })
    .click();
  const enlarged = page.getByRole('dialog');
  await expect
    .element(
      enlarged.getByRole('heading', {
        name: 'After · Results with “3 notes found”',
        exact: true,
      }),
    )
    .toBeVisible();
  await enlarged
    .getByRole('button', { name: 'Previous screenshot', exact: true })
    .click();
  await expect
    .element(
      enlarged.getByRole('heading', {
        name: 'Before · Results without a count',
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      enlarged.getByText('This screenshot could not be loaded.', {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');

  await second
    .getByRole('list', { name: 'Files', exact: true })
    .getByRole('button', {
      name: 'src/results.ts Formats the number of matching notes.',
      exact: true,
    })
    .click();
  await expect
    .poll(() => decodeURIComponent(app.location()))
    .toContain('entry=file:src/results.ts');
});

test('a deleted file opens the comparison that shows its deletion', async ({
  render,
}) => {
  await blocksFixture();
  await browserPage.viewport(1280, 896);
  const app = await render.route('/');
  await ready(app.page);
  await app.navigate(
    `${app.location().split('?')[0]}?base=refs%2Fheads%2Fwalkthrough-blocks-base&entry=review`,
  );
  const page = await ready(app.page);
  const files = stepItem(page, 'Retire the old helpers').getByRole('list', {
    name: 'Files',
    exact: true,
  });
  await files
    .getByRole('button', {
      name: /^src\/legacy\.ts\b/,
      exact: true,
    })
    .click();
  await expect
    .poll(() => decodeURIComponent(app.location()))
    .toContain('entry=branch:src/legacy.ts');
  await page.getByRole('tab', { name: 'Review', exact: true }).click();
  await files
    .getByRole('button', {
      name: /^src\/obsolete\.ts\b/,
      exact: true,
    })
    .click();
  await expect
    .poll(() => decodeURIComponent(app.location()))
    .toContain('entry=change:src/obsolete.ts');
});

test('a file trimmed in the index and then deleted opens on its deletion', async ({
  render,
}) => {
  await blocksFixture();
  await browserPage.viewport(1280, 896);
  const app = await render.route('/');
  const page = await ready(app.page);
  await stepItem(page, 'Retire the old helpers')
    .getByRole('list', { name: 'Files', exact: true })
    .getByRole('button', {
      name: /^src\/drafts\.ts\b/,
      exact: true,
    })
    .click();
  await expect
    .poll(() => decodeURIComponent(app.location()))
    .toContain('entry=change:src/drafts.ts');
  await expect
    .element(
      page
        .getByRole('region', { name: 'Code content', exact: true })
        .getByText('Kept 1', { exact: true }),
    )
    .toBeInViewport();
});

test('a cited local file opens while the branch is still being compared', async ({
  render,
  fetchGate,
}) => {
  await blocksFixture();
  const held = fetchGate.holdNextBranchRead();
  held.arm();
  try {
    await browserPage.viewport(1280, 896);
    const app = await render.route('/');
    const page = await ready(app.page);
    await held.requested;
    const files = stepItem(page, 'Retire the old helpers').getByRole('list', {
      name: 'Files',
      exact: true,
    });
    await expect
      .element(
        files.getByRole('button', {
          name: /^src\/legacy\.ts\b/,
          exact: true,
        }),
      )
      .toBeDisabled();
    await files
      .getByRole('button', {
        name: /^notes\/scratch\.md\b/,
        exact: true,
      })
      .click();
    await expect
      .poll(() => decodeURIComponent(app.location()))
      .toContain('entry=file:notes/scratch.md');
  } finally {
    held.release();
  }
});
