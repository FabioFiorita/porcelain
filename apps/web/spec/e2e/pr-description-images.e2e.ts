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
![macOS bridge acknowledgement](./desktop-evidence/desktop-feedback-ack.png)
![Android acknowledgement preserves an unsent draft](./android-evidence/android-draft-ack.png)
![iPad landscape receipt](./ipad-evidence/ipad-landscape-ack.png)
![iPad portrait dark receipt](./ipad-evidence/ipad-portrait-dark.png)
![iPhone draft and keyboard during live acknowledgement](./iphone-evidence/iphone-draft-ack.png)
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
  await expect(
    article.getByText('Image unavailable: macOS bridge acknowledgement', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    article.getByText(
      'Image unavailable: Android acknowledgement preserves an unsent draft',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    article.getByText('Image unavailable: iPad landscape receipt', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    article.getByText('Image unavailable: iPad portrait dark receipt', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    article.getByText(
      'Image unavailable: iPhone draft and keyboard during live acknowledgement',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(article).not.toContainText('<details');
  await article.getByText('Screenshots', { exact: true }).click();
  await expect(
    article.getByRole('img', { name: 'HTML evidence', exact: true }),
  ).not.toBeVisible();
});
