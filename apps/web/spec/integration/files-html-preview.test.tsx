import { expect, test, type Render, type Repo } from './fixtures.tsx';

async function openPage(
  render: Render,
  repo: Repo,
  html = '<!doctype html><html><body><h1>Preview heading</h1><img src="logo.svg" alt="Preview logo"><img src="missing.png" alt="Missing picture"></body></html>\n',
) {
  await repo.write(
    'logo.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="teal"/></svg>\n',
  );
  await repo.write('page.html', html);
  const opened = await render.workspace();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await opened
    .getByRole('treeitem', { name: 'page.html', exact: true })
    .click();
  return opened;
}

test('an HTML page opened from the file tree previews with its local images and names the ones it could not load', async ({
  render,
  repo,
}) => {
  const opened = await openPage(render, repo);
  await expect
    .element(opened.getByLabelText('page.html HTML preview', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      opened.getByText(
        'Some assets could not be loaded: missing.png. This preview supports local static assets.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await expect
    .element(opened.getByRole('tab', { name: 'Preview', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(opened.getByText(/could not be loaded: .*logo\.svg/))
    .not.toBeInTheDocument();
});

test.for([
  { name: 'an empty document', html: '', missing: '' },
  {
    name: 'external resources',
    html: '<img src="https://audit-exfil.invalid/picture"><script src="https://audit-exfil.invalid/script"></script>',
    missing:
      'https://audit-exfil.invalid/picture, https://audit-exfil.invalid/script',
  },
])(
  'an HTML preview renders $name and reports unavailable assets',
  async ({ html, missing }, { render, repo }) => {
    const page = await openPage(render, repo, html);
    await expect
      .element(page.getByLabelText('page.html HTML preview', { exact: true }))
      .toBeVisible();
    if (missing) {
      await expect
        .element(
          page.getByText(
            `Some assets could not be loaded: ${missing}. This preview supports local static assets.`,
            { exact: true },
          ),
        )
        .toBeVisible();
    } else {
      await expect
        .element(page.getByText(/^Some assets could not be loaded/))
        .not.toBeInTheDocument();
    }
  },
);

test('switching the HTML page to its source shows the markup instead of the preview', async ({
  render,
  repo,
}) => {
  const page = await openPage(render, repo);
  const source = page.getByRole('tab', { name: 'Source', exact: true });
  await source.click();
  await expect.element(source).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(page.getByText(/<h1>Preview heading<\/h1>/))
    .toBeVisible();
  await expect
    .element(page.getByText(/^Some assets could not be loaded/))
    .not.toBeInTheDocument();
});
