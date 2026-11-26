import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import {
  fixtureCheckResults,
  fixtureScreenshot,
} from '@porcelain/server/kit/fixture-screenshot';
import { scriptedWalkthroughs } from '@porcelain/server/kit/walkthrough-fixture';
import { worktreeSession } from './walkthrough-conversations.ts';
import type { World } from './world.ts';

export async function walkthroughBlocksFixture(world: World): Promise<string> {
  const session = await worktreeSession(world, (worktrees) => worktrees[0]);
  await mkdir(join(session.repository, 'src'), { recursive: true });
  await session.writeFile('src/legacy.ts', 'export const legacy = true;\n');
  await session.writeFile('src/obsolete.ts', 'export const obsolete = true;\n');
  const kept = Array.from({ length: 80 }, (_, line) => `Kept ${line + 1}\n`);
  const dropped = Array.from(
    { length: 80 },
    (_, line) => `Dropped ${line + 1}\n`,
  );
  await session.writeFile('src/drafts.ts', [...kept, ...dropped].join(''));
  await session.git('add', 'src/legacy.ts', 'src/obsolete.ts', 'src/drafts.ts');
  await session.git('commit', '-m', 'Add the old helpers');
  await session.git('branch', 'walkthrough-blocks-base');
  await session.writeFile(
    'src/search.ts',
    'export function findNotes(notes: readonly string[], query: string) {\n  return notes.filter((note) => note.includes(query));\n}\n',
  );
  await session.writeFile(
    'src/results.ts',
    'export function resultLabel(count: number) {\n  return `${count} notes found`;\n}\n',
  );
  await session.writeFile(
    'src/labels.ts',
    "export const EMPTY_LABEL = 'No notes yet';\n",
  );
  await rm(join(session.repository, 'src/legacy.ts'));
  await session.git(
    'add',
    'src/search.ts',
    'src/results.ts',
    'src/labels.ts',
    'src/legacy.ts',
  );
  await session.git('commit', '-m', 'Search notes and count them');
  await rm(join(session.repository, 'src/obsolete.ts'));
  await session.writeFile('src/drafts.ts', kept.join(''));
  await session.git('add', 'src/drafts.ts');
  await rm(join(session.repository, 'src/drafts.ts'));
  await mkdir(join(session.repository, 'notes'), { recursive: true });
  await session.writeFile('notes/scratch.md', 'A scratch note.\n');
  const writer = await scriptedWalkthroughs(
    session,
    world.server.manifestPath,
    {
      answer: 'Noted.',
      costUsd: 0,
      failurePath: join(session.projectHome, 'blocks-failure'),
      postsPath: join(session.projectHome, 'blocks-posts'),
    },
  );
  const run = await writer.write(
    {
      version: 1,
      outcome: 'needs_you',
      title: 'Find notes by title',
      summary: 'Title search and a result count. One call is yours.',
      growth: [],
      stops: [
        {
          title: 'Choose the empty search behavior',
          explanation: 'An empty query currently returns every note.',
          blocks: [
            {
              kind: 'callout',
              attention: {
                kind: 'product',
                question: 'Should an empty search show every note?',
                note: 'Showing all notes makes browsing easy.',
              },
              comparison: {
                columns: ['Show all notes', 'Show no notes'],
                rows: [
                  ['Browsing works immediately', 'The first view stays quiet'],
                ],
                implemented: 'Show all notes',
              },
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
              files: [
                { path: 'src/search.ts', note: 'Matches titles by substring.' },
              ],
            },
            {
              kind: 'diff_excerpt',
              path: 'src/labels.ts',
              side: 'new',
              start: 1,
              end: 1,
              caption: 'An empty list gets its own words.',
            },
          ],
        },
        {
          title: 'Describe the result count',
          explanation: 'The label lives apart from matching.',
          blocks: [
            {
              kind: 'files',
              files: [
                {
                  path: 'src/results.ts',
                  note: 'Formats the number of matching notes.',
                },
              ],
            },
          ],
        },
        {
          title: 'Retire the old helpers',
          explanation: 'Both helpers had no callers left.',
          blocks: [
            {
              kind: 'files',
              files: [
                { path: 'src/legacy.ts', note: 'Removed in the branch.' },
                { path: 'src/obsolete.ts', note: 'Removed locally.' },
                { path: 'src/drafts.ts', note: 'Trimmed, then removed.' },
                { path: 'notes/scratch.md', note: 'A new note.' },
              ],
            },
          ],
        },
        {
          title: 'Keep the module small',
          explanation: 'Nothing else changed.',
          blocks: [],
        },
      ],
      onlyInTranscript: [],
      stillUnclear: [],
    },
    { base: 'refs/heads/walkthrough-blocks-base' },
  );
  await writer.attachEvidence(
    run.id,
    2,
    [
      {
        id: 'blocks-before',
        mediaType: 'image/png',
        caption: 'Results without a count',
        bytes: fixtureScreenshot([113, 113, 122]),
      },
      {
        id: 'blocks-after',
        mediaType: 'image/png',
        caption: 'Results with “3 notes found”',
        bytes: fixtureScreenshot([37, 99, 235]),
      },
    ],
    {
      state: 'FAILURE',
      checksTruncated: true,
      results: fixtureCheckResults,
    },
  );
  return run.headOid;
}
