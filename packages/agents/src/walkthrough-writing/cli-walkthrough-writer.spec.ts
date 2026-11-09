import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it } from 'vitest';
import { WalkthroughWriter } from '@porcelain/walkthroughs/ports';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import { cliWalkthroughWriterLayer } from './cli-walkthrough-writer.ts';
const processGroup = { lingerMs: 20, cleanupMs: 1000, pollMs: 5 };
const run: WalkthroughJob['run'] = {
  id: 'run',
  projectId: 'project',
  worktreeId: 'worktree',
  pullRequestNumber: undefined,
  baseOid: 'a'.repeat(40),
  headOid: 'b'.repeat(40),
  writer: { provider: 'claude', model: 'claude-opus-5-5' },
  sessionId: undefined,
  createdAt: '2026-11-09T00:00:00Z',
  state: { status: 'queued' },
};
async function fixture(
  script: string,
  onTestFinished: (callback: () => Promise<void>) => void,
  deadlineMs = 5000,
) {
  const folder = await mkdtemp(join(tmpdir(), 'walkthrough-cli-'));
  const command = join(folder, 'writer');
  await writeFile(command, '#!/usr/bin/env node\n' + script, { mode: 0o700 });
  const runtime = ManagedRuntime.make(
    cliWalkthroughWriterLayer({ processGroup, command, deadlineMs }).pipe(
      Layer.provide(NodeServices.layer),
    ),
  );
  onTestFinished(async () => {
    await runtime.dispose();
    await rm(folder, { recursive: true, force: true });
  });
  const sessions: string[] = [];
  const result = (selectedWriter = run.writer) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const writer = yield* WalkthroughWriter;
        return yield* writer
          .write({
            run: { ...run, writer: selectedWriter },
            worktreePath: folder,
            files: [],
            transcript: 'The human intent',
            evidence: {
              title: 'Public change',
              body: '',
              checks: undefined,
              assets: [
                {
                  id: 'fixture-image',
                  mediaType: 'image/png',
                  bytes: new Uint8Array([137, 80, 78, 71]),
                  caption: 'Existing proof',
                },
              ],
            },
            recordSession: (id) =>
              Effect.sync(() => {
                sessions.push(id);
              }),
          })
          .pipe(Effect.result);
      }),
    );
  return { folder, result, sessions };
}
it('uses two passes in the same read-only session, disables hooks and pins both commits', async ({
  onTestFinished,
}) => {
  const test = await fixture(
    `const fs = require('fs'); const args = process.argv.slice(2); const prompt = fs.readFileSync(0, 'utf8'); const pass = args.includes('--resume'); fs.appendFileSync('calls', JSON.stringify({args, prompt, cwd: process.cwd()})+'\\n'); console.log(JSON.stringify({session_id: args[args.indexOf(pass ? '--resume' : '--session-id') + 1], total_cost_usd: 0.25, structured_output: pass ? {outcome:'nothing',title:'A small change',summary:'Done',growth:[],stops:[],onlyInTranscript:[],stillUnclear:[],checks:null} : {understood:'First',could_not_tell:[]}}));`,
    onTestFinished,
  );
  const result = await test.result();
  expect(result._tag).toBe('Success');
  if (result._tag === 'Success')
    expect(result.success).toMatchObject({
      content: { outcome: 'nothing' },
      costUsd: 0.5,
    });
  const calls = await readFile(join(test.folder, 'calls'), 'utf8');
  expect(calls).toContain('disableAllHooks');
  expect(calls).toContain('dontAsk');
  expect(calls).toContain('--strict-mcp-config');
  expect(calls).toContain('--session-id');
  expect(calls).toContain('--resume');
  expect(calls).toContain('fixture-image.png');
  expect(calls).toContain('--add-dir');
  expect(calls).toContain(run.baseOid + '..' + run.headOid);
  expect(calls.split('Second and final pass').length).toBe(2);
  expect(test.sessions.length).toBeGreaterThan(1);
  expect(new Set(test.sessions).size).toBe(1);
});
it('surfaces ended sign-in as signed out', async ({ onTestFinished }) => {
  const test = await fixture(
    `process.stderr.write('OAuth token expired. Please sign in again'); process.exit(1);`,
    onTestFinished,
  );
  expect(await test.result()).toMatchObject({
    _tag: 'Failure',
    failure: {
      kind: 'signed_out',
      message:
        'Sign in again to the selected agent CLI, then write a walkthrough for the next head.',
    },
  });
  const envelope = await fixture(
    `console.log(JSON.stringify({is_error:true,result:'OAuth token expired. Please sign in again'}));`,
    onTestFinished,
  );
  expect(await envelope.result()).toMatchObject({
    _tag: 'Failure',
    failure: {
      kind: 'signed_out',
      message: 'Sign in again to the selected agent CLI.',
    },
  });
});
it('returns timed out when a CLI never finishes', async ({
  onTestFinished,
}) => {
  const test = await fixture(
    'setInterval(() => {}, 1000);',
    onTestFinished,
    50,
  );
  expect(await test.result()).toMatchObject({
    _tag: 'Failure',
    failure: { kind: 'timed_out' },
  });
});
it('rejects unusable structured output', async ({ onTestFinished }) => {
  const test = await fixture(
    `console.log('{"session_id":"id","structured_output":{"unexpected":true}}');`,
    onTestFinished,
  );
  expect(await test.result()).toMatchObject({
    _tag: 'Failure',
    failure: { kind: 'unusable_output' },
  });
});

it('keeps Codex read-only on both passes and resumes its recorded session', async ({
  onTestFinished,
}) => {
  const test = await fixture(
    `const fs = require('fs'); const args = process.argv.slice(2); fs.readFileSync(0, 'utf8'); const pass = args.includes('resume'); fs.appendFileSync('calls', JSON.stringify(args)); console.log(JSON.stringify({type:'thread.started', thread_id:'codex-session'})); console.log(JSON.stringify({type:'item.completed', item:{type:'agent_message',text:JSON.stringify(pass ? {outcome:'nothing',title:'A small change',summary:'Done',growth:[],stops:[],onlyInTranscript:[],stillUnclear:[],checks:null} : {understood:'First',could_not_tell:[]})}}));`,
    onTestFinished,
  );
  const result = await test.result({ provider: 'codex', model: 'gpt-5.5' });
  expect(result._tag).toBe('Success');
  expect(test.sessions).toEqual(['codex-session', 'codex-session']);
  const calls = await readFile(join(test.folder, 'calls'), 'utf8');
  expect(calls).toContain('read-only');
  expect(calls).toContain('sandbox_mode=');
  expect(calls).toContain('features.hooks=false');
  expect(calls).toContain('codex-session');
});
it('surfaces a missing executable as agent not installed', async ({
  onTestFinished,
}) => {
  const test = await fixture('', onTestFinished);
  await rm(join(test.folder, 'writer'));
  expect(await test.result()).toMatchObject({
    _tag: 'Failure',
    failure: { kind: 'agent_not_installed' },
  });
});
