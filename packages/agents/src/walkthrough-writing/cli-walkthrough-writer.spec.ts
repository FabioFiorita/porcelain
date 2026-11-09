import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it, onTestFinished } from 'vitest';
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
  const invocations = calls
    .trim()
    .split('\n')
    .map((line) =>
      Schema.decodeUnknownSync(
        Schema.fromJsonString(
          Schema.Struct({ args: Schema.Array(Schema.String) }),
        ),
      )(line),
    );
  expect(invocations).toHaveLength(2);
  expect(
    invocations.map(({ args }) => ({
      strictMcp: args.includes('--strict-mcp-config'),
      safeMode: args.includes('--safe-mode'),
      mcp: args[args.indexOf('--mcp-config') + 1],
      settings: args[args.indexOf('--setting-sources') + 1],
      commandsDisabled: args.includes('--disable-slash-commands'),
      tools: args[args.indexOf('--tools') + 1],
    })),
  ).toEqual([
    {
      strictMcp: true,
      safeMode: true,
      mcp: '{"mcpServers":{}}',
      settings: '',
      commandsDisabled: true,
      tools: 'Read,Grep,Glob,Bash',
    },
    {
      strictMcp: true,
      safeMode: true,
      mcp: '{"mcpServers":{}}',
      settings: '',
      commandsDisabled: true,
      tools: 'Read,Grep,Glob,Bash',
    },
  ]);
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
      message: 'Sign in again to the selected agent CLI, then try again.',
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

it('uses only the Codex final answer despite progress messages and resumes its read-only session', async ({
  onTestFinished,
}) => {
  const test = await fixture(
    `const fs = require('fs'); const args = process.argv.slice(2); if(args[0]==='mcp'){console.log('[]');process.exit(0)} fs.readFileSync(0, 'utf8'); const pass = args.includes('resume'); fs.appendFileSync('calls', JSON.stringify(args)); console.log(JSON.stringify({type:'thread.started', thread_id:'codex-session'})); console.log(JSON.stringify({type:'item.completed', item:{type:'agent_message',text:'I will inspect the pinned diff.'}})); const answer = JSON.stringify(pass ? {outcome:'nothing',title:'A small change',summary:'Done',growth:[],stops:[],onlyInTranscript:[],stillUnclear:[],checks:null} : {understood:'First',could_not_tell:[]}); if(args.includes('--output-last-message')) fs.writeFileSync(args[args.indexOf('--output-last-message')+1],answer); console.log(JSON.stringify({type:'item.completed', item:{type:'agent_message',text:'The walkthrough is complete.'}}));`,
    onTestFinished,
  );
  const result = await test.result({ provider: 'codex', model: 'gpt-5.5' });
  expect(result).toMatchObject({
    _tag: 'Success',
    success: { content: { outcome: 'nothing', title: 'A small change' } },
  });
  expect(test.sessions).toEqual(['codex-session', 'codex-session']);
  const calls = await readFile(join(test.folder, 'calls'), 'utf8');
  expect(calls).toContain('read-only');
  expect(calls).toContain('sandbox_mode=');
  expect(calls).toContain('features.hooks=false');
  expect(calls).toContain('codex-session');
});
it.each([
  { configured: 'keyring', expected: ['cli_auth_credentials_store="keyring"'] },
  { configured: 'file', expected: ['cli_auth_credentials_store="file"'] },
  { configured: 'auto', expected: ['cli_auth_credentials_store="auto"'] },
  { configured: 'invalid', expected: [] },
])(
  'carries only a valid Codex credential store into both isolated passes: $configured',
  async ({ configured, expected }) => {
    const test = await fixture(
      `const fs=require('fs');const args=process.argv.slice(2);fs.readFileSync(0,'utf8');if(args[0]==='mcp'){console.log('[]');process.exit(0)}fs.appendFileSync('calls',JSON.stringify({args})+'\\n');const answer=args.includes('resume')?{outcome:'nothing',title:'A small change',summary:'Done',growth:[],stops:[],onlyInTranscript:[],stillUnclear:[],checks:null}:{understood:'First',could_not_tell:[]};fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify(answer));console.log(JSON.stringify({type:'thread.started',thread_id:'codex-session'}));`,
      onTestFinished,
    );
    const previous = process.env.CODEX_HOME;
    process.env.CODEX_HOME = test.folder;
    onTestFinished(() => {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
    });
    await writeFile(
      join(test.folder, 'config.toml'),
      `cli_auth_credentials_store = '${configured}'\nnotify = ["inherited-notifier"]\n[profiles.unused]\ncli_auth_credentials_store = "file"\n`,
    );
    expect(
      await test.result({ provider: 'codex', model: 'gpt-5.5' }),
    ).toMatchObject({ _tag: 'Success' });
    const calls = (await readFile(join(test.folder, 'calls'), 'utf8'))
      .trim()
      .split('\n')
      .map(
        (line) =>
          Schema.decodeUnknownSync(
            Schema.fromJsonString(
              Schema.Struct({ args: Schema.Array(Schema.String) }),
            ),
          )(line).args,
      );
    expect(
      calls.map((args) => ({
        store: args.filter((arg) =>
          arg.startsWith('cli_auth_credentials_store='),
        ),
        isolated: args.includes('--ignore-user-config'),
        notifierDisabled: args.includes('notify=[]'),
        inheritedNotifier: args.includes('inherited-notifier'),
      })),
    ).toEqual([
      {
        store: expected,
        isolated: true,
        notifierDisabled: true,
        inheritedNotifier: false,
      },
      {
        store: expected,
        isolated: true,
        notifierDisabled: true,
        inheritedNotifier: false,
      },
    ]);
    expect(test.sessions).toEqual(['codex-session', 'codex-session']);
  },
);
it('disables every effective Codex MCP server on each pass, including system and managed configuration', async ({
  onTestFinished,
}) => {
  const test = await fixture(
    `const fs=require('fs'); const args=process.argv.slice(2); const prompt=fs.readFileSync(0,'utf8'); fs.appendFileSync('calls',JSON.stringify({args,prompt})+'\\n'); if(args[0]==='mcp'){const override=args.find(arg=>arg.startsWith('mcp_servers='));let names;if(override){names=JSON.parse(fs.readFileSync('names','utf8'))}else{const second=fs.existsSync('listed');fs.writeFileSync('listed','yes');names=['user-inherited',second?'managed.layer':'system-inherited'];fs.writeFileSync('names',JSON.stringify(names))}const expected='mcp_servers={'+names.map(name=>JSON.stringify(name)+'={enabled=false,'+(names.indexOf(name)===0?'command="fixture-mcp"':'url="https://fixture.invalid/mcp"')+'}').join(',')+'}';console.log(JSON.stringify(names.map((name,index)=>({name,enabled:override!==expected,transport:index===0?{type:'stdio',command:'fixture-mcp'}:{type:'streamable_http',url:'https://fixture.invalid/mcp'}}))));process.exit(0)} const pass=args.includes('resume');const expected='mcp_servers={"user-inherited"={enabled=false,command="fixture-mcp"},'+JSON.stringify(pass?'managed.layer':'system-inherited')+'={enabled=false,url="https://fixture.invalid/mcp"}}';if(!args.includes(expected)){process.stderr.write('Inherited MCP servers remain enabled');process.exit(1)} const answer=JSON.stringify(pass ? {outcome:'nothing',title:'A small change',summary:'Done',growth:[],stops:[],onlyInTranscript:[],stillUnclear:[],checks:null} : {understood:'First',could_not_tell:[]});fs.writeFileSync(args[args.indexOf('--output-last-message')+1],answer);console.log(JSON.stringify({type:'thread.started',thread_id:'codex-session'}));`,
    onTestFinished,
  );
  expect(
    await test.result({ provider: 'codex', model: 'gpt-5.5' }),
  ).toMatchObject({ _tag: 'Success' });
  const calls = (await readFile(join(test.folder, 'calls'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) =>
      Schema.decodeUnknownSync(
        Schema.fromJsonString(
          Schema.Struct({
            args: Schema.Array(Schema.String),
            prompt: Schema.String,
          }),
        ),
      )(line),
    );
  expect(calls.map(({ args }) => args.slice(0, 2))).toEqual([
    ['mcp', 'list'],
    ['mcp', 'list'],
    ['exec', '--sandbox'],
    ['mcp', 'list'],
    ['mcp', 'list'],
    ['exec', 'resume'],
  ]);
  expect(
    calls.filter(({ args }) => args[0] === 'mcp').map(({ prompt }) => prompt),
  ).toEqual(['', '', '', '']);
  expect(
    calls
      .filter(({ args }) => args[0] === 'exec')
      .map(({ args }) => ({
        ignoreUser: args.includes('--ignore-user-config'),
        ignoreRules: args.includes('--ignore-rules'),
        hooksDisabled: args.includes('features.hooks=false'),
        disabled: args.filter((_, index) => args[index - 1] === '--disable'),
        servers: args
          .filter((_, index) => args[index - 1] === '-c')
          .filter((value) => value.startsWith('mcp_servers=')),
      })),
  ).toEqual([
    {
      ignoreUser: true,
      ignoreRules: true,
      hooksDisabled: true,
      disabled: [
        'shell_snapshot',
        'shell_snapshot_v2',
        'browser_use',
        'computer_use',
        'image_generation',
        'plugins',
        'apps',
        'multi_agent',
        'multi_agent_v2',
        'skill_mcp_dependency_install',
      ],
      servers: [
        'mcp_servers={"user-inherited"={enabled=false,command="fixture-mcp"},"system-inherited"={enabled=false,url="https://fixture.invalid/mcp"}}',
      ],
    },
    {
      ignoreUser: true,
      ignoreRules: true,
      hooksDisabled: true,
      disabled: [
        'shell_snapshot',
        'shell_snapshot_v2',
        'browser_use',
        'computer_use',
        'image_generation',
        'plugins',
        'apps',
        'multi_agent',
        'multi_agent_v2',
        'skill_mcp_dependency_install',
      ],
      servers: [
        'mcp_servers={"user-inherited"={enabled=false,command="fixture-mcp"},"managed.layer"={enabled=false,url="https://fixture.invalid/mcp"}}',
      ],
    },
  ]);
});
it.each([
  {
    name: 'failed command',
    script:
      "process.stderr.write('Configuration could not be read');process.exit(1)",
  },
  { name: 'invalid JSON', script: "console.log('not JSON')" },
  { name: 'invalid server list', script: "console.log('[{}]')" },
  {
    name: 'managed server that remains enabled',
    script:
      'console.log(\'[{"name":"required","enabled":true,"transport":{"type":"stdio","command":"required"}}]\')',
  },
])(
  'starts no writer when Codex MCP discovery returns $name',
  async ({ script }) => {
    const test = await fixture(
      `const fs=require('fs');if(process.argv[2]==='mcp'){${script}}else{fs.writeFileSync('agent-started','yes')}`,
      onTestFinished,
    );
    expect(
      await test.result({ provider: 'codex', model: 'gpt-5.5' }),
    ).toMatchObject({
      _tag: 'Failure',
      failure: {
        kind: 'other',
        message:
          'The Codex MCP servers could not be disabled. Check its configuration, then try again.',
      },
    });
    expect(await readdir(test.folder)).not.toContain('agent-started');
  },
);
it('does not run a configured Codex notify command outside the worktree on either pass', async ({
  onTestFinished,
}) => {
  const notifications = await mkdtemp(join(tmpdir(), 'walkthrough-notify-'));
  onTestFinished(() => rm(notifications, { recursive: true, force: true }));
  const test = await fixture(
    `const fs=require('fs');const args=process.argv.slice(2);fs.readFileSync(0,'utf8');if(args[0]==='mcp'){console.log('[]');process.exit(0)}const notify=JSON.parse(fs.readFileSync('config.toml','utf8').slice('notify = '.length));if(!args.includes('notify=[]')&&!args.includes('--ignore-user-config'))require('child_process').execFileSync(notify[0],notify.slice(1));const answer=args.includes('resume')?{outcome:'nothing',title:'A small change',summary:'Done',growth:[],stops:[],onlyInTranscript:[],stillUnclear:[],checks:null}:{understood:'First',could_not_tell:[]};fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify(answer));console.log(JSON.stringify({type:'thread.started',thread_id:'codex-session'}));`,
    onTestFinished,
  );
  await writeFile(
    join(test.folder, 'config.toml'),
    'notify = ' +
      JSON.stringify([
        process.execPath,
        '-e',
        `require('fs').writeFileSync(${JSON.stringify(join(notifications, 'executed'))},'outside sandbox')`,
      ]),
  );
  expect(
    await test.result({ provider: 'codex', model: 'gpt-5.5' }),
  ).toMatchObject({
    _tag: 'Success',
    success: { content: { outcome: 'nothing' } },
  });
  expect(test.sessions).toEqual(['codex-session', 'codex-session']);
  expect(await readdir(notifications)).toEqual([]);
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
