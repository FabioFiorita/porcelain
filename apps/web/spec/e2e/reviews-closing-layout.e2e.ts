import { expect, test } from './fixtures.ts';

for (const width of [1440, 414]) {
  test(`closing paths stay readable and the last content clears the dock at ${width}px`, async ({
    page,
    app,
    repo,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const reviewId = await repo.closingPlaces();
    await app.open(await app.link('this'));
    await expect(page).not.toHaveURL(/\/pair(?:[#?]|$)/u);
    await page.goto(`/reviews/${reviewId}`);
    const review = page.getByRole('region', {
      name: 'Review walkthrough',
      exact: true,
    });
    await review
      .getByRole('button', { name: 'Not explained', exact: true })
      .click();
    const list = review.getByRole('list', {
      name: 'Unexplained lines in explained files',
      exact: true,
    });
    await expect(list.getByRole('listitem')).toHaveCount(15);
    const paths = list.getByText(
      /^apps\/server\/spec\/integration\/reviews-agent-feedback-\d+\.integration\.ts$/u,
    );
    await expect(paths).toHaveCount(15);
    for (const path of await paths.all()) {
      await expect(path).toHaveAttribute(
        'title',
        /^apps\/server\/spec\/integration\/reviews-agent-feedback-/u,
      );
      await expect
        .poll(async () => (await path.boundingBox())?.height)
        .toBe(16);
      await expect
        .poll(async () => (await path.boundingBox())?.width)
        .toBeGreaterThan(150);
    }
    const dock = review.getByRole('navigation', {
      name: 'Walkthrough dock',
      exact: true,
    });
    const lastRow = list.getByRole('listitem').last();
    await lastRow.evaluate((element) =>
      element.scrollIntoView({ block: 'start' }),
    );
    await expect
      .poll(async () => {
        const row = await lastRow.boundingBox();
        const viewport = await review.boundingBox();
        const bar = await dock.boundingBox();
        return row && viewport && bar
          ? row.y >= viewport.y && row.y + row.height < bar.y
          : false;
      })
      .toBe(true);
    await lastRow
      .getByRole('button', { name: 'Read in decision 1', exact: true })
      .click({ trial: true });
    await review.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const completion = review.getByRole('region', {
      name: 'Review completion',
      exact: true,
    });
    await expect
      .poll(async () => {
        const content = await completion.boundingBox();
        const bar = await dock.boundingBox();
        return content && bar ? content.y + content.height < bar.y : false;
      })
      .toBe(true);
    await completion
      .getByRole('button', { name: 'Ask the agent', exact: true })
      .click();
    await expect(completion.getByRole('textbox')).toBeVisible();
  });
}
