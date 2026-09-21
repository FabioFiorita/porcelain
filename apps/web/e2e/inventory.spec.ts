import { expect, test } from '@playwright/test';
import { pairBrowser, revokeDevice } from './playground';
import { openNavigation } from './workspace-navigation';

test('connects to real Git inventory and persists file feedback', async ({
  page,
}) => {
  // Nothing reaches the API before this browser is paired.
  expect((await page.request.get('/api/inventory')).status()).toBe(401);
  await pairBrowser(page);
  const inventoryResponse = await page.request.get('/api/inventory');
  expect(inventoryResponse.ok()).toBe(true);
  const inventory = await inventoryResponse.json();
  await openNavigation(page);
  const navigator = page.getByRole('navigation', {
    name: 'Projects and worktrees',
  });
  await expect(navigator).toBeVisible();
  for (const project of inventory.projects) {
    await expect(
      navigator.getByRole('heading', { name: project.name, exact: true }),
    ).toBeVisible();
    for (const worktree of project.worktrees) {
      await expect(
        navigator.getByRole('button').filter({ hasText: worktree.path }),
      ).toBeVisible();
    }
  }
  const review = inventory.projects[0].worktrees.find(
    (entry: { main: boolean }) => !entry.main,
  );
  await navigator.getByRole('button').filter({ hasText: review.path }).click();
  const openReview = page.getByRole('button', { name: 'Review', exact: true });
  if (await openReview.isVisible()) await openReview.click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page.getByRole('treeitem', { name: 'README.md', exact: true }).click();
  await expect(page.getByTestId('review-document')).toContainText('Porcelain');
  const feedback = `File feedback ${crypto.randomUUID()}`;
  await page
    .getByRole('button', {
      name: 'Comment on README.md (staged · modified)',
      exact: true,
    })
    .click();
  await page.getByLabel('Comment', { exact: true }).fill(feedback);
  // The textarea's 3px focus ring must fit inside every clipping ancestor.
  const focusRingFits = await page
    .getByLabel('Comment', { exact: true })
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      for (const ancestor of ancestorElements(element)) {
        const style = getComputedStyle(ancestor);
        if (!['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX))
          continue;
        const clip = ancestor.getBoundingClientRect();
        if (bounds.left - 3 < clip.left || bounds.right + 3 > clip.right)
          return false;
      }
      return true;
      function* ancestorElements(node: Element): Generator<Element> {
        for (
          let parent = node.parentElement;
          parent;
          parent = parent.parentElement
        )
          yield parent;
      }
    });
  expect(focusRingFits).toBe(true);
  await page
    .locator('form')
    .filter({
      has: page.getByRole('textbox', { name: 'Comment', exact: true }),
    })
    .getByRole('button', { name: 'Comment', exact: true })
    .click();
  await expect(page.getByText(feedback, { exact: true })).toBeVisible();
  const commentsResponse = await page.request.get(
    `/api/worktrees/${review.id}/comments`,
  );
  expect(commentsResponse.ok()).toBe(true);
  expect(await commentsResponse.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        anchor: {
          kind: 'file',
          filePath: 'README.md',
          comparison: { kind: 'worktree', scope: 'staged' },
          contentFingerprint: expect.any(String),
        },
        messages: expect.arrayContaining([
          expect.objectContaining({ body: feedback }),
        ]),
      }),
    ]),
  );
  await openNavigation(page);
  await expect(
    navigator.getByRole('button').filter({ hasText: review.path }),
  ).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Disconnect', 'Exit', 'Reload', 'Refresh']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
      0,
    );
  }
  const device = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'porcelain_device',
  );
  expect(device?.httpOnly).toBe(true);
  expect(device?.expires).toBeGreaterThan(Date.now() / 1000);
  const credential = device?.value;
  expect(credential).toBeTruthy();
  // HttpOnly means the page cannot read it, so nothing it can reach holds it.
  expect(
    await page.evaluate(() =>
      JSON.stringify([localStorage, sessionStorage, document.cookie]),
    ),
  ).not.toContain(credential);
  await page.reload();
  await openNavigation(page);
  await expect(navigator).toBeVisible();
});

test('shows empty and unavailable inventory and recovers on a later live notice', async ({
  page,
}) => {
  // Pair against the real server first: the id below has to be this
  // installation's own, or the browser would refuse the link.
  await pairBrowser(page);
  const { environmentId } = (await (
    await page.request.get('/api/inventory')
  ).json()) as { environmentId: string };
  const empty = { environmentId, projects: [] };
  const unavailable = {
    environmentId,
    projects: [
      {
        id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
        name: 'Missing project',
        available: false,
        worktrees: [
          {
            id: '801a86281cd6456281a29c05fba76b4a',
            path: '/fixture/missing',
            main: false,
            branch: null,
            available: false,
            status: 'pending',
          },
        ],
      },
    ],
  };
  let liveSocket: import('@playwright/test').WebSocketRoute | undefined;
  await page.routeWebSocket('**/api/live', (socket) => {
    liveSocket = socket;
    socket.connectToServer();
  });
  const refreshInventory = async () => {
    await expect.poll(() => Boolean(liveSocket)).toBe(true);
    liveSocket?.send(JSON.stringify({ type: 'inventory' }));
  };
  // Listing is the only inventory endpoint now, so one handler answers every
  // ask and this variable is what the next one gets: empty, then a failure,
  // then a project that is there but unreachable.
  let answer: { json: unknown } | { status: number; body: string } = {
    json: empty,
  };
  await page.route(
    (url) => url.pathname === '/api/inventory',
    (route) => route.fulfill(answer),
  );
  await page.route(
    (url) => url.pathname === '/api/session',
    (route) => route.fulfill({ json: empty }),
  );
  await page.reload();
  await openNavigation(page);
  await expect(page.getByText('No projects registered')).toBeVisible();
  answer = { status: 503, body: '{}' };
  const failed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/inventory',
  );
  await refreshInventory();
  expect((await failed).status()).toBe(503);
  // A failed listing must not empty the sidebar of what it last knew; here
  // the last thing it knew was that there is nothing.
  await expect(page.getByText('No projects registered')).toBeVisible();
  answer = { json: unavailable };
  await refreshInventory();
  const worktree = page.getByRole('button', { name: /Detached HEAD/ });
  await expect(worktree).toContainText('Unavailable');
  // Its dot came with the list: review data outlives the checkout it is about.
  await expect(worktree.getByTitle('Waiting for your review')).toBeAttached();
  await worktree.click();
  await expect(page).toHaveURL(/worktree=801a8628/);
  await expect(worktree).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('No changes to review')).toBeVisible();
});

test('revoking the device ends a connection in a page already open', async ({
  page,
  context,
}) => {
  const { label } = await pairBrowser(page);
  await openNavigation(page);
  await expect(
    page.getByRole('navigation', { name: 'Projects and worktrees' }),
  ).toBeVisible();
  // The owner revokes from their terminal, with the page still on screen.
  await revokeDevice(label);
  // No reload: the refusal ends the connection and takes the private data it
  // had loaded with it.
  await expect(
    page.getByRole('heading', { name: 'This browser is not paired' }),
  ).toBeVisible();
  // The cookie is still in the jar; it is simply no longer a credential.
  expect(
    (await context.cookies()).some((c) => c.name === 'porcelain_device'),
  ).toBe(true);
  expect((await page.request.get('/api/inventory')).status()).toBe(401);
});
