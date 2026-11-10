import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { seedStoredWalkthroughs } from './walkthrough-fixture.ts';

const execute = promisify(execFile);

export async function prepareWalkthroughSample(
  repository: string,
): Promise<void> {
  await execute('git', ['switch', '-c', 'feature/note-search'], {
    cwd: repository,
  });
  await mkdir(join(repository, 'src'), { recursive: true });
  await writeFile(
    join(repository, 'src/search.ts'),
    'export function findNotes(notes: readonly string[], query: string) {\n  return notes.filter((note) => note.toLowerCase().includes(query.toLowerCase()));\n}\n',
  );
  await execute('git', ['add', 'src/search.ts'], { cwd: repository });
  await execute('git', ['commit', '-m', 'Search notes by title'], {
    cwd: repository,
  });
  await writeFile(
    join(repository, 'src/results.ts'),
    'export function resultLabel(count: number) {\n  return `${count} notes found`;\n}\n',
  );
  await execute('git', ['add', 'src/results.ts'], { cwd: repository });
  await execute('git', ['commit', '-m', 'Describe the search results'], {
    cwd: repository,
  });
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
  const now = '2026-11-10T00:00:00.000Z';
  seedStoredWalkthroughs(directory, {
    jobs: [
      {
        worktreePath: repository,
        files: ['src/search.ts', 'src/results.ts'].map((path) => ({
          path,
          hunks: [{ oldStart: 0, oldEnd: 0, newStart: 1, newEnd: 3 }],
        })),
        run: {
          ...ids,
          id: 'sample-walkthrough',
          branch: 'feature/note-search',
          baseOid: await git('main'),
          headOid: await git('HEAD'),
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
            content: {
              outcome: 'needs_you',
              title: 'Find notes by title',
              summary:
                'Title search and a result count are ready. One call is yours.',
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
                  attention: {
                    kind: 'product',
                    question: 'Should an empty search show every note?',
                    note: 'Showing all notes makes browsing easy; showing none keeps the first view quiet.',
                  },
                  excerpts: [],
                  evidence: [],
                  files: [
                    {
                      path: 'src/search.ts',
                      note: 'Owns title matching and the empty query behavior.',
                    },
                  ],
                },
                {
                  title: 'Describe the result count',
                  explanation:
                    'The result label lives separately from matching so presentation can change without changing which notes appear.',
                  excerpts: [],
                  evidence: [],
                  files: [
                    {
                      path: 'src/results.ts',
                      note: 'Formats the number of matching notes.',
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
            },
          },
        },
      },
    ],
  });
}
