import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import {
  readInventoryResponseSchema,
  registerProjectResponseSchema,
} from '@porcelain/contracts/projects';
import {
  publishReviewResponseSchema,
  readReviewResponseSchema,
  type PublishReviewRequest,
} from '@porcelain/contracts/reviews';
import { appRequest, expect, test } from './fixtures.ts';

const reviewId = '10000000-0000-4000-8000-000000000001';
const environment = '20000000-0000-4000-8000-000000000002';
const decision = '30000000-0000-4000-8000-000000000003';
const link = `porcelain-desktop://open/reviews/${reviewId}?environment=${environment}&host=computer.example.com&protocol=https&revision=3&decision=${decision}`;

test('a cold review link waits for the renderer and retains the remote destination for pairing', async ({
  desktop,
}) => {
  const app = await desktop.launch(undefined, [link]);
  const page = await app.window();
  await expect(
    page.getByText('Computer not paired', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${reviewId}/3?environment=${environment}&decision=${decision}`,
  );
  await page
    .getByRole('button', { name: 'Back to workspace', exact: true })
    .click();
  await expect(page).toHaveURL('porcelain://app/');
  expect(app.errors).toEqual([]);
});

test('a Mac open-url event uses this computer when the environment matches and rejects unsafe links @macos', async ({
  desktop,
}, testInfo) => {
  const app = await desktop.launch();
  const page = await app.window();
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await appRequest(page, 'GET', '/api/inventory'),
  );
  const project = Schema.decodeUnknownSync(registerProjectResponseSchema)(
    await appRequest(page, 'POST', '/api/projects', {
      path: desktop.repository,
    }),
  );
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree)
    throw new Error('The review link fixture has no main worktree');
  const localDecision = randomUUID();
  const published = Schema.decodeUnknownSync(publishReviewResponseSchema)(
    await appRequest(page, 'PUT', `/api/worktrees/${worktree.id}/review`, {
      expectedRevision: 0,
      verdict: {
        asked: { text: 'Open a published review through the Mac URL handler' },
        recommendation: 'merge',
        reasons: ['The requested decision is available on this computer'],
        notProven: [],
        removed: [],
      },
      summaryHtml: '<html><body>Desktop review link fixture</body></html>',
      layers: [
        {
          id: localDecision,
          title: 'Desktop review link decision',
          summary: 'Open the published review on this computer.',
          lanes: ['Docs'],
          steps: [
            {
              id: randomUUID(),
              lane: 0,
              title: 'Read the published README',
              text: 'Keep the local review destination.',
              kind: 'context',
              pointer: { path: 'README.md', startLine: 1, endLine: 1 },
            },
          ],
        },
      ],
    } satisfies PublishReviewRequest),
  );
  const local = `porcelain-desktop://open/reviews/${published.reviewId}?environment=${inventory.environmentId}&host=localhost&revision=${published.revision}&decision=${localDecision}`;
  await app.electron.evaluate(({ app }, url) => {
    app.emit('open-url', { preventDefault() {} }, url);
  }, local);
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${published.reviewId}/${published.revision}?decision=${localDecision}`,
  );
  await expect(
    page.getByText('Computer not paired', { exact: true }),
  ).toBeHidden();
  const shown = page.getByRole('region', {
    name: '1. Desktop review link decision',
    exact: true,
  });
  await expect(shown).toContainText(
    'Open the published review on this computer.',
  );
  const saved = Schema.decodeUnknownSync(readReviewResponseSchema)(
    await appRequest(
      page,
      'GET',
      `/api/reviews/${published.reviewId}/revisions/${published.revision}`,
    ),
  );
  expect(saved.review?.reviewId).toBe(published.reviewId);
  expect(saved.revision?.revision).toBe(published.revision);
  expect(saved.revision?.content.layers[0]?.id).toBe(localDecision);
  await app.electron.evaluate(({ app }, url) => {
    app.emit('open-url', { preventDefault() {} }, `${url}&host=evil.com`);
    app.emit(
      'open-url',
      { preventDefault() {} },
      'porcelain-desktop://app/settings',
    );
  }, local);
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${published.reviewId}/${published.revision}?decision=${localDecision}`,
  );
  await expect(shown).toContainText(
    'Open the published review on this computer.',
  );
  await page.screenshot({ path: testInfo.outputPath('local-review-link.png') });
  expect(app.errors).toEqual([]);
});

test('a real second process delivers its review URL to the existing window', async ({
  desktop,
}) => {
  const app = await desktop.launch();
  const page = await app.window();
  await expect(
    page.getByRole('button', { name: 'Settings', exact: true }),
  ).toBeVisible();
  expect(await desktop.launchSecondInstance(link)).toBe(0);
  await expect(
    page.getByText('Computer not paired', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    `porcelain://app/reviews/${reviewId}/3?environment=${environment}&decision=${decision}`,
  );
  expect(
    await app.electron.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
  expect(app.errors).toEqual([]);
});
