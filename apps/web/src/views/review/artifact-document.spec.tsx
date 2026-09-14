// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtifactDocument } from './artifact-document';

const state = vi.hoisted(() => ({
  artifact: {
    id: 'afa08127-5c27-46bf-9d06-e8401f2aa102',
    worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
    name: 'handoff.html',
    sizeBytes: 120,
    createdAt: '2026-09-12T15:20:00Z',
  },
  content: {
    id: 'afa08127-5c27-46bf-9d06-e8401f2aa102',
    worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
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

afterEach(cleanup);

describe('artifact document', () => {
  it('keeps report content directly under the compact toolbar', () => {
    render(
      <ArtifactDocument
        scope={{ projectId: 'project', worktreeId: state.artifact.worktreeId }}
        artifactId={state.artifact.id}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Report' })).toBeTruthy();
    expect(screen.getByTestId('html-preview').textContent).toBe(
      '<h1>Report</h1>',
    );
    expect(screen.queryByText('Created')).toBeNull();
    expect(screen.queryByText('Format')).toBeNull();
  });
});
