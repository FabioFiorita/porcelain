import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Socket } from 'node:net';
import { join } from 'node:path';
import { expect } from 'vite-plus/test';
import { apiError } from '../kit/answers.ts';
import { askServerOwner } from '../kit/owner.ts';
import { read } from '../kit/requests.ts';
import { handlerCoverage } from '../kit/route-coverage.ts';
import { test } from '../kit/server-test.ts';
import { list, record, text } from '../kit/session.ts';

function commentsView(value: unknown) {
  const view = record(value);
  return {
    ...view,
    markdown: text(view.markdown),
    comments: list(view.comments).map(record),
  };
}

const PATCH = '@@ -0,0 +1,3 @@\n+const a = 1;\n+const b = 2;\n+const c = 3;';

test('publishes only current drafts from the preview with confirmed text and posts a concurrent confirmation once', async ({
  session,
  server,
}) => {
  const manifest = record(
    JSON.parse(await readFile(server.manifestPath, 'utf8')),
  );
  const ghPath = join(text(manifest.bin), 'gh');
  const statePath = join(session.projectHome, 'comments-gh-state.json');
  const reviewsPath = join(session.projectHome, 'comments-gh-reviews');
  const branch = (await session.git('branch', '--show-current')).trim();
  await session.git(
    'remote',
    'add',
    'origin',
    'https://github.com/fixture/project.git',
  );
  await mkdir(join(session.repository, 'src'), { recursive: true });
  await session.writeFile(
    'src/app.ts',
    'const a = 1;\nconst b = 2;\nconst c = 3;\n',
  );
  await session.git('add', 'src/app.ts');
  await session.git('commit', '-m', 'Add the reviewed file');
  const headOid = (await session.git('rev-parse', 'HEAD')).trim();
  const state = { head: headOid, number: 7, gate: false };
  const gatePath = join(session.projectHome, 'reviews.sock');
  const waiting = new Set<Socket>();
  const gate = createServer((socket) => {
    waiting.add(socket);
    socket.once('close', () => waiting.delete(socket));
    if (waiting.size === 2) for (const peer of waiting) peer.end();
  });
  const save = () => writeFile(statePath, JSON.stringify(state));
  await save();
  await writeFile(reviewsPath, '');
  await writeFile(
    ghPath,
    `#!${process.execPath}
import fs from 'node:fs';
import { connect } from 'node:net';
const args = process.argv.slice(2);
const fixture = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));
const endpoint = args.find(arg => arg.startsWith('repos/')) ?? '';
const empty = { nodes: [], pageInfo: { hasNextPage: false } };
const pr = { number: fixture.number, title: 'Comment fixture', url: 'https://github.com/fixture/project/pull/' + fixture.number, state: 'OPEN', isDraft: false, author: { login: 'fixture' }, headRefName: ${JSON.stringify(branch)}, baseRefName: 'main', updatedAt: '2026-11-10T00:00:00Z', headRefOid: fixture.head, body: '', bodyHTML: '', mergeable: 'MERGEABLE', commits: { nodes: [] }, labels: empty, comments: empty, reviews: empty };
if (args[0] === 'auth' && args[1] === 'status') console.log(JSON.stringify(['fixture']));
else if (args[0] === 'auth' && args[1] === 'token') console.log('fixture-token');
else if (endpoint.endsWith('/reviews')) {
  fs.appendFileSync(${JSON.stringify(reviewsPath)}, fs.readFileSync(0, 'utf8') + '\\n');
  console.log(JSON.stringify({ html_url: 'https://github.com/fixture/project/pull/7#pullrequestreview-1' }));
} else if (endpoint.includes('/files')) console.log(JSON.stringify([{ filename: 'src/app.ts', patch: ${JSON.stringify(PATCH)} }]));
else if (endpoint.endsWith('/pulls/' + fixture.number)) console.log(JSON.stringify({ head: { sha: fixture.head } }));
else if (args.includes('graphql')) {
  if (fixture.gate && args.some(arg => arg.includes('open:'))) {
    await new Promise((resolve, reject) => {
      const socket = connect(${JSON.stringify(gatePath)});
      socket.once('end', resolve);
      socket.once('error', reject);
    });
  }
  console.log(JSON.stringify({ data: { repository: { pullRequest: pr, open: { nodes: [pr], pageInfo: { hasNextPage: false, endCursor: null } }, recent: empty } } }));
}
else console.log('{}');
`,
    { mode: 0o755 },
  );
  try {
    const root = `/api/worktrees/${session.worktreeId}/comments`;
    const view = async (
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
      path: string,
      body?: object,
    ) =>
      commentsView(
        await read(session, {
          method,
          path,
          ...(body === undefined ? {} : { body }),
        }),
      );
    const preview = async () =>
      read(session, { method: 'GET', path: `${root}/review` });

    const initial = await view('GET', root);
    expect(initial).toMatchObject({ branch, headOid, comments: [] });
    expect(await preview()).toEqual({
      kind: 'unavailable',
      reason: 'no-comments',
    });

    const inline = await view('POST', root, {
      anchor: {
        kind: 'lines',
        path: 'src/app.ts',
        side: 'additions',
        start: 1,
        end: 2,
        text: 'const a = 1;\nconst b = 2;',
      },
      text: 'Name these',
    });
    expect(inline.comments).toMatchObject([
      {
        anchor: { kind: 'lines', path: 'src/app.ts', start: 1, end: 2 },
        text: 'Name these',
        headOid,
        outdated: false,
        publication: { status: 'draft' },
      },
    ]);
    const lineId = text(inline.comments[0]?.id);
    const withFile = await view('POST', root, {
      anchor: { kind: 'file', path: 'README.md' },
      text: 'Is this still true?',
    });
    expect(withFile.comments).toHaveLength(2);
    const fileId = text(
      withFile.comments.find((comment) => comment.id !== lineId)?.id,
    );
    const edited = await view('PATCH', `${root}/${lineId}`, {
      text: 'Name these constants',
    });
    expect(
      edited.comments.find((comment) => comment.id === lineId),
    ).toMatchObject({
      text: 'Name these constants',
      publication: { status: 'draft' },
    });
    expect(edited.markdown).toContain('Name these constants');
    expect(await view('GET', root)).toEqual(edited);
    expect(
      commentsView(
        await askServerOwner(
          session.dataDirectory,
          'GET',
          `/worktree-comments?path=${encodeURIComponent(session.repository)}`,
        ),
      ),
    ).toEqual(edited);

    const missing = `${root}/00000000-0000-4000-8000-000000000001`;
    for (const request of [
      { method: 'PATCH', path: missing, body: { text: 'Lost' } },
      { method: 'DELETE', path: missing },
    ] as const) {
      const refused = await session.send(request);
      expect(refused.status, request.method).toBe(404);
      expect(refused.body).toEqual(
        apiError(404, 'Not Found', 'This comment no longer exists.'),
      );
    }

    const temporary = await view('POST', root, {
      anchor: { kind: 'file', path: 'README.md' },
      text: 'Remove this draft.',
    });
    const temporaryId = text(
      temporary.comments.find(
        (comment) => comment.text === 'Remove this draft.',
      )?.id,
    );
    expect(await preview()).toEqual({
      kind: 'available',
      pullRequest: {
        owner: 'fixture',
        repo: 'project',
        number: 7,
        url: 'https://github.com/fixture/project/pull/7',
        title: 'Comment fixture',
      },
      headOid,
      inline: [
        {
          id: lineId,
          path: 'src/app.ts',
          side: 'RIGHT',
          startLine: 1,
          line: 2,
          body: 'Name these constants',
        },
      ],
      general: expect.arrayContaining([
        expect.objectContaining({
          id: fileId,
          reason: 'file',
          body: 'Is this still true?',
        }),
        expect.objectContaining({
          id: temporaryId,
          reason: 'file',
          body: 'Remove this draft.',
        }),
      ]),
    });
    const publish = (body: object) =>
      session.send({ method: 'POST', path: `${root}/review`, body });

    const confirmation = {
      pullRequest: { owner: 'fixture', repo: 'project', number: 7 },
      headOid,
      summary: 'Two notes.',
      bodies: {
        [lineId]: 'Keep the names and document why.',
        [fileId]: 'Is this still true?',
        [temporaryId]: 'Remove this draft.',
      },
    };
    const stale = await publish({ ...confirmation, headOid: 'f'.repeat(40) });
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual(
      apiError(
        409,
        'Conflict',
        'The pull request has new commits since this preview. Review it again before posting.',
      ),
    );
    expect(await readFile(reviewsPath, 'utf8')).toBe('');

    state.number = 8;
    await save();
    const redirected = await publish(confirmation);
    expect(redirected.status).toBe(409);
    expect(redirected.body).toEqual(
      apiError(
        409,
        'Conflict',
        'The destination pull request changed. Go back and preview the review again.',
      ),
    );
    state.number = 7;
    await save();

    await session.writeFile(
      'src/app.ts',
      'const a = 10;\nconst b = 2;\nconst c = 3;\n',
    );
    const phoneEdit = await read(session, {
      method: 'PATCH',
      path: `${root}/${lineId}`,
      auth: 'desktop',
      body: { text: 'Keep the names but explain why.' },
    });
    expect(commentsView(phoneEdit).comments).toContainEqual(
      expect.objectContaining({
        id: lineId,
        text: 'Keep the names but explain why.',
      }),
    );
    const afterDelete = await view('DELETE', `${root}/${temporaryId}`);
    expect(afterDelete.comments.map(({ id }) => id)).toEqual(
      expect.arrayContaining([lineId, fileId]),
    );
    expect(afterDelete.comments).toHaveLength(2);
    const addedLater = await view('POST', root, {
      anchor: { kind: 'file', path: 'README.md' },
      text: 'Leave this for a later review.',
    });
    const addedLaterId = text(
      addedLater.comments.find(
        (comment) => comment.text === 'Leave this for a later review.',
      )?.id,
    );

    await new Promise<void>((resolve, reject) => {
      gate.once('error', reject);
      gate.listen(gatePath, resolve);
    });
    state.gate = true;
    await save();
    const responses = await Promise.all([
      publish(confirmation),
      publish(confirmation),
    ]);
    expect(responses.map((result) => result.status)).toEqual(
      expect.arrayContaining([200, 409]),
    );
    state.gate = false;
    await save();
    const refused = responses.find((result) => result.status === 409);
    expect(refused?.body).toEqual(
      apiError(
        409,
        'Conflict',
        'There are no drafts left to post. Go back to see the current comments.',
      ),
    );
    const published = responses.find((result) => result.status === 200)!;
    const answer = record(published.body);
    const url = 'https://github.com/fixture/project/pull/7#pullrequestreview-1';
    expect(answer.url).toBe(url);
    expect(
      commentsView(answer.view)
        .comments.filter(({ id }) => id !== addedLaterId)
        .map((comment) => {
          const publication = record(comment.publication);
          return {
            status: publication.status,
            url: publication.url,
            dated: typeof publication.publishedAt === 'string',
          };
        }),
    ).toEqual([
      { status: 'published', url, dated: true },
      { status: 'published', url, dated: true },
    ]);
    const posted = (await readFile(reviewsPath, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line): unknown => JSON.parse(line));
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      commit_id: headOid,
      event: 'COMMENT',
      body: expect.stringContaining(
        '**src/app.ts:1-2**\n\nKeep the names and document why.',
      ),
    });
    const review = record(posted[0]);
    expect(text(review.body)).toContain('Two notes.');
    expect(text(review.body)).toContain('Is this still true?');
    expect(text(review.body)).not.toContain('Keep the names but explain why.');
    expect(text(review.body)).not.toContain('Remove this draft.');
    expect(text(review.body)).not.toContain('Leave this for a later review.');
    expect(review.comments ?? []).toEqual([]);
    expect(await preview()).toMatchObject({
      kind: 'available',
      inline: [],
      general: [
        expect.objectContaining({
          id: addedLaterId,
          body: 'Leave this for a later review.',
        }),
      ],
    });

    for (const request of [
      {
        method: 'PATCH',
        path: `${root}/${lineId}`,
        body: { text: 'Too late.' },
      },
      { method: 'DELETE', path: `${root}/${fileId}` },
    ] as const) {
      const refused = await session.send(request);
      expect(refused.status, request.method).toBe(409);
      expect(refused.body).toEqual(
        apiError(
          409,
          'Conflict',
          'This comment has already been posted. Refresh to see the published review.',
        ),
      );
    }
    expect(await view('GET', root)).toEqual(commentsView(answer.view));

    const registered = server.routes.filter(
      (route) => route.includes('/worktree') && route.includes('comments'),
    );
    expect(registered.toSorted()).toEqual([
      'DELETE /api/worktrees/:worktreeId/comments/:commentId',
      'GET /api/worktrees/:worktreeId/comments',
      'GET /api/worktrees/:worktreeId/comments/review',
      'PATCH /api/worktrees/:worktreeId/comments/:commentId',
      'POST /api/worktrees/:worktreeId/comments',
      'POST /api/worktrees/:worktreeId/comments/review',
      'owner GET /worktree-comments',
    ]);
    const requested = await server.requestedRoutes();
    expect(() => handlerCoverage([{ registered, requested }])).not.toThrow();
  } finally {
    for (const socket of waiting) socket.destroy();
    if (gate.listening)
      await new Promise<void>((resolve) => gate.close(() => resolve()));
    await rm(ghPath, { force: true });
  }
});
