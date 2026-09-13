// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiffPreview, SourcePreview } from './pierre-preview';

const themeState = vi.hoisted(() => ({ dark: false }));

vi.mock('@pierre/diffs/react', () => ({
  File: ({
    file,
    options,
  }: {
    file: { name: string; contents: string };
    options: { themeType: string };
  }) => (
    <pre data-testid="pierre-file" data-theme={options.themeType}>
      {`${file.name}\n${file.contents}`}
    </pre>
  ),
  PatchDiff: ({ patch }: { patch: string }) => (
    <pre data-testid="pierre-diff">{patch}</pre>
  ),
  Virtualizer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pierre-virtualizer">{children}</div>
  ),
}));
vi.mock('../workspace/theme', () => ({
  useTheme: () => ({ dark: themeState.dark, toggle: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  themeState.dark = false;
});

describe('Pierre previews', () => {
  it('updates a source file when its contents change without changing length', () => {
    const preview = render(
      <SourcePreview path="src/example.ts" contents="const a = 1;" />,
    );

    preview.rerender(
      <SourcePreview path="src/example.ts" contents="const a = 2;" />,
    );

    expect(screen.getByTestId('pierre-file').textContent).toBe(
      'src/example.ts\nconst a = 2;',
    );
  });

  it('updates a patch when its contents change without changing length', () => {
    const preview = render(<DiffPreview patch={'-old\n+one'} />);

    preview.rerender(<DiffPreview patch={'-old\n+two'} />);

    expect(screen.getByTestId('pierre-diff').textContent).toBe('-old\n+two');
  });

  it('virtualizes large-capable surfaces and handles an empty patch', () => {
    const preview = render(
      <SourcePreview path="src/example.ts" contents="export {};" />,
    );
    expect(screen.getByTestId('pierre-virtualizer')).toBeTruthy();

    preview.rerender(<DiffPreview patch="" />);

    expect(
      screen.getByRole('region', { name: 'Read-only diff' }).textContent,
    ).toBe('No textual changes remain.');
    expect(screen.queryByTestId('pierre-diff')).toBeNull();
  });

  it('passes an explicit app theme to Pierre', () => {
    const preview = render(
      <SourcePreview path="src/example.ts" contents="export {};" />,
    );
    expect(screen.getByTestId('pierre-file').dataset.theme).toBe('light');

    themeState.dark = true;
    preview.rerender(
      <SourcePreview path="src/example.ts" contents="export {};" />,
    );

    expect(screen.getByTestId('pierre-file').dataset.theme).toBe('dark');
  });
});
