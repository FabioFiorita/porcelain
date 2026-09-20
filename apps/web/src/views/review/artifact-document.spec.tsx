import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ArtifactDocument } from './artifact-document';

const state = vi.hoisted(() => ({
  artifact: {
    id: 'afa08127-5c27-46bf-9d06-e8401f2aa102',
    worktreeId: '629a86281cd6456281a29c05fba76b4b',
    name: 'handoff.html',
    sizeBytes: 120,
    createdAt: '2026-09-12T15:20:00Z',
  },
  content: {
    id: 'afa08127-5c27-46bf-9d06-e8401f2aa102',
    worktreeId: '629a86281cd6456281a29c05fba76b4b',
    name: 'handoff.html',
    sizeBytes: 120,
    createdAt: '2026-09-12T15:20:00Z',
    content: '<h1>Report</h1>',
  },
}));

vi.mock('../../query/review', () => ({
  useArtifacts: () => [state.artifact],
  useArtifactContents: () => [state.content],
}));
vi.mock('./html-frame', () => ({
  HtmlFrame: ({ html, title }: { html: string; title: string }) => (
    <div data-testid="html-preview" title={title}>
      {html}
    </div>
  ),
}));

describe('artifact document', () => {
  it('keeps report content directly under the compact toolbar', async () => {
    const screen = await render(
      <ArtifactDocument
        scope={{ projectId: 'project', worktreeId: state.artifact.worktreeId }}
        artifactId={state.artifact.id}
      />,
    );

    await expect
      .element(screen.getByRole('heading', { name: 'Report' }))
      .toBeVisible();
    await expect
      .element(screen.getByTestId('html-preview'))
      .toHaveTextContent('<h1>Report</h1>');
    await expect.element(screen.getByText('Created')).not.toBeInTheDocument();
    await expect.element(screen.getByText('Format')).not.toBeInTheDocument();
  });
});
