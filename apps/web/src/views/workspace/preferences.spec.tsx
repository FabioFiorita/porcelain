import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { PreferencesProvider, usePreferences } from './preferences';

function PreferencesProbe() {
  const { preferences, resolvedTheme, setPreference } = usePreferences();
  return (
    <div>
      <output data-testid="pull-strategy">{preferences.pullStrategy}</output>
      <button
        type="button"
        onClick={() => setPreference('pullStrategy', 'rebase')}
      >
        Rebase
      </button>
      <output data-testid="appearance">{preferences.appearance}</output>
      <output data-testid="diff-style">{preferences.diffStyle}</output>
      <output data-testid="line-overflow">{preferences.lineOverflow}</output>
      <output data-testid="markdown-default">
        {preferences.markdownDefault}
      </output>
      <output data-testid="html-default">{preferences.htmlDefault}</output>
      <output data-testid="theme">{resolvedTheme}</output>
      <button type="button" onClick={() => setPreference('appearance', 'dark')}>
        Dark
      </button>
    </div>
  );
}

describe('PreferencesProvider', () => {
  it('restores supported device-local display preferences', async () => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    window.localStorage.setItem(
      'porcelain.prototype.preferences',
      JSON.stringify({
        pullStrategy: 'rebase',
        appearance: 'light',
        diffStyle: 'split',
        lineOverflow: 'wrap',
        markdownDefault: 'source',
        htmlDefault: 'source',
      }),
    );

    const screen = await render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>,
    );

    await expect
      .element(screen.getByTestId('pull-strategy'))
      .toHaveTextContent('rebase');
    await expect
      .element(screen.getByTestId('appearance'))
      .toHaveTextContent('light');
    await expect
      .element(screen.getByTestId('diff-style'))
      .toHaveTextContent('split');
    await expect
      .element(screen.getByTestId('line-overflow'))
      .toHaveTextContent('wrap');
    await expect
      .element(screen.getByTestId('markdown-default'))
      .toHaveTextContent('source');
    await expect
      .element(screen.getByTestId('html-default'))
      .toHaveTextContent('source');
    await expect
      .element(screen.getByTestId('theme'))
      .toHaveTextContent('light');
  });

  it('persists changes without involving the server', async () => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');

    const screen = await render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>,
    );

    await expect
      .element(screen.getByTestId('pull-strategy'))
      .toHaveTextContent('merge');
    await screen.getByRole('button', { name: 'Rebase' }).click();
    await screen.getByRole('button', { name: 'Dark' }).click();

    await expect
      .element(screen.getByTestId('appearance'))
      .toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      JSON.parse(
        window.localStorage.getItem('porcelain.prototype.preferences') ?? '{}',
      ),
    ).toMatchObject({
      pullStrategy: 'rebase',
      appearance: 'dark',
    });
  });
});
