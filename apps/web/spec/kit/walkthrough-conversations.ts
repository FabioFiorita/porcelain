import { serverReaders } from './readers.ts';
import { Schema } from 'effect';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { World } from './world.ts';

export async function walkthroughConversationsFixture(
  world: World,
  action:
    | 'pr'
    | 'no-pr'
    | 'fail'
    | 'recover'
    | 'moved'
    | 'posts'
    | 'short-pr'
    | 'short-copy'
    | 'changed-pr',
): Promise<string> {
  const server = world.server;
  const project = await serverReaders({
    read: (request) => world.read({ ...request, server: 'this' }),
    hits: () => world.hits('this'),
  }).project();
  const worktree = project.worktrees[0];
  if (!worktree) throw new Error('The conversation fixture needs a worktree.');
  const session = server.session(world.recorder, {
    projectId: project.id,
    worktreeId: worktree.id,
  });
  const failure = join(session.projectHome, 'conversation-failure');
  const calls = join(session.projectHome, 'conversation-posts');
  if (action === 'fail') {
    await writeFile(failure, 'fail');
    return '';
  }
  if (action === 'recover') {
    await rm(failure);
    return '';
  }
  if (action === 'moved') {
    await session.git(
      'remote',
      'set-url',
      'origin',
      'https://github.com/example/elsewhere.git',
    );
    return '';
  }
  if (action === 'posts') return readFile(calls, 'utf8');
  const manifest = Schema.decodeUnknownSync(
    Schema.Struct({ bin: Schema.String }),
  )(JSON.parse(await readFile(server.manifestPath, 'utf8')));
  await writeFile(calls, '');
  await writeFile(
    join(manifest.bin, 'claude'),
    `#!${process.execPath}
const fs = require('node:fs');
fs.readFileSync(0, 'utf8');
if (fs.existsSync(${JSON.stringify(failure)})) { console.error('The tool crashed.'); process.exit(1); }
console.log(JSON.stringify({session_id:'fixture',result:'Keep the retry beside its owner. The \`local\` boundary is deliberate.',total_cost_usd:0.01}));
`,
    { mode: 0o755 },
  );
  await writeFile(
    join(manifest.bin, 'gh'),
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') console.log(JSON.stringify(['fixture']));
else if (args[0] === 'auth' && args[1] === 'token') console.log('fixture-token');
else if (args.some(arg => arg.endsWith('/issues/423/comments') || arg.endsWith('/issues/424/comments'))) { fs.appendFileSync(${JSON.stringify(calls)}, fs.readFileSync(0, 'utf8')+'\\n'); console.log(JSON.stringify({html_url:'https://github.com/example/sample/pull/' + (args.some(arg => arg.endsWith('/issues/424/comments')) ? '424' : '423') + '#issuecomment-1'})); }
else console.log('{}');
`,
    { mode: 0o755 },
  );
  await session.git(
    'remote',
    'add',
    'origin',
    'https://github.com/example/sample.git',
  );
  const head = (await session.git('rev-parse', 'HEAD')).trim();
  const stop = (title: string, call: boolean) => ({
    title,
    explanation: 'Keep the behavior close to its owner.',
    excerpts: [],
    evidence: [],
    files: [],
    ...(call
      ? {
          attention: {
            kind: 'product',
            question: 'Keep retries local?',
            note: 'The owner chooses the boundary.',
          },
        }
      : {}),
  });
  const job = {
    run: {
      id: 'conversation-run',
      projectId: session.projectId,
      worktreeId: session.worktreeId,
      ...(action === 'pr' || action === 'short-pr' || action === 'changed-pr'
        ? {
            pullRequestNumber: 423,
            pullRequestRepository: { owner: 'example', repo: 'sample' },
          }
        : {}),
      baseOid: head,
      headOid: head,
      writer: { provider: 'claude', model: 'fixture' },
      sessionId: 'fixture',
      createdAt: '2026-11-10T00:00:00.000Z',
      state: {
        status: 'ready',
        writtenAt: '2026-11-10T00:00:00.000Z',
        durationMs: 1,
        content: {
          outcome: 'needs_you',
          title: 'Keep retries beside their owner',
          summary: 'Two decisions to discuss.',
          growth: [],
          stops: [
            stop('Retry boundary', true),
            stop('Failure handling', false),
          ],
          onlyInTranscript: [],
          stillUnclear: [],
        },
      },
    },
    worktreePath: session.repository,
    files: [],
  };
  const db = new DatabaseSync(
    join(
      session.projectHome,
      session.fixture.folders.state,
      'inventory.sqlite',
    ),
  );
  try {
    db.prepare(
      'INSERT INTO walkthrough_runs (id, worktree_id, head_oid, status, payload) VALUES (?, ?, ?, ?, ?)',
    ).run(job.run.id, session.worktreeId, head, 'ready', JSON.stringify(job));

    if (
      action === 'short-pr' ||
      action === 'short-copy' ||
      action === 'changed-pr'
    ) {
      const answer = JSON.stringify({
        status: 'answered',
        text: 'The original boundary still matters.',
        answeredAt: '2026-11-10T00:01:00.000Z',
        durationMs: 1,
      });
      for (const { id, text, status } of [
        { id: 'saved', text: 'Keep the original boundary.', status: 'saved' },
        { id: 'posted', text: 'This was already discussed.', status: 'posted' },
      ]) {
        db.prepare(
          'INSERT INTO walkthrough_messages (id, run_id, worktree_id, stop_title, text, created_at, post_status, post_url, posted_at, answer_status, answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          id,
          job.run.id,
          session.worktreeId,
          'Retry boundary',
          text,
          '2026-11-10T00:00:00.000Z',
          status,
          status === 'posted'
            ? 'https://github.com/example/sample/pull/423#issuecomment-1'
            : null,
          status === 'posted' ? '2026-11-10T00:02:00.000Z' : null,
          'answered',
          answer,
        );
      }
      const content =
        action === 'changed-pr'
          ? job.run.state.content
          : {
              ...job.run.state.content,
              outcome: 'nothing',
              title: 'A small routine change',
              summary: 'Nothing new needs a decision.',
              stops: [],
            };
      await session.git(
        'commit',
        '--allow-empty',
        '-m',
        'Advance the conversation fixture',
      );
      const latestHead = (await session.git('rev-parse', 'HEAD')).trim();
      const latest = {
        ...job,
        run: {
          ...job.run,
          id: 'latest-run',
          headOid: latestHead,
          createdAt: '2026-11-11T00:00:00.000Z',
          ...(action === 'short-copy' ? {} : { pullRequestNumber: 424 }),
          state: { ...job.run.state, content },
        },
      };
      db.prepare(
        'INSERT INTO walkthrough_runs (id, worktree_id, head_oid, status, payload) VALUES (?, ?, ?, ?, ?)',
      ).run(
        latest.run.id,
        session.worktreeId,
        latestHead,
        'ready',
        JSON.stringify(latest),
      );
    }
  } finally {
    db.close();
  }
  return '';
}
