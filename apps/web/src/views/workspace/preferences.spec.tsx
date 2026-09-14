// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PreferencesProvider, usePreferences } from './preferences';

function PreferencesProbe() {
  const { preferences, resolvedTheme, setPreference } = usePreferences();
  return (
    <div>
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

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => cleanup());

describe('PreferencesProvider', () => {
  it('restores supported device-local display preferences', () => {
    window.localStorage.setItem(
      'porcelain.prototype.preferences',
      JSON.stringify({
        appearance: 'light',
        diffStyle: 'split',
        lineOverflow: 'wrap',
        markdownDefault: 'source',
        htmlDefault: 'source',
      }),
    );

    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>,
    );

    expect(screen.getByTestId('appearance').textContent).toBe('light');
    expect(screen.getByTestId('diff-style').textContent).toBe('split');
    expect(screen.getByTestId('line-overflow').textContent).toBe('wrap');
    expect(screen.getByTestId('markdown-default').textContent).toBe('source');
    expect(screen.getByTestId('html-default').textContent).toBe('source');
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('persists changes without involving the server', () => {
    render(
      <PreferencesProvider>
        <PreferencesProbe />
      </PreferencesProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(screen.getByTestId('appearance').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      JSON.parse(
        window.localStorage.getItem('porcelain.prototype.preferences') ?? '{}',
      ),
    ).toMatchObject({
      appearance: 'dark',
    });
  });
});
