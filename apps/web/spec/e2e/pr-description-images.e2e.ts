import { expect, test } from './fixtures.ts';
import { markdownImageState } from '../kit/markdown-images.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';

test('PR evidence discloses safe HTML and loads Markdown and HTML images', async ({
  pairedPage: page,
  server,
}) => {
  const main = (await server.project()).worktrees.find((row) => row.main)?.path;
  if (!main) throw new Error('Missing main checkout');
  const image = new URL('/favicon-32.png', page.url()).href;
  const missing = new URL('/missing-evidence.png', page.url()).href;
  const fixture = await archiveFixture(main, {
    description: `### Evidence
<details open onclick="alert(1)">
<summary>Screenshots</summary>
<img alt="HTML evidence" src="${image}" onerror="alert(1)" />
![Markdown evidence](${image})
![Missing evidence](${missing})
</details>
<script>window.prUnsafe = true</script>
<iframe src="https://images.example.test/frame"></iframe>
<a href="javascript:alert(1)">Unsafe link</a>`,
  });
  await page.goto(
    `/reviews/${fixture.reviewId}?entry=pull-request:${fixture.reviewId}:423`,
  );
  const article = page.getByRole('article', {
    name: 'Pull request #423',
    exact: true,
  });
  await expect(article).toBeVisible();
  await expect
    .poll(() => markdownImageState(page))
    .toMatchObject({ open: false, unsafe: 0 });
  await article.getByText('Screenshots', { exact: true }).click();
  await expect(
    article.getByRole('img', { name: 'HTML evidence', exact: true }),
  ).toBeVisible();
  await expect(
    article.getByRole('img', { name: 'Markdown evidence', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => markdownImageState(page))
    .toMatchObject({
      open: true,
      unsafe: 0,
      images: [
        { alt: 'HTML evidence', width: 32, fits: true },
        { alt: 'Markdown evidence', width: 32, fits: true },
      ],
    });
  await expect(
    article.getByText('Image unavailable: Missing evidence', { exact: true }),
  ).toBeVisible();
  await expect(article).not.toContainText('<details');
  await article.getByText('Screenshots', { exact: true }).click();
  await expect(
    article.getByRole('img', { name: 'HTML evidence', exact: true }),
  ).not.toBeVisible();
});
