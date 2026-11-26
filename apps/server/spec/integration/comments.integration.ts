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

test('keeps draft comments across refreshes, edits and deletes them, and publishes them once as one review on the branch pull request', async ({
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

    const planned = await preview();
    expect(planned).toEqual({
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
      general: [
        expect.objectContaining({
          id: fileId,
          reason: 'file',
          body: 'Is this still true?',
        }),
      ],
    });
    const bodies = {
      [lineId]: 'Name these constants',
      [fileId]: 'Is this still true?',
    };
    const publish = (body: object) =>
      session.send({ method: 'POST', path: `${root}/review`, body });

    const confirmation = {
      pullRequest: { owner: 'fixture', repo: 'project', number: 7 },
      headOid,
      inlineIds: [lineId],
      summary: 'Two notes.',
      bodies,
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
    const changed = await publish({
      ...confirmation,
      bodies: { [lineId]: 'Name these constants' },
    });
    expect(changed.status).toBe(409);
    expect(changed.body).toEqual(
      apiError(
        409,
        'Conflict',
        'The comments changed since this preview. Review them again before posting.',
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
    const misplaced = await publish(confirmation);
    expect(misplaced.status).toBe(409);
    expect(misplaced.body).toEqual(
      apiError(
        409,
        'Conflict',
        'Where a comment will appear changed. Go back and preview the review again.',
      ),
    );
    await session.writeFile(
      'src/app.ts',
      'const a = 1;\nconst b = 2;\nconst c = 3;\n',
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
      commentsView(answer.view).comments.map((comment) => {
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
    const review = record(posted[0]);
    expect(text(review.body)).toContain('Is this still true?');
    expect(text(review.body)).toContain('Two notes.');
    expect([{ ...review, body: '' }]).toEqual([
      {
        commit_id: headOid,
        event: 'COMMENT',
        body: '',
        comments: [
          {
            path: 'src/app.ts',
            side: 'RIGHT',
            start_line: 1,
            start_side: 'RIGHT',
            line: 2,
            body: 'Name these constants',
          },
        ],
      },
    ]);
    expect(await preview()).toEqual({
      kind: 'unavailable',
      reason: 'no-comments',
    });

    const remaining = await view('DELETE', `${root}/${fileId}`);
    expect(remaining.comments.map((comment) => comment.id)).toEqual([lineId]);
    expect(await view('GET', root)).toEqual(remaining);

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
