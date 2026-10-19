import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Schema } from 'effect';
import { publishReviewResponseSchema } from '@porcelain/contracts/reviews';
import { kitHeaders } from '@porcelain/server/kit/isolated-server';
import { toolCall, toolText } from '@porcelain/server/kit/requests';
import type { Session } from '@porcelain/server/kit/session';

const execute = promisify(execFile);
const layerId = 'cfa1b255-f3f9-4a95-aadb-98e37fa7606e';
const stepId = '630c458d-33b7-4906-97f2-51c077d05a96';
const name = 'durable-review';
const filename = 'review-page.ts';

export async function durableReviewFixture(
  session: Session,
  operation: 'publish' | 'remove-worktree' | 'advance' | 'remove-repository',
  title: string,
) {
  const worktree = join(session.projectHome, name);
  const git = (...args: string[]) => execute('git', ['-C', worktree, ...args]);
  if (operation === 'remove-repository') {
    await rename(session.repository, `${session.repository}-unavailable`);
    return JSON.stringify({ unavailable: session.repository });
  }
  if (operation === 'advance') {
    await git(
      'commit',
      '--allow-empty',
      '-m',
      'Advance beyond the published review',
    );
    return JSON.stringify({
      headOid: (await git('rev-parse', 'HEAD')).stdout.trim(),
    });
  }
  if (operation === 'remove-worktree') {
    await session.git('worktree', 'remove', worktree);
    return JSON.stringify({ removed: worktree });
  }
  if (!existsSync(worktree)) {
    if ((await session.git('status', '--porcelain')).trim()) {
      await session.git('add', '--all');
      await session.git('commit', '-m', 'Commit the development fixture');
    }
    await session.git('worktree', 'add', '-b', name, worktree);
    await writeFile(
      join(worktree, 'retired.ts'),
      'export const retired = true;\n',
    );
    await git('add', '--all');
    await git('commit', '-m', 'Prepare the removal fixture');
    await git('branch', 'review-page-base');
  }
  const count = Number(
    await readFile(
      join(session.projectHome, 'review-page', 'revision'),
      'utf8',
    ).catch(() => '0'),
  );
  await rm(join(worktree, 'retired.ts'), { force: true });
  await writeFile(
    join(worktree, filename),
    `export const revision = ${count + 1};\nexport const title = ${JSON.stringify(title)};\n`,
  );
  await git('add', '--all');
  await git(
    'commit',
    '--allow-empty',
    '-m',
    `Publish review revision ${count + 1}`,
  );
  const response = await session.send({
    ...toolCall({ ...session, repository: worktree }, 1, 'publish_review', {
      expectedRevision: count,
      base: 'refs/heads/review-page-base',
      verdict: {
        asked: {
          text: 'Read one committed review after checkout cleanup',
          links: [
            {
              title: 'Approved design',
              url: 'https://github.com/FabioFiorita/porcelain/issues/422',
            },
          ],
        },
        recommendation: count === 0 ? 'hold' : 'merge',
        reasons: [
          'The review belongs to the project and retains each committed revision',
        ],
        notProven: [{ what: 'Desktop app', why: 'Mac is off' }],
        removed: [
          {
            behavior: 'Retired fixture owner',
            why: 'The revision replaces its implementation',
            paths: ['retired.ts'],
          },
        ],
      },
      layers: [
        {
          id: layerId,
          title,
          summary:
            'Keep the reviewed code and its explanation after removing the publishing checkout.',
          lanes: ['Client'],
          steps: [
            {
              id: stepId,
              lane: 0,
              kind: 'changed',
              title: 'Read the retained revision',
              text: 'The revision number is fixed at publication.',
              pointer: { path: filename, startLine: 1, endLine: 2 },
            },
          ],
        },
      ],
      diagram: {
        after: {
          boxes: [
            {
              id: 'b9d158f2-a920-41b3-81f3-1ac88acbd1fd',
              label: 'Revision owner',
              change: 'new',
              layerId,
            },
            {
              id: 'd2b37d65-fb56-41bb-aaba-6ec0497f253e',
              label: 'Retired fixture owner',
              change: 'removed',
              layerId,
            },
          ],
          arrows: [],
        },
      },
      proof: {
        checks: [
          { name: 'Committed fixture', result: 'pass' },
          {
            name: 'Negative control',
            result: 'fail',
            output: 'A failing proof check remains visible',
          },
        ],
      },
    }),
    headers: {
      ...toolCall({ ...session, repository: worktree }, 1, 'publish_review', {})
        .headers,
      ...kitHeaders,
    },
  });
  if (response.status !== 200)
    throw new Error(
      `Review fixture answered ${response.status}: ${JSON.stringify(response.body)}`,
    );
  const published = Schema.decodeUnknownSync(publishReviewResponseSchema)(
    JSON.parse(toolText(response.body)),
  );
  await mkdir(join(session.projectHome, 'review-page'), { recursive: true });
  await writeFile(
    join(session.projectHome, 'review-page', 'revision'),
    String(published.revision),
  );
  return JSON.stringify({
    reviewId: published.reviewId,
    revision: published.revision,
    headOid: published.headOid,
    layerId,
    worktree,
  });
}
