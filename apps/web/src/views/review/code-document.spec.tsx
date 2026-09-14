// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeDocument, type CodeEntry } from './code-document';

const preferenceState = vi.hoisted(() => ({
  diffStyle: 'unified' as 'unified' | 'split',
  lineOverflow: 'scroll' as 'scroll' | 'wrap',
}));

vi.mock('@pierre/diffs/react', () => ({
  CodeView: ({
    items,
    options,
    renderHeaderPrefix,
  }: {
    items: Array<{ id: string; collapsed?: boolean }>;
    options: {
      themeType: string;
      overflow?: string;
      diffStyle?: string;
    };
    renderHeaderPrefix: (item: { id: string }) => React.ReactNode;
  }) => (
    <div
      data-testid="code-view"
      data-theme={options.themeType}
      data-overflow={options.overflow}
      data-diff-style={options.diffStyle}
    >
      {items.map((item) => (
        <section
          key={item.id}
          data-testid={item.id}
          data-collapsed={String(item.collapsed)}
        >
          {renderHeaderPrefix(item)}
        </section>
      ))}
    </div>
  ),
}));
vi.mock('../workspace/theme', () => ({
  useTheme: () => ({ dark: false, toggle: vi.fn() }),
}));
vi.mock('../workspace/preferences', () => ({
  usePreferences: () => ({ preferences: preferenceState }),
}));

afterEach(() => {
  cleanup();
  preferenceState.diffStyle = 'unified';
  preferenceState.lineOverflow = 'scroll';
});

describe('continuous code document', () => {
  const entries: CodeEntry[] = [
    {
      id: 'diff:staged:README.md',
      kind: 'file',
      path: 'README.md',
      contents: 'staged evidence',
      version: 10,
      note: 'staged',
    },
    {
      id: 'diff:unstaged:README.md',
      kind: 'file',
      path: 'README.md',
      contents: 'unstaged evidence',
      version: 20,
      note: 'unstaged',
    },
  ];

  it('keeps same-path evidence as separately collapsible items', async () => {
    render(<CodeDocument entries={entries} />);
    const user = userEvent.setup();

    expect(screen.getByTestId('diff:staged:README.md')).toBeTruthy();
    expect(screen.getByTestId('diff:unstaged:README.md')).toBeTruthy();
    const firstCollapse = screen.getAllByRole('button', {
      name: 'Collapse README.md',
    })[0];
    if (!firstCollapse) throw new Error('Missing staged evidence control');
    await user.click(firstCollapse);

    expect(screen.getByTestId('diff:staged:README.md').dataset.collapsed).toBe(
      'true',
    );
    expect(
      screen.getByTestId('diff:unstaged:README.md').dataset.collapsed,
    ).toBe('false');
  });

  it('collapses and expands the complete document', async () => {
    render(<CodeDocument entries={entries} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(
      entries.map((entry) => screen.getByTestId(entry.id).dataset.collapsed),
    ).toEqual(['true', 'true']);
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(
      entries.map((entry) => screen.getByTestId(entry.id).dataset.collapsed),
    ).toEqual(['false', 'false']);
  });

  it('passes the persisted code display preferences to Pierre', () => {
    preferenceState.diffStyle = 'split';
    preferenceState.lineOverflow = 'wrap';
    render(<CodeDocument entries={entries} />);

    const codeView = screen.getByTestId('code-view');
    expect(codeView.dataset.diffStyle).toBe('split');
    expect(codeView.dataset.overflow).toBe('wrap');
  });

  it('keeps an empty document header scrollable without mounting CodeView', () => {
    render(
      <CodeDocument entries={[]} header={() => <div>Binary changes</div>} />,
    );

    const surface = screen.getByTestId('empty-code-document');
    expect(surface.className).toContain('overflow-auto');
    expect(screen.getByText('Binary changes')).toBeTruthy();
    expect(screen.queryByTestId('code-view')).toBeNull();
  });
});
