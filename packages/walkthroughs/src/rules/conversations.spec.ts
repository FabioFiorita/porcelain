import { describe, expect, it } from 'vite-plus/test';
import type { WalkthroughRun } from '../models/walkthrough.ts';
import type { StoredWalkthroughMessage } from '../models/conversation.ts';
import { conversationsView } from './conversations.ts';

const run = (
  id: string,
  titles: string[],
  pullRequestNumber?: number,
): WalkthroughRun => ({
  id,
  projectId: 'project',
  worktreeId: 'worktree',
  pullRequestNumber,
  baseOid: 'a'.repeat(40),
  baseRef: 'refs/heads/main',
  contentTreeOid: 'a'.repeat(40),
  includesUncommitted: false,
  headOid: 'b'.repeat(40),
  writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
  sessionId: 'session',
  createdAt: '2026-11-09T00:00:00.000Z',
  state: {
    status: 'ready',
    writtenAt: '2026-11-09T00:00:00.000Z',
    durationMs: 1,
    content: {
      version: 1 as const,
      outcome: 'worth_knowing',
      title: 'Walkthrough',
      summary: 'A summary.',
      growth: [],
      stops: titles.map((title) => ({
        title,
        explanation: 'Why.',
        blocks: [
          {
            kind: 'diff_excerpt',
            contentTreeOid: 'tree',
            headOid: 'head',
            path: 'src/a.ts',
            side: 'new',
            start: 1,
            end: 3,
            caption: 'a',
          },
          { kind: 'files', files: [{ path: 'src/b.ts', note: 'b' }] },
        ],
      })),
      onlyInTranscript: [],
      stillUnclear: [],
    },
  },
});
const message = (
  id: string,
  runId: string,
  stopTitle: string | undefined,
  overrides: Partial<StoredWalkthroughMessage> = {},
): StoredWalkthroughMessage => ({
  id,
  runId,
  worktreeId: 'worktree',
  stopTitle,
  text: `Why ${id}?`,
  createdAt: '2026-11-09T00:00:00.000Z',
  answer: { status: 'answering' },
  ...overrides,
});

describe('conversationsView', () => {
  it('keeps a matching stop title on the latest run and moves the rest under the whole walkthrough', () => {
    const view = conversationsView(
      [run('old', ['Kept', 'Gone']), run('new', ['Kept'])],
      [
        message('1', 'old', 'Kept'),
        message('2', 'old', 'Gone'),
        message('3', 'new', 'Kept'),
        message('4', 'old', undefined),
      ],
    );
    expect(view.runId).toBe('new');
    expect(
      view.conversations.map((conversation) => [
        conversation.runId,
        conversation.anchor,
        conversation.messages.map((item) => item.id),
      ]),
    ).toEqual([
      ['old', { kind: 'stop', title: 'Kept' }, ['1', '1:answer']],
      ['old', { kind: 'walkthrough' }, ['2', '2:answer']],
      ['new', { kind: 'stop', title: 'Kept' }, ['3', '3:answer']],
      ['old', { kind: 'walkthrough' }, ['4', '4:answer']],
    ]);
  });

  it('shows nothing when no walkthrough has finished yet', () => {
    expect(conversationsView([], [])).toEqual({
      runId: undefined,
      pullRequestNumber: undefined,
      conversations: [],
      decisions: [],
    });
  });

  it('reports the pull request of the latest finished run', () => {
    expect(
      conversationsView([run('old', [], 3), run('new', [], 9)], [])
        .pullRequestNumber,
    ).toBe(9);
  });
});
