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
import { NodeServices } from '@effect/platform-node';
import { LanguageModel, Model } from 'effect/ai';
import { describe, expect, it } from 'vitest';
import { codingToolScript } from '../../spec/fixtures/coding-tool.ts';
import { CommitPlanner } from './commit-planner.ts';
import {
  CodexProvider,
  ClaudeProvider,
} from '@porcelain/agents/commit-planning';

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

  it('lists the models of every provider in order', async () => {
    const models = await Effect.runPromise(
      planner(scripted('codex', {}), scripted('claude', {})).models(),
    );
    expect(models.map((model) => model.id)).toEqual([
      'codex:small',
      'claude:small',
    ]);
  });

  it.each([
    ['extra root field', { ...plan, extra: true }],
    ['extra group field', { groups: [{ ...plan.groups[0], extra: true }] }],
    ['no groups', { groups: [] }],
    [
      'too many groups',
      { groups: Array.from({ length: 21 }, () => plan.groups[0]) },
    ],
    ['empty message', { groups: [{ message: '', paths: ['README.md'] }] }],
    [
      'long message',
      { groups: [{ message: 'x'.repeat(16_385), paths: ['README.md'] }] },
    ],
    ['no paths', { groups: [{ message: 'Fix', paths: [] }] }],
    [
      'too many paths',
      {
        groups: [
          {
            message: 'Fix',
            paths: Array.from({ length: 2001 }, () => 'README.md'),
          },
        ],
      },
    ],
    ['empty path', { groups: [{ message: 'Fix', paths: [''] }] }],
    ['long path', { groups: [{ message: 'Fix', paths: ['x'.repeat(4097)] }] }],
  ])(
    'rejects %s at the native structured output boundary',
    async (_name, reply) => {
      await expect(
        Effect.runPromise(
          planner(
            scripted('codex', {}),
            scripted('claude', { sonnet: reply }),
          ).plan(request),
        ),
      ).rejects.toMatchObject({ _tag: 'CommitPlanFailedError' });
    },
  );
  it.each(['codex', 'claude'] as const)(
    'runs the restricted %s CLI with native schema validation and removes its temporary directory',
    async (provider) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({
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
          else
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
              path.join(invocation.cwd, 'schema.json'),
              '--output-last-message',
              path.join(invocation.cwd, 'result.json'),
              '--model',
              'small',
              '-',
            ]);
          expect(yield* fs.exists(invocation.cwd)).toBe(false);
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
      );
    },
  );

  it.each([{ exitCode: 3 }, { resultBytes: 65537 }])(
    'refuses a failed or oversized Codex result and cleans its temporary directory: %j',
    async (failure) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({
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
