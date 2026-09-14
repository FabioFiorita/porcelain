// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentView } from './documents';

const fileState = vi.hoisted(() => ({
  text: '# A document',
  byteLength: 12,
}));
const preferenceState = vi.hoisted(() => ({
  markdownDefault: 'reader' as 'reader' | 'source',
  htmlDefault: 'preview' as 'preview' | 'source',
}));

vi.mock('../../query/review', () => ({
  useTextFile: () => fileState,
  useChanges: () => ({ status: { changes: [] } }),
}));
vi.mock('../workspace/preferences', () => ({
  usePreferences: () => ({ preferences: preferenceState }),
}));
vi.mock('./file-comments', () => ({
  FileComments: () => null,
}));
vi.mock('./markdown-view', () => ({
  MarkdownView: ({ text }: { text: string }) => (
    <div data-testid="markdown-reader">{text}</div>
  ),
}));
vi.mock('./pierre-preview', () => ({
  SourcePreview: ({ path, contents }: { path: string; contents: string }) => (
    <pre data-testid="source-view">{`${path}\n${contents}`}</pre>
  ),
}));
vi.mock('./html-frame', () => ({
  HtmlFrame: ({ html }: { html: string }) => (
    <div data-testid="html-preview">{html}</div>
  ),
}));

const scope = {
  projectId: 'project',
  worktreeId: 'worktree',
};

function renderFile(path: string) {
  return render(
    <DocumentView
      scope={scope}
      document={{ kind: 'file', path }}
      onOpen={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  preferenceState.markdownDefault = 'reader';
  preferenceState.htmlDefault = 'preview';
});

describe('file document display defaults', () => {
  it('opens markdown according to the persisted reader/source default', () => {
    preferenceState.markdownDefault = 'source';
    renderFile('README.md');

    expect(screen.getByTestId('source-view')).toBeTruthy();
    expect(screen.queryByTestId('markdown-reader')).toBeNull();
  });

  it('opens HTML according to the persisted preview/source default', () => {
    preferenceState.htmlDefault = 'preview';
    renderFile('docs/index.html');

    expect(screen.getByTestId('html-preview')).toBeTruthy();
    expect(screen.queryByTestId('source-view')).toBeNull();
  });

  it('lets the reader switch to source without changing the default', async () => {
    const user = userEvent.setup();
    renderFile('README.md');

    expect(screen.getByTestId('markdown-reader')).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Source' }));
    expect(screen.getByTestId('source-view')).toBeTruthy();
    expect(screen.queryByTestId('markdown-reader')).toBeNull();
  });
});
