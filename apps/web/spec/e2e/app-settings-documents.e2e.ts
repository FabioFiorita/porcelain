import { seedPreferences, savedPreferences } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

for (const legacy of ['markdownDefault', 'htmlDefault']) {
  test(`a browser with ${legacy} Source migrates to one document choice and persists Rendered`, async ({
    pairedPage,
    app,
  }) => {
    await seedPreferences(pairedPage, {
      [legacy]: 'source',
      appearance: 'light',
    });
    await app.follow('/settings/general');
    const documents = pairedPage.getByRole('tablist', {
      name: 'Documents open as',
      exact: true,
    });
    await expect(
      documents.getByRole('tab', { name: 'Source', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      pairedPage.getByText('Markdown opens as', { exact: true }),
    ).not.toBeAttached();
    await expect(
      pairedPage.getByText('HTML opens as', { exact: true }),
    ).not.toBeAttached();
    await expect(
      pairedPage.getByRole('switch', { name: 'Spec files', exact: true }),
    ).not.toBeAttached();
    await documents.getByRole('tab', { name: 'Rendered', exact: true }).click();
    await expect
      .poll(() => savedPreferences(pairedPage))
      .toMatchObject({ documentsDefault: 'rendered', appearance: 'light' });
    await app.reload();
    await expect(
      documents.getByRole('tab', { name: 'Rendered', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await pairedPage
      .getByRole('button', { name: 'Reviews & Git', exact: true })
      .click();
    await expect(
      pairedPage.getByRole('switch', { name: 'Spec files', exact: true }),
    ).toBeVisible();
    await expect(
      pairedPage.getByText('Commit model', { exact: true }),
    ).not.toBeAttached();
  });
}

for (const section of ['devices', 'integrations']) {
  test(`old ${section} links redirect to This computer and preserve the way back`, async ({
    pairedPage,
    app,
  }) => {
    await app.follow(`/settings/${section}`);
    await expect(pairedPage).toHaveURL(/\/settings\/computers\/this-computer$/);
    const settings = pairedPage.getByRole('main', {
      name: 'Settings',
      exact: true,
    });
    await expect(
      settings.getByText('Pair a device', { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByText('Porcelain MCP server', { exact: true }),
    ).toBeVisible();
    await settings.getByRole('tab', { name: 'Codex', exact: true }).click();
    await expect(settings.getByRole('status')).toHaveText(
      'codex mcp add porcelain -- porcelain mcp',
    );
    await settings
      .getByRole('tab', { name: 'Claude Code', exact: true })
      .click();
    await expect(settings.getByRole('status')).toHaveText(
      'claude mcp add porcelain -- porcelain mcp',
    );
    await settings
      .getByRole('button', { name: 'Close Settings', exact: true })
      .click();
    await expect(pairedPage).toHaveURL(/\/settings\/computers$/);
  });
}
