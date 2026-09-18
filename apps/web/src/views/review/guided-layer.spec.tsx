import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import type { ReviewGuide } from '../../domain/guided-review';
import { guidePositionKey } from '../../domain/guided-review';
import type { ReviewScope } from '../../domain/review';
import type { CodeEntry } from './code-document';
import { useDocumentInteraction } from './document-interaction';
import { GuidedLayerDocument } from './guided-layer';

const state = vi.hoisted(() => ({
  fingerprint: 'a'.repeat(64),
  missing: false,
}));
vi.mock('../../query/guided-review', () => ({
  useGuidePositionKey: (scope: ReviewScope, id: string) =>
    guidePositionKey('fixture-environment', scope, id),
  useGuideSource: (scope: ReviewScope, path: string) =>
    state.missing
      ? { kind: 'unavailable', message: 'Source is missing.' }
      : {
          kind: 'ready',
          file: {
            worktreeId: scope.worktreeId,
            path,
            encoding: 'utf-8',
            text: `${path}\nconst owner = existingState;\nreturn owner;\n`,
            byteLength: 64,
            contentFingerprint: state.fingerprint,
          },
        },
}));
vi.mock('./code-document', () => ({
  CodeDocument: ({ entries }: { entries: readonly CodeEntry[] }) => {
    const { reveal } = useDocumentInteraction();
    return (
      <div>
        <pre aria-label="Source content">
          {entries[0]?.kind === 'file' ? entries[0].contents : 'diff'}
        </pre>
        <pre aria-label="Source anchor">{JSON.stringify(reveal?.anchor)}</pre>
        <p>{entries.some((entry) => entry.review) ? 'Reviewable' : 'Context only'}</p>
      </div>
    );
  },
}));
vi.mock('./review-code-document', () => ({
  ReviewCodeDocument: () => <p>Complete current diff</p>,
}));

const scope = { projectId: 'project', worktreeId: 'worktree' };
const source = {
  path: 'route.ts',
  startLine: 2,
  endLine: 3,
  contentFingerprint: 'a'.repeat(64),
};
const guide: ReviewGuide = {
  purpose: 'Follow native navigation.',
  steps: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Enter',
      question: 'What owns the transition?',
      source,
      related: [{ title: 'State owner', source: { ...source, path: 'state.ts' } }],
      verification: 'Advance twice, cancel a back swipe, then complete it.',
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      title: 'Complete',
      question: 'Can back reopen a completed question?',
      source: { ...source, path: 'complete.ts' },
    },
  ],
};
const props = {
  scope,
  layerId: 'layer',
  title: 'Navigation',
  guide,
  changes: [],
  onOpen: vi.fn(),
  onAllFiles: vi.fn(),
};

afterEach(() => {
  state.fingerprint = 'a'.repeat(64);
  state.missing = false;
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('guided layer navigation', () => {
  it('renders real surrounding source and anchors without review credit', async () => {
    const screen = await render(<GuidedLayerDocument {...props} />);
    await expect.element(screen.getByLabelText('Source content')).toMatchTextContent(
      /const owner = existingState/,
    );
    await expect.element(screen.getByLabelText('Source anchor')).toMatchTextContent(
      /"startLine":2,"endLine":3/,
    );
    await expect.element(screen.getByText('Context only')).toBeVisible();
    await screen.getByRole('button', { name: 'Open full file' }).click();
    expect(props.onOpen).toHaveBeenCalledWith({ kind: 'file', path: 'route.ts' });
  });

  it('opens related unchanged context and returns to the same question', async () => {
    const screen = await render(<GuidedLayerDocument {...props} />);
    await screen.getByRole('button', { name: 'State owner' }).click();
    await expect.element(screen.getByLabelText('Source content')).toMatchTextContent(
      /state.ts/,
    );
    await screen.getByRole('button', { name: 'Current diff' }).click();
    await expect.element(screen.getByText(/No current diff for this source/)).toBeVisible();
    await screen.getByRole('button', { name: 'Back to Enter' }).click();
    await expect.element(screen.getByLabelText('Source content')).toMatchTextContent(
      /route.ts/,
    );
    await expect.element(screen.getByRole('heading', { name: 'What owns the transition?' })).toBeVisible();
  });

  it('resumes the stable step after unmount and does not approve files', async () => {
    const first = await render(<GuidedLayerDocument {...props} />);
    await first.getByRole('button', { name: 'Next step' }).click();
    await first.unmount();
    const second = await render(<GuidedLayerDocument {...props} />);
    await expect.element(second.getByRole('heading', { name: 'Can back reopen a completed question?' })).toBeVisible();
    await expect.element(second.getByRole('button', { name: 'Next step' })).toBeDisabled();
    await expect.element(second.getByText('Context only')).toBeVisible();
  });

  it('does not render the old range after a source change', async () => {
    state.fingerprint = 'b'.repeat(64);
    const screen = await render(<GuidedLayerDocument {...props} />);
    await expect.element(screen.getByRole('alert')).toMatchTextContent(
      /Source changed since this guide was published/,
    );
    await expect.element(screen.getByLabelText('Source content')).not.toBeInTheDocument();
    await screen.getByRole('button', { name: 'Open full file' }).click();
    expect(props.onOpen).toHaveBeenCalledWith({ kind: 'file', path: 'route.ts' });
  });

  it('keeps the navigation and escape hatch available when source disappears', async () => {
    state.missing = true;
    const screen = await render(<GuidedLayerDocument {...props} />);
    await expect.element(screen.getByRole('alert')).toHaveTextContent('Source is missing.');
    await screen.getByRole('button', { name: 'All layer files' }).click();
    expect(props.onAllFiles).toHaveBeenCalledOnce();
  });

  it('continues working when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    const screen = await render(<GuidedLayerDocument {...props} />);
    await screen.getByRole('button', { name: 'Next step' }).click();
    await expect.element(screen.getByRole('heading', { name: 'Can back reopen a completed question?' })).toBeVisible();
  });
});
