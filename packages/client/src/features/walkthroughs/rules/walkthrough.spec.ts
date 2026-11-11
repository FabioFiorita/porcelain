import { describe, expect, it } from 'vitest';
import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import {
  firstDocument,
  walkthroughCodeScopes,
  groupFilesByStep,
  plainText,
  richParts,
  stopPaths,
  walkthroughFailureCopy,
  walkthroughFileCount,
  walkthroughPhase,
  walkthroughPullRequest,
  walkthroughStartFailure,
  walkthroughTabTitle,
  walkthroughVerdict,
  type WalkthroughContent,
  type WalkthroughRead,
  type WalkthroughRun,
  type WalkthroughStop,
} from './walkthrough.ts';
import { worktreeOpening } from './opening.ts';
import { readingOf } from '../queries/reading.ts';
import {
  attentionLabel,
  failureCopy,
  foldedGrowth,
  foldedNotSaid,
  growthSign,
  readyUpdate,
  walkthroughMeta,
  walkthroughEvidenceNotice,
} from './page.ts';
import { AsyncResult } from 'effect/reactivity';

const stop = (over: Partial<WalkthroughStop> = {}): WalkthroughStop => ({
  title: 'A step',
  explanation: 'Why it exists.',
  attention: undefined,
  excerpts: [],
  evidence: [],
  files: [],
  ...over,
});

const attention = {
  kind: 'product',
  note: 'It matters.',
  question: 'Keep it?',
} as const;

const content = (
  over: Partial<WalkthroughContent> = {},
): WalkthroughContent => ({
  outcome: 'needs_you',
  title: 'A change',
  summary: 'What changed.',
  growth: [],
  stops: [],
  onlyInTranscript: [],
  stillUnclear: [],
  checks: undefined,
  ...over,
});

const excerpt = (path: string, side: 'new' | 'old' = 'new') => ({
  path,
  side,
  start: 1,
  end: 2,
  caption: 'Lines',
});

const run = (state: WalkthroughRun['state']): WalkthroughRun => ({
  id: 'run',
  projectId: 'project',
  worktreeId: 'worktree',
  pullRequestNumber: undefined,
  baseOid: 'a'.repeat(40),
  baseRef: 'refs/heads/main',
  contentTreeOid: 'a'.repeat(40),
  includesUncommitted: false,
  headOid: 'b'.repeat(40),
  writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
  sessionId: undefined,
  createdAt: '2026-11-09T00:00:00.000Z',
  state,
});

const read = (
  walkthrough: WalkthroughRun | undefined,
  outOfDate = false,
): WalkthroughRead => ({ walkthrough, outOfDate });

describe('walkthroughVerdict', () => {
  it('counts the calls that are the reader’s', () => {
    expect(walkthroughVerdict(content({ stops: [stop({ attention })] }))).toBe(
      'One call is yours.',
    );
    expect(
      walkthroughVerdict(
        content({ stops: [stop({ attention }), stop(), stop({ attention })] }),
      ),
    ).toBe('Two calls are yours.');
  });

  it('never promises a call when every call was filtered out', () => {
    expect(walkthroughVerdict(content({ stops: [stop()] }))).toBe(
      'Worth knowing.',
    );
  });

  it('names the other two outcomes', () => {
    expect(walkthroughVerdict(content({ outcome: 'worth_knowing' }))).toBe(
      'Worth knowing.',
    );
    expect(walkthroughVerdict(content({ outcome: 'nothing' }))).toBe(
      'Nothing needs you.',
    );
  });
});

describe('stopPaths', () => {
  it('lists each file of a step once, excerpted or merely claimed', () => {
    expect(
      stopPaths(
        stop({
          excerpts: [excerpt('a.ts'), excerpt('a.ts')],
          files: [
            { path: 'b.ts', note: 'x' },
            { path: 'a.ts', note: 'y' },
          ],
        }),
      ),
    ).toEqual(['a.ts', 'b.ts']);
  });
});

describe('stopPaths with the branch renames', () => {
  it('adds the new name of a file the step cites by its old name', () => {
    expect(
      stopPaths(stop({ files: [{ path: 'old-name.ts', note: 'x' }] }), [
        { path: 'new-name.ts', oldPath: 'old-name.ts' },
        { path: 'other.ts', oldPath: 'elsewhere.ts' },
      ]),
    ).toEqual(['old-name.ts', 'new-name.ts']);
  });

  it('groups a local edit of a renamed file under the step citing its old name', () => {
    const renamed = content({
      stops: [stop({ excerpts: [excerpt('old-name.ts', 'old')] })],
    });
    const local = [{ path: 'new-name.ts' }];
    expect(groupFilesByStep(renamed, local).outside).toEqual(local);
    expect(
      groupFilesByStep(renamed, local, [
        { path: 'new-name.ts', oldPath: 'old-name.ts' },
      ]).steps[0]?.files,
    ).toEqual(local);
  });
});

describe('walkthroughTabTitle', () => {
  it('names the window after a written walkthrough, else Walkthrough', () => {
    expect(
      walkthroughTabTitle(
        read(
          run({
            status: 'ready',
            content: content({ title: 'Add `notes` to the sample.' }),
            writtenAt: '2026-11-09T00:00:01.000Z',
            durationMs: 1,
            costUsd: undefined,
          }),
        ),
      ),
    ).toBe('Add notes to the sample');
    expect(walkthroughTabTitle(read(undefined))).toBe('Walkthrough');
    expect(walkthroughTabTitle(read(run({ status: 'running' })))).toBe(
      'Walkthrough',
    );
  });
});

describe('walkthroughFileCount', () => {
  it('counts distinct files across the steps', () => {
    expect(
      walkthroughFileCount(
        content({
          stops: [
            stop({ excerpts: [excerpt('a.ts')] }),
            stop({ files: [{ path: 'b.ts', note: 'x' }] }),
          ],
        }),
      ),
    ).toBe(2);
  });
});

describe('groupFilesByStep', () => {
  const steps = content({
    stops: [
      stop({ excerpts: [excerpt('src/a.ts')] }),
      stop({ files: [{ path: 'src/b.ts', note: 'x' }] }),
    ],
  });

  it('puts each changed file under its step and leaves the rest outside', () => {
    const grouped = groupFilesByStep(steps, [
      { path: 'src/b.ts' },
      { path: 'src/a.ts' },
      { path: 'local-note.txt' },
    ]);
    expect(
      grouped.steps.map((entry) => [
        entry.step,
        entry.files.map((file) => file.path),
      ]),
    ).toEqual([
      [1, ['src/a.ts']],
      [2, ['src/b.ts']],
    ]);
    expect(grouped.outside.map((file) => file.path)).toEqual([
      'local-note.txt',
    ]);
  });

  it('finds a renamed file that the step only excerpted on its old side', () => {
    const renamed = content({
      stops: [stop({ excerpts: [excerpt('old-name.ts', 'old')] })],
    });
    expect(
      groupFilesByStep(renamed, [
        { path: 'new-name.ts', oldPath: 'old-name.ts' },
      ]).steps[0]?.files,
    ).toEqual([{ path: 'new-name.ts', oldPath: 'old-name.ts' }]);
  });

  it('keeps a step that has no changed files, so the panel decides to hide it', () => {
    expect(
      groupFilesByStep(steps, [{ path: 'src/a.ts' }]).steps[1]?.files,
    ).toEqual([]);
  });
});

describe('walkthroughPhase', () => {
  it('is unwritten when no run exists', () => {
    expect(walkthroughPhase(read(undefined)).kind).toBe('unwritten');
  });

  it('is writing while queued or running', () => {
    expect(walkthroughPhase(read(run({ status: 'queued' }))).kind).toBe(
      'writing',
    );
    expect(walkthroughPhase(read(run({ status: 'running' }))).kind).toBe(
      'writing',
    );
  });

  it('carries the failure and the out-of-date mark', () => {
    expect(
      walkthroughPhase(
        read(
          run({
            status: 'failed',
            failure: { kind: 'timed_out', message: 'Took too long.' },
          }),
        ),
      ),
    ).toMatchObject({ kind: 'failed', failure: { kind: 'timed_out' } });
    expect(
      walkthroughPhase(
        read(
          run({
            status: 'ready',
            content: content(),
            writtenAt: '2026-11-09T00:00:01.000Z',
            durationMs: 1,
            costUsd: undefined,
          }),
          true,
        ),
      ),
    ).toMatchObject({ kind: 'ready', outOfDate: true });
  });
});

describe('firstDocument', () => {
  it('shows the walkthrough when the worktree has one', () => {
    expect(firstDocument(read(run({ status: 'running' })))).toBe('walkthrough');
  });

  it.each([
    { status: 'queued' },
    { status: 'failed', failure: { kind: 'other', message: 'Stopped' } },
    {
      status: 'ready',
      content: content(),
      writtenAt: '2026-11-10T00:00:00Z',
      durationMs: 1,
      costUsd: undefined,
    },
  ] satisfies WalkthroughRun['state'][])(
    'opens Walkthrough for an existing $status run even without branch commits',
    (state) => {
      expect(firstDocument(read(run(state)))).toBe('walkthrough');
    },
  );

  it('opens Changes when no run exists, independently of Git changes', () => {
    expect(firstDocument(read(undefined))).toBe('changes');
  });
});

describe('walkthroughFailureCopy', () => {
  const claude = {
    provider: 'claude',
    model: 'claude-opus-5-5',
    effort: 'high',
  } as const;
  const codex = { provider: 'codex', model: 'gpt', effort: 'high' } as const;

  it('names the sign-in command of the writer that signed out', () => {
    expect(
      walkthroughFailureCopy(
        { kind: 'signed_out', message: 'ignored' },
        claude,
      ),
    ).toMatchObject({
      title: 'Sign in to Claude again with claude auth login, then try again.',
      command: 'claude auth login',
    });
    expect(
      walkthroughFailureCopy({ kind: 'signed_out', message: 'ignored' }, codex),
    ).toMatchObject({
      title: 'Sign in to Codex again with codex login, then try again.',
      command: 'codex login',
    });
  });

  it('shows the writer’s own message for every other failure', () => {
    expect(
      walkthroughFailureCopy(
        { kind: 'timed_out', message: 'Stopped after 20 minutes.' },
        claude,
      ),
    ).toEqual({
      title: 'The walkthrough took too long.',
      message: 'Stopped after 20 minutes.',
    });
    expect(
      walkthroughFailureCopy({ kind: 'other', message: 'Boom.' }, codex),
    ).toEqual({ title: "The walkthrough didn't finish.", message: 'Boom.' });
  });
});

describe('walkthroughStartFailure', () => {
  it('keeps the writer failure the server refused the start with', () => {
    expect(
      walkthroughStartFailure({
        _tag: 'WalkthroughFailedError',
        kind: 'other',
        message: 'Choose a base branch with commits in common.',
      }),
    ).toEqual({
      kind: 'other',
      message: 'Choose a base branch with commits in common.',
    });
  });

  it('never reads an unrelated error as a walkthrough failure kind', () => {
    expect(
      walkthroughStartFailure({ kind: 'network', message: 'Unreachable' }),
    ).toEqual({
      kind: 'other',
      message: 'Porcelain could not start the walkthrough.',
    });
  });
});

describe('walkthroughPullRequest', () => {
  const pulls = [
    { number: 7, headBranch: 'feature', state: 'closed' },
    { number: 8, headBranch: 'feature', state: 'open' },
    { number: 9, headBranch: 'other', state: 'open' },
  ];

  it('finds the open pull request of the worktree branch', () => {
    expect(walkthroughPullRequest(pulls, 'feature')).toBe(8);
  });

  it('has no number without a branch or an open pull request', () => {
    expect(walkthroughPullRequest(pulls, undefined)).toBeUndefined();
    expect(walkthroughPullRequest(pulls, 'main')).toBeUndefined();
  });
});

describe('richParts', () => {
  it('marks backticked text as code and leaves the rest as text', () => {
    expect(richParts('Run `pnpm check` now')).toEqual([
      { kind: 'text', text: 'Run ' },
      { kind: 'code', text: 'pnpm check' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('leaves unmatched backticks as text', () => {
    expect(richParts('a ` b')).toEqual([{ kind: 'text', text: 'a ` b' }]);
  });
});

describe('plainText', () => {
  it('drops the backticks for labels and tab titles', () => {
    expect(plainText('`/labs` asks him')).toBe('/labs asks him');
  });
});

it.each([
  { status: 'running' },
  { status: 'failed', failure: { kind: 'other', message: 'Writer failed' } },
] as const)('keeps ready steps while the newer attempt is $status', (state) => {
  const ready = run({
    status: 'ready',
    content: content({ stops: [stop()] }),
    writtenAt: 'today',
    durationMs: 1,
    costUsd: undefined,
  });
  const phase = walkthroughPhase({
    walkthrough: ready,
    attempt: { ...run(state), id: 'newer' },
    outOfDate: true,
  });
  expect(phase).toMatchObject({
    kind: 'ready',
    run: { id: 'run', headOid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    content: { stops: [{ title: 'A step' }] },
    outOfDate: true,
    attempt: { id: 'newer' },
  });
});

describe('worktreeOpening', () => {
  const settled = (walkthrough: WalkthroughRun | undefined) =>
    worktreeOpening({
      walkthrough: { status: 'read', value: read(walkthrough) },
    });

  it('opens a worktree that has a walkthrough on it, even with no commits', () => {
    expect(settled(run({ status: 'running' }))).toEqual({
      name: 'walkthrough',
      pending: false,
      guided: true,
      companion: false,
    });
  });

  it('opens Changes with a companion Walkthrough regardless of branch commits', () => {
    expect(settled(undefined)).toEqual({
      name: 'changes',
      pending: false,
      guided: false,
      companion: true,
    });
  });

  it('waits for the walkthrough read, and treats a failed read as settled', () => {
    expect(
      worktreeOpening({
        walkthrough: readingOf(AsyncResult.initial(true), (value) => value),
      }).pending,
    ).toBe(true);
    expect(
      worktreeOpening({
        walkthrough: readingOf(
          AsyncResult.fail(new Error('Offline')),
          (value: WalkthroughRead) => value,
        ),
      }),
    ).toEqual({
      name: 'changes',
      pending: false,
      guided: false,
      companion: false,
    });
  });
});

describe('walkthrough page rules', () => {
  const growth = (what: string) =>
    ({ change: 'added', what, note: 'Note.' }) as const;

  it('names each kind of call and each kind of growth', () => {
    expect(attentionLabel({ ...attention, kind: 'risk' })).toBe(
      'Risk to accept',
    );
    expect(growthSign({ change: 'removed', what: 'Old', note: 'Gone.' })).toBe(
      '−',
    );
  });

  it('folds growth after four items and unexplained points after three', () => {
    const many = content({
      growth: ['A', 'B', 'C', 'D', 'E', 'F'].map(growth),
      onlyInTranscript: [
        { point: 'Why?', answer: 'Because.' },
        { point: 'When?', answer: 'Now.' },
      ],
      stillUnclear: ['Who?', 'Where?'],
    });
    expect(foldedGrowth(many, false).shown).toHaveLength(4);
    expect(foldedGrowth(many, false).hidden).toBe(2);
    expect(foldedGrowth(many, true).hidden).toBe(0);
    expect(foldedNotSaid(many, false)).toMatchObject({
      unclear: ['Who?'],
      total: 4,
      hidden: 1,
    });
  });

  it('describes the pull request, files and commit a walkthrough was written for', () => {
    const written = { ...run({ status: 'running' }), pullRequestNumber: 423 };
    expect(
      walkthroughMeta(
        written,
        content({
          stops: [
            stop({
              files: [
                { path: 'a.ts', note: 'A' },
                { path: 'b.ts', note: 'B' },
              ],
            }),
          ],
        }),
      ),
    ).toBe('#423 · 2 files · written for bbbbbbb');
    expect(walkthroughMeta(run({ status: 'running' }))).toBe(
      'written for bbbbbbb',
    );
  });

  it('keeps the ready page while an update runs, and blames the failed attempt’s writer', () => {
    const ready = run({
      status: 'ready',
      content: content(),
      writtenAt: '2026-11-09T00:00:01.000Z',
      durationMs: 1,
      costUsd: undefined,
    });
    const codex = { provider: 'codex', model: 'gpt', effort: 'high' } as const;
    const failure = { kind: 'other', message: 'It stopped.' } as const;
    const phase = (attempt: WalkthroughRun | undefined) => {
      const current = walkthroughPhase({
        walkthrough: ready,
        outOfDate: true,
        attempt,
      });
      if (current.kind !== 'ready') throw new Error('Expected a ready page.');
      return current;
    };
    const idle = { waiting: false, failure: undefined };
    expect(readyUpdate(phase(run({ status: 'running' })), idle)).toEqual({
      updating: true,
      failure: undefined,
    });
    expect(
      readyUpdate(
        phase({ ...run({ status: 'failed', failure }), writer: codex }),
        idle,
      ),
    ).toEqual({ updating: false, failure: { failure, writer: codex } });
    expect(
      readyUpdate(phase(undefined), { waiting: false, failure }).failure,
    ).toEqual({ failure, writer: ready.writer });
    expect(failureCopy(failure, undefined).title).toBe(
      "The walkthrough didn't finish.",
    );
  });
});

it('describes captured uncommitted work in shared web and mobile metadata', () => {
  expect(
    walkthroughMeta({
      ...run({ status: 'running' }),
      includesUncommitted: true,
    }),
  ).toBe('written for bbbbbbb and uncommitted work');
});

describe('walkthrough code scopes', () => {
  it.each([
    {
      label: 'uncommitted only',
      branch: [],
      worktree: [{ path: 'dirty.ts' }],
      expected: { branch: [], worktree: ['dirty.ts'] },
    },
    {
      label: 'mixed',
      branch: [{ path: 'committed.ts' }, { path: 'both.ts' }],
      worktree: [
        { path: 'both.ts' },
        { path: 'dirty.ts' },
        { path: 'dirty.ts' },
      ],
      expected: {
        branch: ['committed.ts', 'both.ts'],
        worktree: ['both.ts', 'dirty.ts'],
      },
    },
    {
      label: 'committed only',
      branch: [{ path: 'committed.ts' }],
      worktree: [],
      expected: { branch: ['committed.ts'], worktree: [] },
    },
  ])(
    'selects $label files once in each comparison',
    ({ branch, worktree, expected }) => {
      expect(walkthroughCodeScopes({ branch, worktree })).toEqual(expected);
    },
  );
  it('selects only step files and follows renames in both comparisons', () => {
    const worktree = [
      {
        path: 'renamed-again.ts',
        fingerprint: undefined,
        comparisons: [
          {
            scope: 'staged',
            kind: 'renamed',
            oldPath: 'renamed.ts',
            newPath: 'renamed-again.ts',
            oldMode: '100644',
            newMode: '100644',
            oldOid: 'a'.repeat(40),
            newOid: 'b'.repeat(40),
            supported: true,
          },
        ],
      },
      {
        path: 'outside.ts',
        fingerprint: undefined,
        comparisons: [{ scope: 'untracked', path: 'outside.ts' }],
      },
    ] satisfies ReadChangesResponse['changes'];
    expect(
      walkthroughCodeScopes({
        branch: [
          { path: 'renamed.ts', oldPath: 'old.ts' },
          { path: 'outside.ts' },
        ],
        worktree,
        only: ['old.ts', 'renamed.ts'],
      }),
    ).toEqual({ branch: ['renamed.ts'], worktree: ['renamed-again.ts'] });
  });
});

it('explains missing PR evidence once with shared web and mobile copy and clears on a matching run', () => {
  const ready = run({ status: 'running' });
  expect(
    walkthroughEvidenceNotice({
      ...ready,
      evidenceUnavailable: 'head_mismatch',
    }),
  ).toBe(
    'Screenshots and checks are not shown: the pull request is at another commit. Push, then update.',
  );
  expect(
    walkthroughEvidenceNotice({
      ...ready,
      evidenceUnavailable: 'github_account',
    }),
  ).toBe(
    'Screenshots and checks are not shown: choose a GitHub account for this project, then update.',
  );
  expect(
    walkthroughEvidenceNotice({
      ...ready,
      evidenceUnavailable: 'github_unavailable',
    }),
  ).toBe(
    'Screenshots and checks are not shown: GitHub could not be reached. Try updating later.',
  );
  expect(walkthroughEvidenceNotice(ready)).toBeUndefined();
});
