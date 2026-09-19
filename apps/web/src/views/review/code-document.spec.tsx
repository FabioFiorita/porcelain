import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
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
      onLineClick?: (line: unknown, context: { item: { id: string } }) => void;
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
          <button
            type="button"
            onClick={() => options.onLineClick?.({}, { item })}
          >
            Line in {item.id}
          </button>
        </section>
      ))}
    </div>
  ),
}));
vi.mock('../workspace/theme', () => ({
  useTheme: () => ({ dark: false }),
}));
vi.mock('../workspace/preferences', () => ({
  usePreferences: () => ({ preferences: preferenceState }),
}));

afterEach(() => {
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
    const screen = await render(<CodeDocument entries={entries} />);

    await expect
      .element(screen.getByTestId('diff:staged:README.md'))
      .toBeVisible();
    await expect
      .element(screen.getByTestId('diff:unstaged:README.md'))
      .toBeVisible();
    await screen
      .getByRole('button', { name: 'Collapse README.md' })
      .first()
      .click();

    expect(
      (await screen.getByTestId('diff:staged:README.md').element()).dataset
        .collapsed,
    ).toBe('true');
    expect(
      (await screen.getByTestId('diff:unstaged:README.md').element()).dataset
        .collapsed,
    ).toBe('false');
  });

  it('collapses and expands the complete document', async () => {
    const screen = await render(<CodeDocument entries={entries} />);

    await screen.getByRole('button', { name: 'Collapse all' }).click();
    expect(
      await Promise.all(
        entries.map(
          async (entry) =>
            (await screen.getByTestId(entry.id).element()).dataset.collapsed,
        ),
      ),
    ).toEqual(['true', 'true']);
    await screen.getByRole('button', { name: 'Expand all' }).click();
    expect(
      await Promise.all(
        entries.map(
          async (entry) =>
            (await screen.getByTestId(entry.id).element()).dataset.collapsed,
        ),
      ),
    ).toEqual(['false', 'false']);
  });

  it('passes the persisted code display preferences to Pierre', async () => {
    preferenceState.diffStyle = 'split';
    preferenceState.lineOverflow = 'wrap';
    const screen = await render(<CodeDocument entries={entries} />);

    const codeView = await screen.getByTestId('code-view').element();
    expect(codeView.dataset.diffStyle).toBe('split');
    expect(codeView.dataset.overflow).toBe('wrap');
  });

  it('keeps an empty document header scrollable without mounting CodeView', async () => {
    const screen = await render(
      <CodeDocument entries={[]} header={() => <div>Binary changes</div>} />,
    );

    const surface = await screen.getByTestId('empty-code-document').element();
    expect(surface.className).toContain('overflow-auto');
    await expect.element(screen.getByText('Binary changes')).toBeVisible();
    await expect
      .element(screen.getByTestId('code-view'))
      .not.toBeInTheDocument();
  });
});

describe('remembered review folds', () => {
  it('restores manual expansion of reviewed files and isolates documents', async () => {
    const { DocumentInteraction } = await import('./document-interaction');
    localStorage.clear();
    const entries: CodeEntry[] = ['a', 'b'].map((path) => ({
      id: path,
      kind: 'file',
      path,
      contents: path,
      version: 1,
      review: { path, control: null, reviewed: true },
    }));
    const ui = (key: string) => (
      <DocumentInteraction value={{ active: false, storageKey: key }}>
        <CodeDocument entries={entries} />
      </DocumentInteraction>
    );
    const view = await render(ui('folds-one'));
    expect((await view.getByTestId('a').element()).dataset.collapsed).toBe(
      'true',
    );
    await view.getByRole('button', { name: 'Expand a' }).click();
    expect((await view.getByTestId('a').element()).dataset.collapsed).toBe(
      'false',
    );
    await view.rerender(ui('folds-two'));
    expect((await view.getByTestId('a').element()).dataset.collapsed).toBe(
      'true',
    );
    await view.rerender(ui('folds-one'));
    expect((await view.getByTestId('a').element()).dataset.collapsed).toBe(
      'false',
    );
    await view.unmount();
    const restored = await render(ui('folds-one'));
    expect((await restored.getByTestId('a').element()).dataset.collapsed).toBe(
      'false',
    );
  });
  it('ignores malformed saved folds', async () => {
    const { DocumentInteraction } = await import('./document-interaction');
    localStorage.setItem(
      'bad-folds',
      JSON.stringify({ folded: ['a', 1], expanded: null }),
    );
    const screen = await render(
      <DocumentInteraction value={{ active: false, storageKey: 'bad-folds' }}>
        <CodeDocument
          entries={[
            { id: 'a', kind: 'file', path: 'a', contents: '', version: 0 },
          ]}
        />
      </DocumentInteraction>,
    );
    expect((await screen.getByTestId('a').element()).dataset.collapsed).toBe(
      'false',
    );
  });
});

it('reviews the file clicked in the code instead of the first file', async () => {
  const { DocumentInteraction } = await import('./document-interaction');
  const toggle = vi.fn();
  const entries: CodeEntry[] = ['first', 'second'].map((path) => ({
    id: path,
    path,
    kind: 'file',
    contents: path,
    version: 1,
  }));
  const screen = await render(
    <DocumentInteraction value={{ active: true }}>
      <CodeDocument entries={entries} onToggleReviewed={toggle} />
    </DocumentInteraction>,
  );
  await screen.getByRole('button', { name: 'Line in second' }).click();
  await userEvent.keyboard('r');
  expect(toggle).toHaveBeenCalledWith(entries[1]);
});
