import { describe, expect, it } from 'vite-plus/test';
import type { ReadChangesResponse } from '@porcelain/contracts/changes';
import {
  firstDocument,
  walkthroughCodeScopes,
  reviewCodeSections,
  uncoveredPaths,
  reviewCodeCount,
  reviewCodeIn,
  eagerSections,
  groupFilesByStep,
  plainText,
  richParts,
  stopPaths,
  walkthroughFailureCopy,
  walkthroughFileCount,
  walkthroughPhase,
  walkthroughStartRequest,
  walkthroughStartFailure,
  walkthroughTabTitle,
  walkthroughVerdict,
  walkthroughCalls,
  undecidedCallStep,
  callDecisionProgress,
  type WalkthroughContent,
  type WalkthroughRead,
  type WalkthroughRun,
} from './walkthrough.ts';
import type { WalkthroughStop } from './blocks.ts';
import { worktreeOpening } from './opening.ts';
import { readingOf } from '../queries/reading.ts';
import {
  attentionLabel,
  callChoices,
  callDeciding,
  callsNeedingCommit,
  callState,
  decidedAgainstChange,
  decisionPlace,
  stepCallState,
  screenshotClaim,
  failureCopy,
  foldedGrowth,
  foldedNotSaid,
  growthSign,
  readyUpdate,
  initialWriteFailure,
  walkthroughMeta,
  walkthroughScope,
  walkthroughEvidenceNotice,
} from './page.ts';
import {
  acknowledgedWalkthroughPhase,
  walkthroughProgress,
  walkthroughFreshnessText,
} from './progress.ts';
import { AsyncResult } from 'effect/reactivity';

const excerpt = (path: string, side: 'new' | 'old' = 'new') => ({
  path,
  side,
  start: 1,
  end: 2,
  caption: 'Lines',
  position: 1,
  lines: 'New lines 1–2',
  span: { startLine: 1, endLine: 2 },
});

const stop = ({
  callouts = [],
  excerpts = [],
  files = [],
}: {
  callouts?: WalkthroughStop['callouts'];
  excerpts?: readonly ReturnType<typeof excerpt>[];
  files?: readonly { path: string; note: string }[];
} = {}): WalkthroughStop => ({
  title: 'A step',
  explanation: 'Why it exists.',
  callouts,
  blocks: [
    ...excerpts.map((item) => ({ kind: 'excerpt' as const, excerpt: item })),
    ...(files.length > 0 ? [{ kind: 'files' as const, files }] : []),
  ],
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
  ...over,
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
): WalkthroughRead => ({
  walkthrough,
  freshness: outOfDate ? 'changed' : 'current',
});

describe('walkthroughVerdict', () => {
  it('counts the calls that are the reader’s', () => {
    expect(
      walkthroughVerdict(
        content({
          stops: [stop({ callouts: [{ attention, comparison: undefined }] })],
        }),
      ),
    ).toBe('One call is yours.');
    expect(
      walkthroughVerdict(
        content({
          stops: [
            stop({ callouts: [{ attention, comparison: undefined }] }),
            stop(),
            stop({ callouts: [{ attention, comparison: undefined }] }),
          ],
        }),
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
  it('names the window after a written walkthrough, else Review', () => {
    expect(
      walkthroughTabTitle(
        read(
          run({
            status: 'ready',
            content: {
              ...content(),
              title: 'Add `notes` to the sample.',
              version: 1,
              stops: [],
            },
            writtenAt: '2026-11-09T00:00:01.000Z',
            durationMs: 1,
            costUsd: undefined,
          }),
        ),
      ),
    ).toBe('Add notes to the sample');
    expect(walkthroughTabTitle(read(undefined))).toBe('Review');
    expect(walkthroughTabTitle(read(run({ status: 'running' })))).toBe(
      'Review',
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
            content: { ...content(), version: 1, stops: [] },
            writtenAt: '2026-11-09T00:00:01.000Z',
            durationMs: 1,
            costUsd: undefined,
          }),
          true,
        ),
      ),
    ).toMatchObject({ kind: 'ready', freshness: 'changed' });
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
      content: { ...content(), version: 1, stops: [] },
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

describe('walkthroughStartRequest', () => {
  const pullRequests = [
    { number: 7, headBranch: 'feature', state: 'closed' },
    { number: 8, headBranch: 'feature', state: 'open' },
    { number: 9, headBranch: 'other', state: 'open' },
  ];
  it('keeps the displayed PR in the request when the list is unavailable or loading', () => {
    expect(
      walkthroughStartRequest({
        pullRequests: undefined,
        branch: 'feature',
        displayedRun: { pullRequestNumber: 423 },
        base: 'main',
      }),
    ).toEqual({ base: 'main', pullRequestNumber: 423 });
  });
  it('uses an open PR for this branch and otherwise keeps the displayed target', () => {
    expect(
      walkthroughStartRequest({
        pullRequests,
        branch: 'feature',
        displayedRun: { pullRequestNumber: 423 },
      }),
    ).toEqual({ pullRequestNumber: 8 });
    expect(
      walkthroughStartRequest({
        pullRequests,
        branch: 'main',
        displayedRun: { pullRequestNumber: 423 },
      }),
    ).toEqual({ pullRequestNumber: 423 });
  });
  it('writes without a PR when neither the list nor the displayed run names one', () => {
    expect(
      walkthroughStartRequest({
        pullRequests: undefined,
        branch: 'feature',
        displayedRun: undefined,
      }),
    ).toEqual({});
    expect(
      walkthroughStartRequest({
        pullRequests,
        branch: undefined,
        displayedRun: undefined,
      }),
    ).toEqual({});
    expect(
      walkthroughStartRequest({
        pullRequests,
        branch: 'main',
        displayedRun: undefined,
      }),
    ).toEqual({});
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
    content: {
      ...content(),
      version: 1,
      stops: [
        {
          title: 'A step',
          explanation: 'Why it exists.',
          blocks: [
            {
              kind: 'checks',
              state: 'SUCCESS',
              headOid: 'abcdef12345',
              checksTruncated: true,
              results: [{ name: 'Test', status: 'SUCCESS' }],
            },
            {
              kind: 'callout',
              attention,
              comparison: {
                columns: ['Keep', 'Replace'],
                rows: [['Two names', 'One name']],
              },
            },
            {
              kind: 'callout',
              attention: {
                kind: 'risk',
                note: 'Old readers differ.',
                question: 'Keep the old path?',
              },
              comparison: {
                columns: ['Old', 'New'],
                rows: [['Compatible', 'Shorter']],
              },
            },
          ],
        },
      ],
    },
    writtenAt: 'today',
    durationMs: 1,
    costUsd: undefined,
  });
  const phase = walkthroughPhase({
    walkthrough: ready,
    attempt: { ...run(state), id: 'newer' },
    freshness: 'changed',
  });
  expect(phase).toMatchObject({
    kind: 'ready',
    run: { id: 'run', headOid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    content: {
      stops: [
        {
          title: 'A step',
          explanation: 'Why it exists.',
          blocks: [{ kind: 'checks', checks: { headOid: 'abcdef12345' } }],
        },
      ],
    },
    freshness: 'changed',
    attempt: { id: 'newer' },
  });
  if (phase?.kind !== 'ready')
    throw new Error('Expected the saved walkthrough');
  expect(
    walkthroughCalls(phase.content).map(({ attention: call, comparison }) => ({
      question: call.question,
      note: call.note,
      comparison,
    })),
  ).toEqual([
    {
      question: 'Keep it?',
      note: 'It matters.',
      comparison: {
        columns: ['Keep', 'Replace'],
        rows: [['Two names', 'One name']],
      },
    },
    {
      question: 'Keep the old path?',
      note: 'Old readers differ.',
      comparison: {
        columns: ['Old', 'New'],
        rows: [['Compatible', 'Shorter']],
      },
    },
  ]);
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
    });
  });

  it('opens an unguided review without a walkthrough, regardless of branch commits', () => {
    expect(settled(undefined)).toEqual({
      name: 'changes',
      pending: false,
      guided: false,
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
    expect(
      walkthroughMeta(written, content({ stops: [] }), undefined, {
        committed: ['a.ts', 'b.ts', 'c.ts'],
        uncommitted: ['README.md', 'docs.md', 'c.ts'],
      }),
    ).toBe('#423 · 5 files, 2 uncommitted · written for bbbbbbb');
    expect(
      walkthroughMeta(written, content({ stops: [] }), undefined, null),
    ).toBe('#423 · written for bbbbbbb');
    expect(walkthroughMeta(run({ status: 'running' }))).toBe(
      'written for bbbbbbb',
    );
    expect(
      walkthroughMeta(
        run({ status: 'running' }),
        content({ stops: [] }),
        'Opus 5.5',
      ),
    ).toBe('written for bbbbbbb · by Opus 5.5 · high effort');
  });

  it('names uncommitted files outside the pull request and files no step covers', () => {
    expect(
      walkthroughScope({
        uncommitted: ['README.md', 'docs/search.md'],
        uncovered: ['docs/search.md'],
        pullRequest: 57,
        checkedCommit: 'abcdef1234',
      }),
    ).toEqual({
      uncommitted:
        'README.md and search.md are uncommitted, so not in #57. The checks cover abcdef1 only.',
      uncovered: 'No step covers search.md.',
    });
    expect(
      walkthroughScope({
        uncommitted: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
        uncovered: [],
        pullRequest: undefined,
        checkedCommit: undefined,
      }),
    ).toEqual({
      uncommitted: 'a.ts, b.ts, c.ts and 2 more are uncommitted.',
      uncovered: undefined,
    });
  });

  it('keeps the ready page while an update runs, and blames the failed attempt’s writer', () => {
    const ready = run({
      status: 'ready',
      content: { ...content(), version: 1, stops: [] },
      writtenAt: '2026-11-09T00:00:01.000Z',
      durationMs: 1,
      costUsd: undefined,
    });
    const codex = { provider: 'codex', model: 'gpt', effort: 'high' } as const;
    const failure = { kind: 'other', message: 'It stopped.' } as const;
    const phase = (attempt: WalkthroughRun | undefined) => {
      const current = walkthroughPhase({
        walkthrough: ready,
        freshness: 'changed',
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

describe('review code sections', () => {
  const steps = content({
    stops: [
      stop({ files: [{ path: 'both.ts', note: 'Both.' }] }),
      stop({ excerpts: [excerpt('old-name.ts')] }),
    ],
  });
  const branch = [
    { path: 'both.ts' },
    { path: 'new-name.ts', oldPath: 'old-name.ts' },
    { path: 'committed-elsewhere.ts' },
  ];
  const worktree = [{ path: 'both.ts' }, { path: 'dirty-elsewhere.ts' }];

  it('gives a step the committed and the uncommitted change of a file changed in both', () => {
    expect(
      reviewCodeSections({ content: steps, branch, worktree }).steps[0],
    ).toEqual({ branch: ['both.ts'], worktree: ['both.ts'] });
  });

  it('follows a rename into the step that cites the old path', () => {
    expect(
      reviewCodeSections({ content: steps, branch, worktree }).steps[1],
    ).toEqual({ branch: ['new-name.ts'], worktree: [] });
  });

  it('leaves only files no step cites outside the steps', () => {
    expect(
      reviewCodeSections({ content: steps, branch, worktree }).outside,
    ).toEqual({
      branch: ['committed-elsewhere.ts'],
      worktree: ['dirty-elsewhere.ts'],
    });
  });

  it('names each uncovered file once, and committed ones only after the branch is read', () => {
    const outside = { branch: ['a.ts', 'b.ts'], worktree: ['b.ts', 'c.ts'] };
    expect(uncoveredPaths(outside, true)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(uncoveredPaths(outside, false)).toEqual(['b.ts', 'c.ts']);
  });

  it('keeps a committed file and its staged rename in the step that cites the new name', () => {
    const renamed = content({
      stops: [stop({ files: [{ path: 'new-name.ts', note: 'Renamed.' }] })],
    });
    const working = [
      {
        path: 'new-name.ts',
        fingerprint: undefined,
        comparisons: [
          {
            scope: 'staged',
            kind: 'renamed',
            oldPath: 'old-name.ts',
            newPath: 'new-name.ts',
            oldMode: '100644',
            newMode: '100644',
            oldOid: 'a'.repeat(40),
            newOid: 'b'.repeat(40),
            supported: true,
          },
        ],
      },
    ] satisfies ReadChangesResponse['changes'];
    expect(
      reviewCodeSections({
        content: renamed,
        branch: [{ path: 'old-name.ts' }],
        worktree: working,
      }),
    ).toEqual({
      steps: [{ branch: ['old-name.ts'], worktree: ['new-name.ts'] }],
      outside: { branch: [], worktree: [] },
    });
  });

  it('puts every changed file outside the steps without a walkthrough', () => {
    expect(
      reviewCodeSections({ content: undefined, branch, worktree }),
    ).toEqual({
      steps: [],
      outside: {
        branch: ['both.ts', 'new-name.ts', 'committed-elsewhere.ts'],
        worktree: ['both.ts', 'dirty-elsewhere.ts'],
      },
    });
  });
});

describe('eager review sections', () => {
  const code = (branch: number, worktree: number) => ({
    branch: Array.from({ length: branch }, (_, index) => `b${index}`),
    worktree: Array.from({ length: worktree }, (_, index) => `w${index}`),
  });

  it('loads sections in page order until the budget of files is spent', () => {
    expect(
      eagerSections(
        {
          steps: [code(1, 1), code(1, 1), code(25, 25), code(25, 25)],
          outside: code(3, 0),
        },
        true,
        25,
      ),
    ).toEqual({ steps: [true, true, true, false], outside: false });
  });

  it('counts only local files until the branch comparison is known', () => {
    expect(
      eagerSections(
        { steps: [code(30, 1), code(30, 1)], outside: code(0, 0) },
        false,
        2,
      ),
    ).toEqual({ steps: [true, true], outside: false });
  });
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

describe('walkthrough update status', () => {
  const saved = () => ({
    ...run({
      status: 'ready',
      content: { ...content(), version: 1, stops: [] },
      writtenAt: '2026-11-12T12:00:00Z',
      durationMs: 1,
      costUsd: undefined,
    }),
    id: 'saved',
    createdAt: '2026-11-12T11:00:00Z',
  });
  const accepted = () => ({
    ...run({ status: 'queued' }),
    id: 'accepted',
    createdAt: '2026-11-12T12:00:00Z',
  });

  it('keeps an accepted update visible between the request finishing and the next server read', () => {
    const before = walkthroughPhase(read(saved(), true));
    const phase = acknowledgedWalkthroughPhase(before, accepted());
    expect(phase).toMatchObject({
      kind: 'ready',
      run: { id: 'saved' },
      attempt: { id: 'accepted', state: { status: 'queued' } },
    });
    const observed = walkthroughPhase({
      walkthrough: saved(),
      attempt: { ...accepted(), state: { status: 'running' } },
      freshness: 'changed',
    });
    expect(acknowledgedWalkthroughPhase(observed, accepted())).toMatchObject({
      attempt: { state: { status: 'running' } },
    });
    const complete = walkthroughPhase(
      read({ ...saved(), id: 'accepted', createdAt: accepted().createdAt }),
    );
    expect(acknowledgedWalkthroughPhase(complete, accepted())).toMatchObject({
      kind: 'ready',
      run: { id: 'accepted' },
      attempt: undefined,
    });
    expect(
      acknowledgedWalkthroughPhase({ kind: 'unwritten' }, accepted()),
    ).toMatchObject({ kind: 'writing', run: { id: 'accepted' } });
  });

  it('does not replace a newer server attempt or a different branch with an old acknowledgement', () => {
    const newer = walkthroughPhase({
      walkthrough: saved(),
      attempt: {
        ...accepted(),
        id: 'newer',
        createdAt: '2026-11-12T13:00:00Z',
      },
      freshness: 'changed',
    });
    expect(acknowledgedWalkthroughPhase(newer, accepted())).toEqual(newer);
    const other = walkthroughPhase(read({ ...saved(), branch: 'other' }));
    expect(acknowledgedWalkthroughPhase(other, accepted())).toEqual(other);
  });

  it('retains the stopped stage and real log on failure without claiming completion', () => {
    const stopped = {
      ...accepted(),
      state: {
        status: 'failed',
        failure: { kind: 'other', message: 'Writer disconnected.' },
      } as const,
      progress: [
        {
          stage: 'queued' as const,
          at: '2026-11-12T12:00:00Z',
          message: 'Captured the change.',
        },
        {
          stage: 'writing' as const,
          at: '2026-11-12T12:00:01Z',
          message: 'Claude is writing.',
        },
        {
          stage: 'failed' as const,
          at: '2026-11-12T12:00:02Z',
          message: 'Writer disconnected.',
        },
      ],
    };
    const status = walkthroughProgress(stopped, false);
    expect(status).toMatchObject({
      label: 'Update failed',
      completed: 3,
      total: 5,
      active: false,
    });
    expect(status.entries.at(-1)?.message).toBe('Writer disconnected.');
    expect(walkthroughProgress(stopped, false, true).label).toBe(
      'Writing failed',
    );
    expect(walkthroughProgress(saved(), false)).toMatchObject({
      label: 'Walkthrough saved',
      completed: 5,
      active: false,
      entries: [],
    });
    expect(walkthroughProgress(saved(), true)).toMatchObject({
      label: 'Requesting update',
      completed: 0,
      active: true,
    });
  });

  it('describes verified freshness and stays silent when it could not check', () => {
    expect(walkthroughFreshnessText('current')).toBe(
      'Up to date with the current work.',
    );
    expect(walkthroughFreshnessText('unknown')).toBeUndefined();
    expect(walkthroughFreshnessText('changed')).toBe(
      'The work changed after this walkthrough’s snapshot. Update to include the latest changes.',
    );
  });
});

it('shows a start failure only before a page exists and retains the failed run identity', () => {
  const failure = { kind: 'signed_out', message: 'Sign in again.' } as const;
  expect(initialWriteFailure({ kind: 'unwritten' }, failure)).toEqual({
    failure: { kind: 'signed_out', message: 'Sign in again.' },
    run: undefined,
  });
  const failed = run({ status: 'failed', failure });
  expect(
    initialWriteFailure({ kind: 'failed', run: failed, failure }, failure),
  ).toMatchObject({ run: { id: 'run' }, failure: { kind: 'signed_out' } });
  expect(initialWriteFailure({ kind: 'unwritten' }, undefined)).toBeUndefined();
  expect(
    initialWriteFailure(
      { kind: 'writing', run: run({ status: 'running' }) },
      failure,
    ),
  ).toBeUndefined();
});

describe('undecidedCallStep', () => {
  const calls = content({
    stops: [
      { ...stop(), title: 'Read the list' },
      {
        ...stop({ callouts: [{ attention, comparison: undefined }] }),
        title: 'Choose empty search',
      },
      {
        ...stop({
          callouts: [
            { attention, comparison: undefined },
            { attention, comparison: undefined },
          ],
        }),
        title: 'Name the count',
      },
    ],
  });

  it('names the first step with a call nobody marked decided', () => {
    expect(undecidedCallStep(calls, [])).toBe(2);
    expect(undecidedCallStep(calls, [{ step: 2, call: 0 }])).toBe(3);
    expect(
      undecidedCallStep(calls, [
        { step: 2, call: 0 },
        { step: 3, call: 0 },
      ]),
    ).toBe(3);
  });

  it('waits for the decisions before calling the calls settled', () => {
    expect(undecidedCallStep(calls, undefined)).toBe('reading');
    expect(undecidedCallStep(calls, undefined, true)).toBe('unreadable');
    expect(undecidedCallStep(content({ stops: [stop()] }), undefined)).toBe(
      undefined,
    );
  });

  it('is settled once every call is decided, and counts them', () => {
    const all = [
      { step: 2, call: 0 },
      { step: 3, call: 0 },
      { step: 3, call: 1 },
    ];
    expect(undecidedCallStep(calls, all)).toBeUndefined();
    expect(callDecisionProgress(calls, all)).toEqual({ total: 3, decided: 3 });
    expect(callDecisionProgress(calls, [{ step: 3, call: 1 }])).toEqual({
      total: 3,
      decided: 1,
    });
    expect(callDecisionProgress(calls, [{ step: 1, call: 0 }])).toEqual({
      total: 3,
      decided: 0,
    });
  });
});

describe('call choices', () => {
  const comparison = {
    columns: ['Show all notes', 'Show no notes'],
    rows: [['Browsing works', 'Quiet first view']],
  };

  it('marks the option the change implements and says what each choice means for the code', () => {
    expect(
      callChoices({ ...comparison, implemented: 'Show all notes' }),
    ).toEqual([
      {
        option: 'Show all notes',
        implemented: true,
        effect: 'Keeps the code as it is.',
      },
      {
        option: 'Show no notes',
        implemented: false,
        effect: 'Needs a new commit: this change does not do this yet.',
      },
    ]);
  });

  it('claims nothing about the code when the writer named no implemented option', () => {
    expect(callChoices(comparison)).toEqual([
      { option: 'Show all notes', implemented: false, effect: undefined },
      { option: 'Show no notes', implemented: false, effect: undefined },
    ]);
  });

  it('flags a decision the change does not implement', () => {
    const implemented = { ...comparison, implemented: 'Show all notes' };
    expect(decidedAgainstChange(implemented, 'Show no notes')).toBe(true);
    expect(decidedAgainstChange(implemented, 'Show all notes')).toBe(false);
    expect(decidedAgainstChange(comparison, 'Show no notes')).toBe(false);
    expect(decidedAgainstChange(implemented, undefined)).toBe(false);
  });

  it('says what choosing does to Merge in words true for every option', () => {
    expect(callDeciding(comparison)).toBe(
      'Choosing records your call, and Merge stops waiting for it. Porcelain changes no code.',
    );
    expect(callDeciding({ ...comparison, implemented: 'Show all notes' })).toBe(
      'Choosing records your call. Merge stops waiting for it unless the call needs a new commit. Porcelain changes no code.',
    );
    expect(callDeciding(undefined)).toBe(
      'Choosing records your call, and Merge stops waiting for it. Porcelain changes no code.',
    );
  });

  it('names the steps whose call was decided against what the change does', () => {
    const implemented = { ...comparison, implemented: 'Show all notes' };
    const calls = content({
      stops: [
        stop({ callouts: [{ attention, comparison: implemented }] }),
        stop({ callouts: [{ attention, comparison }] }),
        stop({
          callouts: [
            { attention, comparison: implemented },
            { attention, comparison: implemented },
          ],
        }),
      ],
    });
    expect(callsNeedingCommit(calls, undefined)).toEqual([]);
    expect(callsNeedingCommit(calls, [])).toEqual([]);
    expect(
      callsNeedingCommit(calls, [
        { step: 1, call: 0, option: 'Show all notes' },
        { step: 2, call: 0, option: 'Show no notes' },
        { step: 3, call: 0, option: undefined },
      ]),
    ).toEqual([]);
    expect(
      callsNeedingCommit(calls, [
        { step: 3, call: 1, option: 'Show no notes' },
        { step: 1, call: 0, option: 'Show no notes' },
        { step: 3, call: 0, option: 'Show all notes' },
      ]),
    ).toEqual([1, 3]);
  });

  it('never calls a decision that holds Merge done', () => {
    const implemented = { ...comparison, implemented: 'Show all notes' };
    expect(callState(implemented, undefined)).toBe('open');
    expect(callState(implemented, { option: 'Show all notes' })).toBe(
      'decided',
    );
    expect(callState(implemented, { option: 'Show no notes' })).toBe(
      'needs-commit',
    );
    expect(callState(comparison, { option: 'Show no notes' })).toBe('decided');
    expect(callState(undefined, { option: undefined })).toBe('decided');
  });

  it('gives a step the state of its least settled call', () => {
    const implemented = { ...comparison, implemented: 'Show all notes' };
    const calls = content({
      stops: [
        stop({
          callouts: [
            { attention, comparison: implemented },
            { attention, comparison: implemented },
          ],
        }),
        stop({}),
      ],
    });
    expect(stepCallState(calls, 1, undefined)).toBe('open');
    expect(
      stepCallState(calls, 1, [{ step: 1, call: 0, option: 'Show no notes' }]),
    ).toBe('open');
    expect(
      stepCallState(calls, 1, [
        { step: 1, call: 0, option: 'Show no notes' },
        { step: 1, call: 1, option: 'Show all notes' },
      ]),
    ).toBe('needs-commit');
    expect(
      stepCallState(calls, 1, [
        { step: 1, call: 0, option: 'Show all notes' },
        { step: 1, call: 1, option: 'Show all notes' },
      ]),
    ).toBe('decided');
    expect(stepCallState(calls, 2, [])).toBeUndefined();
  });
});

describe('where a call was decided', () => {
  const phone = 'a6f3c1d2-0000-4000-8000-000000000001';
  const laptop = 'a6f3c1d2-0000-4000-8000-000000000002';
  const labels = new Map([[phone, 'Fábio’s iPhone']]);

  it('says nothing when the decision came from the device in use', () => {
    expect(
      decisionPlace({ kind: 'owner' }, { kind: 'owner' }, labels),
    ).toBeUndefined();
    expect(
      decisionPlace(
        { kind: 'device', deviceId: phone },
        { kind: 'device', deviceId: phone },
        labels,
      ),
    ).toBeUndefined();
  });

  it('names another device, or says only that it was another one', () => {
    expect(
      decisionPlace(
        { kind: 'device', deviceId: phone },
        { kind: 'owner' },
        labels,
      ),
    ).toBe('on Fábio’s iPhone');
    expect(
      decisionPlace(
        { kind: 'device', deviceId: phone },
        { kind: 'device', deviceId: laptop },
        undefined,
      ),
    ).toBe('on another device');
    expect(
      decisionPlace(
        { kind: 'device', deviceId: laptop },
        { kind: 'owner' },
        labels,
      ),
    ).toBe('on another device');
    expect(
      decisionPlace(
        { kind: 'owner' },
        { kind: 'device', deviceId: phone },
        labels,
      ),
    ).toBe('on the computer');
  });

  it('claims no place while the device in use is unknown', () => {
    expect(
      decisionPlace({ kind: 'device', deviceId: phone }, undefined, labels),
    ).toBeUndefined();
  });
});

it('states what the after screenshot shows as the verified claim', () => {
  const screenshot = (label: 'Before' | 'After', shows: string) => ({
    assetId: label,
    shows,
    label,
    enlarge: `Enlarge ${label}`,
  });
  expect(
    screenshotClaim([
      screenshot('Before', 'The results without a count'),
      screenshot('After', 'The results with “3 notes found”'),
    ]),
  ).toBe('The results with “3 notes found”');
});

describe('a step’s files on one side of the Changes panel', () => {
  const code = {
    branch: ['src/search.ts', 'src/view.ts'],
    worktree: ['README.md', 'src/view.ts'],
  };

  it('lists the committed files and names the uncommitted-only ones as elsewhere', () => {
    expect(reviewCodeIn(code, 'branch')).toEqual({
      here: ['src/search.ts', 'src/view.ts'],
      elsewhere: ['README.md'],
    });
    expect(reviewCodeIn(code, 'worktree')).toEqual({
      here: ['README.md', 'src/view.ts'],
      elsewhere: ['src/search.ts'],
    });
  });

  it('counts a file changed on both sides once, as the step’s full diff does', () => {
    expect(reviewCodeCount(code)).toBe(3);
  });
});
