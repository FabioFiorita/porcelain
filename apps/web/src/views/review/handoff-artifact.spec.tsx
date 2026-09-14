// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentRef } from '../../domain/documents';
import { HandoffSummary } from './handoff-artifact';

const state = vi.hoisted(() => ({
  artifacts: [
    {
      id: 'afa08127-5c27-46bf-9d06-e8401f2aa101',
      worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
      name: 'handoff.md',
      sizeBytes: 74,
      createdAt: '2026-09-12T15:20:00Z',
    },
    {
      id: 'afa08127-5c27-46bf-9d06-e8401f2aa102',
      worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
      name: 'handoff.html',
      sizeBytes: 120,
      createdAt: '2026-09-12T15:20:00Z',
    },
    {
      id: 'afa08127-5c27-46bf-9d06-e8401f2aa103',
      worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
      name: 'notes.txt',
      sizeBytes: 20,
      createdAt: '2026-09-12T15:20:00Z',
    },
  ],
  content: {
    id: 'afa08127-5c27-46bf-9d06-e8401f2aa101',
    worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
    name: 'handoff.md',
    sizeBytes: 74,
    createdAt: '2026-09-12T15:20:00Z',
    content: 'A short summary.\n\n**Verification**\n\n- ✓ checks pass',
  },
}));

vi.mock('../../query/review', () => ({
  useArtifacts: () => state.artifacts,
  useArtifactContents: () => [state.content],
}));
vi.mock('./markdown-view', () => ({
  MarkdownView: ({ text }: { text: string }) => <div>{text}</div>,
}));

afterEach(cleanup);

describe('handoff summary', () => {
  it('renders handoff markdown, timestamp, reading order, and UUID actions', async () => {
    const onOpen = vi.fn<(ref: DocumentRef) => void>();
    const user = userEvent.setup();

    render(
      <HandoffSummary
        scope={{
          projectId: '621a8628-1cd6-4562-81a2-9c05fba76b4c',
          worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
        }}
        layers={[
          {
            id: 'bf4f1c6b-2b54-423b-a9b5-7c40112b3101',
            title: 'A clearer review experience',
            files: [{ path: 'README.md', scope: 'staged' }],
          },
        ]}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByText(/Verification/)).toBeTruthy();
    expect(screen.getByText('Read in this order')).toBeTruthy();
    expect(screen.getByText('A clearer review experience')).toBeTruthy();
    expect(screen.getByRole('time').getAttribute('dateTime')).toBe(
      '2026-09-12T15:20:00Z',
    );

    await user.click(screen.getByRole('button', { name: 'Open report' }));
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'artifact',
      artifactId: 'afa08127-5c27-46bf-9d06-e8401f2aa102',
    });
    await user.click(
      screen.getByRole('button', { name: /A clearer review experience/ }),
    );
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'layer',
      layerId: 'bf4f1c6b-2b54-423b-a9b5-7c40112b3101',
    });
    await user.click(screen.getByRole('button', { name: /notes.txt/ }));
    expect(onOpen).toHaveBeenCalledWith({
      kind: 'artifact',
      artifactId: 'afa08127-5c27-46bf-9d06-e8401f2aa103',
    });
  });
});
