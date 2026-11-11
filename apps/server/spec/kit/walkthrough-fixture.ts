import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Effect, Schema } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { readWorkingTree } from '@porcelain/git/inspection';
import { LIMITS } from '../../src/config/limits.ts';
import {
  walkthroughJobSchema,
  type EvidenceAsset,
  type StoredWalkthroughMessage,
  type WalkthroughContent,
  type WalkthroughJob,
} from '@porcelain/walkthroughs/models';
import {
  walkthroughConversationsResponseSchema,
  readWalkthroughResponseSchema,
} from '@porcelain/contracts/walkthroughs';
import { read } from './requests.ts';
import { record, text, type Session } from './session.ts';

function transaction(
  directory: string,
  write: (database: DatabaseSync) => void,
): void {
  const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
  try {
    database.exec('PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
    write(database);
    database.exec('COMMIT');
  } finally {
    database.close();
  }
}

export function seedStoredWalkthroughs(
  directory: string,
  input: {
    jobs?: readonly WalkthroughJob[];
    messages?: readonly StoredWalkthroughMessage[];
    assets?: readonly (EvidenceAsset & { runId: string })[];
    removeRuns?: readonly string[];
  },
): void {
  transaction(directory, (database) => {
    for (const id of input.removeRuns ?? [])
      database.prepare('DELETE FROM walkthrough_runs WHERE id = ?').run(id);
    for (const job of input.jobs ?? [])
      database
        .prepare(
          'INSERT INTO walkthrough_runs (id,worktree_id,head_oid,status,payload) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET head_oid=excluded.head_oid,status=excluded.status,payload=excluded.payload',
        )
        .run(
          job.run.id,
          job.run.worktreeId,
          job.run.headOid,
          job.run.state.status,
          JSON.stringify(job),
        );
    for (const message of input.messages ?? [])
      database
        .prepare(
          'INSERT INTO walkthrough_messages (id,run_id,worktree_id,stop_title,text,created_at,post_status,post_url,posted_at,answer_status,answer,writer) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          message.id,
          message.runId,
          message.worktreeId,
          message.stopTitle ?? null,
          message.text,
          message.createdAt,
          message.post.status,
          message.post.status === 'posted' ? message.post.url : null,
          message.post.status === 'posted' ? message.post.postedAt : null,
          message.answer.status,
          JSON.stringify(message.answer),
          message.writer === undefined ? null : JSON.stringify(message.writer),
        );
    for (const asset of input.assets ?? [])
      database
        .prepare(
          'INSERT INTO walkthrough_evidence (run_id,asset_id,media_type,caption,bytes) VALUES (?,?,?,?,?)',
        )
        .run(
          asset.runId,
          asset.id,
          asset.mediaType,
          asset.caption,
          asset.bytes,
        );
  });
}

async function followWorktree(session: Session) {
  const live = await session.live();
  await live.follow({
    projects: [session.projectId],
    worktrees: [
      {
        projectId: session.projectId,
        worktreeId: session.worktreeId,
        paths: [],
      },
    ],
  });
  await live.next((notice) => notice.type === 'subscribed');
  return live;
}

function storedJob(directory: string, runId: string): WalkthroughJob {
  const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
  try {
    const row = record(
      database
        .prepare('SELECT payload FROM walkthrough_runs WHERE id = ?')
        .get(runId),
    );
    return Schema.decodeUnknownSync(
      Schema.fromJsonString(walkthroughJobSchema),
    )(text(row.payload));
  } finally {
    database.close();
  }
}

export async function scriptedWalkthroughs(
  session: Session,
  manifestPath: string,
  options: {
    answer: string;
    costUsd: number;
    failurePath: string;
    postsPath: string;
    argumentsPath?: string;
  },
) {
  const manifest = record(JSON.parse(await readFile(manifestPath, 'utf8')));
  const bin = text(manifest.bin);
  const answerPath = join(session.projectHome, 'walkthrough-answer.json');
  await writeFile(answerPath, JSON.stringify(options.answer));
  const contentPath = join(session.projectHome, 'walkthrough-content.json');
  await writeFile(options.postsPath, '');
  await writeFile(
    join(bin, 'claude'),
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'auth') { console.log(JSON.stringify({loggedIn:true})); process.exit(0); }
${options.argumentsPath === undefined ? '' : `fs.appendFileSync(${JSON.stringify(options.argumentsPath)}, JSON.stringify(args)+'\\n');`}
const prompt = fs.readFileSync(0,'utf8');
if (fs.existsSync(${JSON.stringify(options.failurePath)})) { console.error('The tool crashed.'); process.exit(1); }
const first = prompt.startsWith('You did not build');
const second = prompt.startsWith('Second and final');
const output = first ? {understood:'A fixture change.',could_not_tell:[]} : second ? JSON.parse(fs.readFileSync(${JSON.stringify(contentPath)},'utf8')) : undefined;
console.log(JSON.stringify({ session_id: first ? args[args.indexOf('--session-id')+1] : args[args.indexOf('--resume')+1] ?? 'fresh', total_cost_usd:${options.costUsd}, ...(output === undefined ? {result:JSON.parse(fs.readFileSync(${JSON.stringify(answerPath)},'utf8'))} : {structured_output:output}) }));
`,
    { mode: 0o755 },
  );
  await writeFile(
    join(bin, 'gh'),
    `#!${process.execPath}
const fs = require('node:fs');
const cp = require('node:child_process');
const args = process.argv.slice(2);
const endpoint = args.find(arg => arg.includes('/issues/') && arg.endsWith('/comments'));
if (args[0] === 'auth' && args[1] === 'status') console.log(JSON.stringify(['fixture']));
else if (args[0] === 'auth' && args[1] === 'token') console.log('fixture-token');
else if (endpoint) {
 fs.appendFileSync(${JSON.stringify(options.postsPath)},fs.readFileSync(0,'utf8')+'\\n');
 const parts = endpoint.split('/');
 console.log(JSON.stringify({html_url:'https://github.com/'+parts[1]+'/'+parts[2]+'/pull/'+parts[4]+'#issuecomment-1'}));
} else if (args.includes('graphql')) {
 const number = Number(args.find(arg => arg.startsWith('number='))?.split('=')[1] ?? 423);
 const head = cp.execFileSync('git',['-C',${JSON.stringify(session.repository)},'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const repository = cp.execFileSync('git',['-C',${JSON.stringify(session.repository)},'config','--get','remote.origin.url'],{encoding:'utf8'}).trim().replace(/^.*github.com[:/]/,'').replace(/[.]git$/,'');
 const empty = {nodes:[],pageInfo:{hasNextPage:false}};
 console.log(JSON.stringify({data:{repository:{pullRequest:{number,title:'Fixture pull request',url:'https://github.com/'+repository+'/pull/'+number,state:'OPEN',isDraft:false,author:{login:'fixture'},headRefName:'fixture',baseRefName:'main',updatedAt:'2026-11-10T00:00:00Z',headRefOid:head,body:'Fixture',bodyHTML:'',mergeable:'MERGEABLE',commits:{nodes:[]},labels:empty,comments:empty,reviews:empty},open:{...empty,pageInfo:{hasNextPage:false,endCursor:null}},recent:empty}}}));
} else console.log('{}');
`,
    { mode: 0o755 },
  );
  return {
    reply: (answer: string) => writeFile(answerPath, JSON.stringify(answer)),
    comment: async (
      runId: string,
      title: string,
      message: string,
      post: 'saved' | 'posted',
    ) => {
      const root = `/api/worktrees/${session.worktreeId}/walkthrough/${runId}/conversations`;
      const live = await followWorktree(session);
      try {
        const added = Schema.decodeUnknownSync(
          walkthroughConversationsResponseSchema,
        )(
          await read(session, {
            method: 'POST',
            path: `${root}/messages`,
            body: { anchor: { kind: 'stop', title }, text: message },
          }),
        );
        const developer = added.conversations
          .flatMap((conversation) => conversation.messages)
          .findLast(
            (item) => item.author === 'developer' && item.text === message,
          );
        if (!developer) throw new Error('The fixture comment was not created');
        while (true) {
          const view = Schema.decodeUnknownSync(
            walkthroughConversationsResponseSchema,
          )(await read(session, { method: 'GET', path: root }));
          const answer = view.conversations
            .flatMap((conversation) => conversation.messages)
            .find(
              (item) =>
                item.author === 'agent' && item.replyTo === developer.id,
            );
          if (answer?.author === 'agent' && answer.state.status === 'answered')
            break;
          if (answer?.author === 'agent' && answer.state.status === 'failed')
            throw new Error(answer.state.failure.message);
          await live.next(
            (notice) =>
              notice.type === 'walkthrough' &&
              notice.change === 'conversations' &&
              notice.worktreeId === session.worktreeId,
          );
        }
        await read(
          session,
          post === 'saved'
            ? {
                method: 'PUT',
                path: `${root}/messages/${developer.id}/saved`,
                body: { saved: true },
              }
            : { method: 'POST', path: `${root}/messages/${developer.id}/post` },
        );
      } finally {
        await live.close();
      }
    },
    attachEvidence: async (
      runId: string,
      step: number,
      assets: readonly EvidenceAsset[],
    ) => {
      const directory = join(
        session.projectHome,
        session.fixture.folders.state,
      );
      const job = storedJob(directory, runId);
      const state = job.run.state;
      if (state.status !== 'ready')
        throw new Error('Evidence attaches only to a ready walkthrough.');
      const live = await followWorktree(session);
      try {
        seedStoredWalkthroughs(directory, {
          jobs: [
            {
              ...job,
              run: {
                ...job.run,
                state: {
                  ...state,
                  content: {
                    ...state.content,
                    stops: state.content.stops.map((stop, index) =>
                      index === step - 1
                        ? {
                            ...stop,
                            evidence: assets.map((asset) => ({
                              assetId: asset.id,
                              shows: asset.caption,
                            })),
                          }
                        : stop,
                    ),
                  },
                },
              },
            },
          ],
          assets: assets.map((asset) => ({ ...asset, runId })),
        });
        await session.git(
          'update-ref',
          'refs/porcelain-fixture/evidence',
          'HEAD',
        );
        await live.next(
          (notice) =>
            notice.type === 'worktree' &&
            notice.change === 'git' &&
            notice.worktreeId === session.worktreeId,
        );
      } finally {
        await live.close();
      }
    },
    write: async (
      content: WalkthroughContent,
      input: { base: string; pullRequestNumber?: number },
    ) => {
      await writeFile(
        contentPath,
        JSON.stringify({
          ...content,
          checks: content.checks ?? null,
          stops: content.stops.map((stop) => ({
            ...stop,
            attention: stop.attention ?? null,
          })),
        }),
      );
      const live = await followWorktree(session);
      try {
        const accepted = await read(session, {
          method: 'POST',
          path: `/api/worktrees/${session.worktreeId}/walkthrough`,
          body: input,
        });
        while (true) {
          const result = Schema.decodeUnknownSync(
            readWalkthroughResponseSchema,
          )(
            await read(session, {
              method: 'GET',
              path: `/api/worktrees/${session.worktreeId}/walkthrough`,
            }),
          );
          const run =
            result.attempt?.id === text(accepted.id)
              ? result.attempt
              : result.walkthrough;
          if (run?.id === text(accepted.id) && run.state.status === 'ready')
            return run;
          if (run?.id === text(accepted.id) && run.state.status === 'failed')
            throw new Error(run.state.failure.message);
          await live.next(
            (notice) =>
              notice.type === 'walkthrough' &&
              notice.worktreeId === session.worktreeId,
          );
        }
      } finally {
        await live.close();
      }
    },
  };
}

export function captureWalkthroughFixture(repository: string, baseOid: string) {
  return Effect.runPromise(
    readWorkingTree(repository, baseOid, LIMITS.git).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );
}
