import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { NodeServices } from '@effect/platform-node';
import {
  ClaudeProvider,
  CodexProvider,
} from '@porcelain/agents/commit-planning';
import {
  ConfigProvider,
  type Context,
  Effect,
  FileSystem,
  Layer,
  Path,
  Schema,
  Stream,
} from 'effect';
import { LanguageModel, Model } from 'effect/ai';
import { describe, expect, it } from 'vite-plus/test';
import { codingToolScript } from '../../spec/fixtures/coding-tool.ts';
import { CommitPlanner } from './commit-planner.ts';

function scripted(
  name: string,
  replies: Record<string, unknown>,
): Context.Service.Shape<typeof CodexProvider> {
  return {
    models: () =>
      Effect.succeed([{ id: `${name}:small`, label: `${name} small` }]),
    model: (model) =>
      LanguageModel.make({
        generateText: () =>
          Effect.succeed([
            { type: 'text', text: JSON.stringify(replies[model]) ?? '' },
          ]),
        streamText: () => Stream.empty,
      }).pipe(
        Effect.map((languageModel) =>
          Model.make(
            name,
            model,
            Layer.succeed(LanguageModel.LanguageModel, languageModel),
          ),
        ),
      ),
  };
}

function planner(
  codex: Context.Service.Shape<typeof CodexProvider>,
  claude: Context.Service.Shape<typeof ClaudeProvider>,
) {
  return Effect.runSync(
    CommitPlanner.pipe(
      Effect.provide(CommitPlanner.layer(limits)),
      Effect.provideService(CodexProvider, codex),
      Effect.provideService(ClaudeProvider, claude),
    ),
  );
}

const request = {
  mode: 'message' as const,
  model: 'claude:sonnet',
  paths: ['README.md'],
  evidence: '{"patch":"diff"}',
};
const plan = { groups: [{ message: 'Fix', paths: ['README.md'] }] };
const limits = {
  maxGroups: 20,
  maxMessageLength: 16_384,
  maxPathLength: 4096,
  maxPaths: 2000,
};

const agentLimits = {
  plan: limits,
  processGroup: { lingerMs: 250, cleanupMs: 5000, pollMs: 10 },
  processDeadlineMs: 5000,
  codexOutputBytes: 65536,
  claudeOutputBytes: 65536,
  codexCacheBytes: 65536,
};
const receiptSchema = Schema.fromJsonString(
  Schema.Struct({
    args: Schema.Array(Schema.String),
    prompt: Schema.String,
    cwd: Schema.String,
    files: Schema.Array(
      Schema.Struct({
        argument: Schema.String,
        name: Schema.String,
        parent: Schema.String,
      }),
    ),
    schema: Schema.Struct({
      type: Schema.String,
      additionalProperties: Schema.Boolean,
      properties: Schema.Struct({
        groups: Schema.Struct({
          minItems: Schema.Number,
          maxItems: Schema.Number,
          items: Schema.Struct({ additionalProperties: Schema.Boolean }),
        }),
      }),
    }),
  }),
);

function nativePlanner() {
  return CommitPlanner.pipe(
    Effect.provide(
      CommitPlanner.layer(limits).pipe(
        Layer.provide(
          Layer.mergeAll(
            CodexProvider.layer(agentLimits),
            ClaudeProvider.layer(agentLimits),
          ),
        ),
      ),
    ),
  );
}

describe('CommitPlanner', () => {
  it('asks the named provider for the named model and returns its plan', async () => {
    const codex = scripted('codex', { sonnet: 'not json' });
    const claude = scripted('claude', {
      'claude:sonnet': 'not json',
      sonnet: plan,
    });
    const groups = await Effect.runPromise(
      planner(codex, claude).plan(request),
    );
    expect(groups).toEqual(plan.groups);
  });

  it.each([
    'sonnet',
    'other:model',
    'claude:default',
    'claude:sonnet:extra',
    'claude:',
    'claude:-sonnet',
  ])('refuses the model %j, which it cannot route to', async (model) => {
    const subject = planner(
      scripted('codex', {}),
      scripted('claude', { sonnet: plan }),
    );
    await expect(
      Effect.runPromise(subject.plan({ ...request, model })),
    ).rejects.toMatchObject({
      name: 'UnsupportedCommitModelError',
    });
  });

  it.each([
    { name: 'an unreadable answer', reply: 'not json' },
    { name: 'no answer at all', reply: undefined },
  ])('reports $name as a failed plan', async ({ reply }) => {
    await expect(
      Effect.runPromise(
        planner(
          scripted('codex', {}),
          scripted('claude', { sonnet: reply }),
        ).plan(request),
      ),
    ).rejects.toMatchObject({ name: 'CommitPlanFailedError' });
  });
  it.each(['codex', 'claude'] as const)(
    'runs the restricted %s CLI with native schema validation and removes its temporary directory',
    async (provider) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({
            directory: temporaryRoot,
            prefix: 'porcelain-provider-test-',
          });
          const receipt = path.join(root, 'receipt.json');
          const command = path.join(root, provider);
          yield* fs.writeFileString(
            command,
            codingToolScript({
              provider,
              runner: process.execPath,
              receipt,
              reply: plan,
            }),
          );
          yield* fs.chmod(command, 0o700);
          const result = yield* Effect.gen(function* () {
            const subject = yield* nativePlanner();
            return yield* subject.plan({
              ...request,
              model: `${provider}:small`,
            });
          }).pipe(
            Effect.provide(
              ConfigProvider.layer(
                ConfigProvider.fromUnknown({ PATH: root, CODEX_HOME: root }),
              ),
            ),
          );
          expect(result).toEqual([{ message: 'Fix', paths: ['README.md'] }]);
          const invocation = yield* Schema.decodeUnknownEffect(receiptSchema)(
            yield* fs.readFileString(receipt),
          );
          expect(invocation.prompt).toContain('{"patch":"diff"}');
          expect(invocation.schema).toMatchObject({
            type: 'object',
            additionalProperties: false,
            properties: {
              groups: {
                minItems: 1,
                maxItems: 20,
                items: { additionalProperties: false },
              },
            },
          });
          if (provider === 'claude')
            expect(invocation.args).toEqual([
              '--print',
              '--safe-mode',
              '--restricted',
              '--tools',
              '',
              '--strict-mcp-config',
              '--no-session-persistence',
              '--output-format',
              'json',
              '--json-schema',
              expect.any(String),
              '--model',
              'small',
            ]);
          else {
            expect(
              invocation.files.map(({ name, parent }) => ({ name, parent })),
            ).toEqual([
              {
                name: 'schema.json',
                parent: invocation.cwd,
              },
              {
                name: 'result.json',
                parent: invocation.cwd,
              },
            ]);
            expect(invocation.args).toEqual([
              'exec',
              '--ignore-user-config',
              '--ignore-rules',
              '--ephemeral',
              '--skip-git-repo-check',
              '--sandbox',
              'read-only',
              '--disable',
              'shell_tool',
              '--disable',
              'multi_agent',
              '--disable',
              'apps',
              '--disable',
              'plugins',
              '-c',
              'project_doc_max_bytes=0',
              '-c',
              'web_search="disabled"',
              '--output-schema',
              invocation.files[0]?.argument,
              '--output-last-message',
              invocation.files[1]?.argument,
              '--model',
              'small',
              '-',
            ]);
          }
          expect(yield* fs.exists(invocation.cwd)).toBe(false);
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
      );
    },
  );

  it('records raw Codex file arguments and their live directory identity through a real symlink', async ({
    onTestFinished,
  }) => {
    const root = mkdtempSync(join(temporaryRoot, 'provider-alias-'));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const directory = join(root, 'directory');
    const alias = join(root, 'alias');
    mkdirSync(directory);
    symlinkSync(directory, alias, 'dir');
    const receipt = join(root, 'receipt.json');
    const command = join(root, 'codex');
    const args = [
      '--output-schema',
      join(alias, 'schema.json'),
      '--output-last-message',
      join(alias, 'result.json'),
    ];
    writeFileSync(
      join(directory, 'schema.json'),
      JSON.stringify({ type: 'object' }),
    );
    writeFileSync(
      command,
      codingToolScript({
        provider: 'codex',
        runner: process.execPath,
        receipt,
        reply: plan,
      }),
    );
    const child = spawnSync(process.execPath, [command, ...args], {
      cwd: alias,
      input: 'commit evidence',
      encoding: 'utf8',
    });
    expect(child.status, child.stderr).toBe(0);
    const invocation: unknown = JSON.parse(readFileSync(receipt, 'utf8'));
    expect(invocation).toEqual({
      args,
      cwd: directory,
      files: [
        {
          argument: join(alias, 'schema.json'),
          name: 'schema.json',
          parent: directory,
        },
        {
          argument: join(alias, 'result.json'),
          name: 'result.json',
          parent: directory,
        },
      ],
      schema: { type: 'object' },
      prompt: 'commit evidence',
    });
    expect(readFileSync(join(directory, 'result.json'), 'utf8')).toBe(
      JSON.stringify(plan),
    );
  });

  it.each([{ exitCode: 3 }, { resultBytes: 65537 }])(
    'refuses a failed or oversized Codex result and cleans its temporary directory: %j',
    async (failure) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({
            directory: temporaryRoot,
            prefix: 'porcelain-provider-test-',
          });
          const receipt = path.join(root, 'receipt.json');
          const command = path.join(root, 'codex');
          yield* fs.writeFileString(
            command,
            codingToolScript({
              provider: 'codex',
              runner: process.execPath,
              receipt,
              reply: plan,
              ...failure,
            }),
          );
          yield* fs.chmod(command, 0o700);
          const result = yield* Effect.gen(function* () {
            const subject = yield* nativePlanner();
            return yield* subject
              .plan({ ...request, model: 'codex:small' })
              .pipe(Effect.result);
          }).pipe(
            Effect.provide(
              ConfigProvider.layer(
                ConfigProvider.fromUnknown({ PATH: root, CODEX_HOME: root }),
              ),
            ),
          );
          expect(result).toMatchObject({
            _tag: 'Failure',
            failure: { _tag: 'ProviderProcessFailedError' },
          });
          const invocation = yield* Schema.decodeUnknownEffect(receiptSchema)(
            yield* fs.readFileString(receipt),
          );
          expect(yield* fs.exists(invocation.cwd)).toBe(false);
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
      );
    },
  );

  it('lists only safe visible cached models and refuses an oversized cache', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({
          directory: temporaryRoot,
          prefix: 'porcelain-provider-test-',
        });
        yield* fs.writeFileString(
          path.join(root, 'codex'),
          `#!${process.execPath}\n`,
        );
        yield* fs.chmod(path.join(root, 'codex'), 0o700);
        yield* fs.writeFileString(
          path.join(root, 'models_cache.json'),
          JSON.stringify({
            models: [
              { slug: 'small', display_name: 'Small', visibility: 'list' },
              { slug: '-unsafe', display_name: 'Unsafe', visibility: 'list' },
              { slug: 'hidden', display_name: 'Hidden', visibility: 'hide' },
            ],
          }),
        );
        yield* Effect.gen(function* () {
          const subject = yield* nativePlanner();
          expect(yield* subject.models()).toEqual([
            { id: 'codex:small', label: 'Small' },
          ]);
          yield* fs.writeFileString(
            path.join(root, 'models_cache.json'),
            'x'.repeat(65537),
          );
          expect(yield* subject.models()).toEqual([]);
          yield* fs.chmod(path.join(root, 'codex'), 0o600);
          expect(
            yield* subject
              .plan({ ...request, model: 'codex:small' })
              .pipe(Effect.result),
          ).toMatchObject({
            _tag: 'Failure',
            failure: { _tag: 'ProviderNotInstalledError' },
          });
        }).pipe(
          Effect.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({ PATH: root, CODEX_HOME: root }),
            ),
          ),
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    );
  });
});
