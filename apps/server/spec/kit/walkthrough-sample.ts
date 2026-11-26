import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  captureWalkthroughFixture,
  seedStoredWalkthroughs,
} from './walkthrough-fixture.ts';
import { fixtureScreenshot } from './fixture-screenshot.ts';
import type {
  WalkthroughContent,
  WalkthroughDraft,
} from '@porcelain/walkthroughs/models';

const execute = promisify(execFile);

export const sampleWalkthroughCommits: readonly {
  readonly path: string;
  readonly text: string;
  readonly message: string;
}[] = [
  {
    path: 'src/search.ts',
    text: 'export function findNotes(notes: readonly string[], query: string) {\n  return notes.filter((note) => note.toLowerCase().includes(query.toLowerCase()));\n}\n',
    message: 'Search notes by title',
  },
  {
    path: 'src/results.ts',
    text: 'export function resultLabel(count: number) {\n  return `${count} notes found`;\n}\n',
    message: 'Describe the search results',
  },
  {
    path: 'src/search-view.ts',
    text: "import { findNotes } from './search';\nimport { resultLabel } from './results';\n\nexport function renderSearch(notes: readonly string[], query: string) {\n  const matches = findNotes(notes, query);\n  return { heading: resultLabel(matches.length), items: matches };\n}\n",
    message: 'Show the search results',
  },
];

export async function prepareWalkthroughSample(
  repository: string,
): Promise<void> {
  await execute('git', ['switch', '-c', 'feature/note-search'], {
    cwd: repository,
  });
  await mkdir(join(repository, 'src'), { recursive: true });
  for (const commit of sampleWalkthroughCommits) {
    await writeFile(join(repository, commit.path), commit.text);
    await execute('git', ['add', commit.path], { cwd: repository });
    await execute('git', ['commit', '-m', commit.message], {
      cwd: repository,
    });
  }
}

export const sampleWalkthroughDraft: WalkthroughDraft = {
  version: 1 as const,
  outcome: 'needs_you',
  title: 'Find notes by title',
  summary: 'Title search and a result count are ready. One call is yours.',
  growth: [
    {
      change: 'added',
      what: 'Title search',
      note: 'A small function matches titles without case sensitivity.',
    },
    {
      change: 'added',
      what: 'Result label',
      note: 'The interface can describe how many notes matched.',
    },
  ],
  stops: [
    {
      title: 'Choose the empty search behavior',
      explanation:
        'Search matches a title when it contains the query. An empty query currently returns every note.',
      blocks: [
        {
          kind: 'callout',
          attention: {
            kind: 'product',
            question: 'Should an empty search show every note?',
            note: 'Showing all notes makes browsing easy; showing none keeps the first view quiet.',
          },
          comparison: {
            columns: ['Show all notes', 'Show no notes'],
            rows: [
              ['Browsing works immediately', 'The first view stays quiet'],
            ],
          },
        },
        {
          kind: 'diagram',
          title: 'An empty query, end to end',
          layout: 'sequence',
          nodes: [
            {
              id: 'view',
              label: 'renderSearch',
              kind: 'function',
              mark: 'added',
              anchor: {
                path: 'src/search-view.ts',
                lines: { side: 'new', start: 4, end: 7 },
              },
            },
            {
              id: 'search',
              label: 'findNotes',
              kind: 'function',
              mark: 'added',
              anchor: {
                path: 'src/search.ts',
                lines: { side: 'new', start: 1, end: 3 },
              },
            },
            {
              id: 'label',
              label: 'resultLabel',
              kind: 'function',
              mark: 'added',
              anchor: {
                path: 'src/results.ts',
                lines: { side: 'new', start: 1, end: 3 },
              },
            },
          ],
          edges: [
            { from: 'view', to: 'search', label: 'query ""' },
            { from: 'search', to: 'view', label: 'every note' },
            { from: 'view', to: 'label', label: 'matches.length' },
            { from: 'label', to: 'view', label: '"3 notes found"' },
          ],
        },
        {
          kind: 'diff_excerpt',
          path: 'src/search.ts',
          side: 'new',
          start: 2,
          end: 2,
          caption: 'An empty string matches every title.',
        },
        {
          kind: 'files',
          files: [{ path: 'README.md', note: 'Introduces the sample.' }],
        },
      ],
    },
    {
      title: 'Describe the result count',
      explanation:
        'The result label lives separately from matching so presentation can change without changing which notes appear.',
      blocks: [
        {
          kind: 'diagram',
          title: 'Matching and wording stay apart',
          layout: 'flow',
          nodes: [
            {
              id: 'view',
              label: 'search-view.ts',
              kind: 'file',
              note: 'Builds the heading and the list',
              mark: 'added',
              anchor: { path: 'src/search-view.ts' },
            },
            {
              id: 'search',
              label: 'findNotes',
              kind: 'function',
              note: 'Case-insensitive title match',
              mark: 'added',
              anchor: {
                path: 'src/search.ts',
                lines: { side: 'new', start: 1, end: 3 },
              },
            },
            {
              id: 'label',
              label: 'resultLabel',
              kind: 'function',
              note: 'Formats “N notes found”',
              mark: 'added',
              anchor: {
                path: 'src/results.ts',
                lines: { side: 'new', start: 1, end: 3 },
              },
            },
            {
              id: 'notes',
              label: 'notes: readonly string[]',
              kind: 'type',
              note: 'Passed in by the caller',
            },
          ],
          edges: [
            { from: 'view', to: 'search', label: 'calls' },
            { from: 'view', to: 'label', label: 'passes count' },
            { from: 'search', to: 'notes', label: 'filters' },
          ],
        },
        {
          kind: 'files',
          files: [
            {
              path: 'src/results.ts',
              note: 'Formats the number of matching notes.',
            },
            {
              path: 'src/search-view.ts',
              note: 'Puts the count above the matches.',
            },
          ],
        },
      ],
    },
  ],
  onlyInTranscript: [
    {
      point: 'Sample scope',
      answer:
        'This is synthetic development content. It does not call a coding provider.',
    },
  ],
  stillUnclear: [
    'The preferred wording for a single matching note has not been chosen.',
  ],
};

type StoredBlock = WalkthroughContent['stops'][number]['blocks'][number];

function sampleContent(treeOid: string, headOid: string): WalkthroughContent {
  const [first, second] = sampleWalkthroughDraft.stops;
  if (!first || !second) throw new Error('The sample has two steps.');
  return {
    ...sampleWalkthroughDraft,
    stops: [
      {
        ...first,
        blocks: first.blocks.flatMap((block): StoredBlock[] =>
          block.kind === 'diff_excerpt'
            ? [{ ...block, contentTreeOid: treeOid, headOid }]
            : block.kind === 'checks'
              ? []
              : [block],
        ),
      },
      {
        ...second,
        blocks: [
          ...second.blocks.flatMap((block): StoredBlock[] =>
            block.kind === 'diff_excerpt' || block.kind === 'checks'
              ? []
              : [block],
          ),
          {
            kind: 'checks',
            headOid,
            state: 'SUCCESS',
            checksTruncated: false,
            results: [
              { name: 'Unit tests', status: 'SUCCESS' },
              { name: 'Browser tests', status: 'SUCCESS' },
            ],
          },
          {
            kind: 'before_after',
            before: {
              assetId: 'sample-before',
              shows: 'The search results without a count',
            },
            after: {
              assetId: 'sample-after',
              shows: 'The search results with “3 notes found”',
            },
          },
        ],
      },
    ],
  };
}

export async function seedWalkthroughSample(
  directory: string,
  repository: string,
  ids: { projectId: string; worktreeId: string },
): Promise<void> {
  const git = async (ref: string) =>
    (
      await execute('git', ['rev-parse', ref], { cwd: repository })
    ).stdout.trim();
  const baseOid = await git('main');
  const headOid = await git('HEAD');
  const snapshot = await captureWalkthroughFixture(repository, baseOid);
  const now = '2026-11-10T00:00:00.000Z';
  seedStoredWalkthroughs(directory, {
    assets: [
      {
        runId: 'sample-walkthrough',
        id: 'sample-before',
        mediaType: 'image/png',
        caption: 'The search results without a count',
        bytes: fixtureScreenshot([113, 113, 122]),
      },
      {
        runId: 'sample-walkthrough',
        id: 'sample-after',
        mediaType: 'image/png',
        caption: 'The search results with “3 notes found”',
        bytes: fixtureScreenshot([37, 99, 235]),
      },
    ],
    jobs: [
      {
        worktreePath: repository,
        patch: snapshot.patch,
        files: [
          ...['README.md', 'src/search.ts', 'src/results.ts'].map((path) => ({
            path,
            hunks: [{ oldStart: 0, oldEnd: 0, newStart: 1, newEnd: 3 }],
          })),
          {
            path: 'src/search-view.ts',
            hunks: [{ oldStart: 0, oldEnd: 0, newStart: 1, newEnd: 7 }],
          },
        ],
        run: {
          ...ids,
          id: 'sample-walkthrough',
          branch: 'feature/note-search',
          baseOid,
          baseRef: 'refs/heads/main',
          contentTreeOid: snapshot.treeOid,
          includesUncommitted: snapshot.treeOid !== snapshot.headTreeOid,
          headOid,
          writer: {
            provider: 'claude',
            model: 'synthetic-sample',
            effort: 'high',
          },
          createdAt: now,
          state: {
            status: 'ready',
            writtenAt: now,
            durationMs: 0,
            content: sampleContent(snapshot.treeOid, headOid),
          },
        },
      },
    ],
  });
}
