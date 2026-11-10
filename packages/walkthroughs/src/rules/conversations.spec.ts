import { describe, expect, it } from 'vitest';
import type { WalkthroughRun } from '../models/walkthrough.ts';
import type { StoredWalkthroughMessage } from '../models/conversation.ts';
import { composeBrief, conversationsView, planPost } from './conversations.ts';

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
  headOid: 'b'.repeat(40),
  writer: { provider: 'claude', model: 'claude-opus-5-5' },
  sessionId: 'session',
  createdAt: '2026-11-09T00:00:00.000Z',
  state: {
    status: 'ready',
    writtenAt: '2026-11-09T00:00:00.000Z',
    durationMs: 1,
    content: {
      outcome: 'worth_knowing',
      title: 'Walkthrough',
      summary: 'A summary.',
      growth: [],
      stops: titles.map((title) => ({
        title,
        explanation: 'Why.',
        excerpts: [
          { path: 'src/a.ts', side: 'new', start: 1, end: 3, caption: 'a' },
        ],
        evidence: [],
        files: [{ path: 'src/b.ts', note: 'b' }],
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
  post: { status: 'none' },
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
    });
  });

  it('reports the pull request of the latest finished run', () => {
    expect(
      conversationsView([run('old', [], 3), run('new', [], 9)], [])
        .pullRequestNumber,
    ).toBe(9);
  });
});

describe('composeBrief', () => {
  it('names the step and its files and carries the answer for one message', () => {
    expect(
      composeBrief([
        {
          text: 'Keep the retry?\nIt repeats.',
          stopTitle: 'Retries stay local',
          paths: ['src/a.ts', 'src/b.ts'],
          answer: 'It is a decision. Remove the retry from src/a.ts.',
        },
      ]),
    ).toBe(
      'From the walkthrough of this change:\n\n' +
        '> Keep the retry?\n> It repeats.\n\n' +
        '**Step:** Retries stay local (`src/a.ts`, `src/b.ts`)\n' +
        "**Agent's answer:** It is a decision. Remove the retry from src/a.ts.\n",
    );
  });

  it('leaves out an answer that does not exist', () => {
    const brief = composeBrief([
      {
        text: 'Why?',
        stopTitle: undefined,
        paths: [],
        answer: undefined,
      },
    ]);
    expect(brief).toBe('From the walkthrough of this change:\n\n> Why?\n');
    expect(brief).not.toContain("Agent's answer");
  });

  it('writes one line per item when several go together', () => {
    expect(
      composeBrief([
        {
          text: 'First\nquestion',
          stopTitle: 'Step',
          paths: ['src/a.ts'],
          answer: undefined,
        },
        {
          text: 'Second',
          stopTitle: undefined,
          paths: [],
          answer: 'Long\nanswer.',
        },
      ]),
    ).toBe(
      'From the walkthrough of this change:\n\n' +
        '- **Step (`src/a.ts`):** First question\n' +
        "- **Whole walkthrough:** Second Agent's answer: Long answer.\n",
    );
  });
});

describe('planPost', () => {
  const runs = [
    {
      ...run('run', ['Step'], 7),
      pullRequestRepository: { owner: 'o', repo: 'r' },
    },
  ];
  const posted = message('m', 'run', 'Step', {
    post: {
      status: 'posted',
      url: 'https://github.com/o/r/pull/7#issuecomment-1',
      postedAt: '2026-11-09T00:00:00.000Z',
    },
  });

  it('never rewrites a posted message', () => {
    expect(
      planPost({
        selection: { kind: 'message', messageId: 'm' },
        readyRuns: runs,
        messages: [posted],
      }),
    ).toEqual({
      kind: 'already-posted',
      url: 'https://github.com/o/r/pull/7#issuecomment-1',
    });
  });

  it('collects only saved messages into one write with the step files', () => {
    const plan = planPost({
      selection: { kind: 'saved' },
      readyRuns: runs,
      messages: [
        message('a', 'run', 'Step', { post: { status: 'saved' } }),
        message('b', 'run', undefined),
        message('c', 'run', undefined, { post: { status: 'saved' } }),
        posted,
      ],
    });
    expect(plan.kind).toBe('write');
    if (plan.kind !== 'write') return;
    expect(plan.messageIds).toEqual(['a', 'c']);
    expect(plan.pullRequestNumber).toBe(7);
    expect(plan.text).toContain('**Step (`src/a.ts`, `src/b.ts`):** Why a?');
  });

  it('does nothing when nothing is saved', () => {
    expect(
      planPost({
        selection: { kind: 'saved' },
        readyRuns: runs,
        messages: [message('b', 'run', undefined)],
      }),
    ).toEqual({ kind: 'nothing' });
  });

  it('has no pull request to post to on a walkthrough without one', () => {
    const plan = planPost({
      selection: { kind: 'message', messageId: 'm' },
      readyRuns: [run('run', ['Step'])],
      messages: [message('m', 'run', 'Step')],
    });
    expect(plan.kind === 'write' && plan.pullRequestNumber).toBe(undefined);
  });
});

describe('planPost across repositories', () => {
  const pinned = (id: string, repo: string) => ({
    ...run(id, ['Step'], 7),
    pullRequestRepository: { owner: 'o', repo },
  });
  it('comments only messages whose own run was on the destination repository and keeps all of them in the brief', () => {
    const plan = planPost({
      selection: { kind: 'saved' },
      readyRuns: [pinned('private', 'private'), pinned('fork', 'Fork')],
      messages: [
        message('old', 'private', 'Step', { post: { status: 'saved' } }),
        message('new', 'fork', 'Step', { post: { status: 'saved' } }),
      ],
    });
    expect(plan).toMatchObject({
      kind: 'write',
      repository: { owner: 'o', repo: 'Fork' },
      messageIds: ['new'],
      notPosted: ['old'],
    });
    if (plan.kind !== 'write') return;
    expect(plan.comment).toContain('Why new?');
    expect(plan.comment).not.toContain('Why old?');
    expect(plan.text).toContain('Why old?');
  });
});
