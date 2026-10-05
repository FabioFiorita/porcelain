const route = `
import { FilesApi } from '@porcelain/contracts/files';
import { HttpApiBuilder } from 'effect/http-api';
import { effectRoutes } from '../../effect-bridge.ts';
const handlers = HttpApiBuilder.group(FilesApi, 'files', (handlers) =>
  handlers.handle('readTextFile', ({ params, query }) => useCases.readTextFile.execute({ ...params, ...query })));
export const routes = effectRoutes(FilesApi, layer);`;
const path = 'apps/server/src/http/routes/files/files-api.ts';

const operation = `export class ReadHealthUseCase {
  private readonly reader: ReadEnvironmentService;
  constructor(reader: ReadEnvironmentService) { this.reader = reader; }
  execute(): Effect.Effect<ReadHealthResponse, MissingEnvironmentIdentityError> { return this.reader.execute(); }
}`;

const nativeService = `import { Context, Effect, Layer } from 'effect';
export class ReadEnvironmentService extends Context.Service<ReadEnvironmentService, {
  readonly execute: () => Effect.Effect<ReadEnvironmentResult, MissingEnvironmentIdentityError>
}>()('@porcelain/access/ReadEnvironmentService') {
  static readonly layer = Layer.effect(ReadEnvironmentService, Effect.gen(function* () {
    const identity = yield* EnvironmentIdentityReader;
    return { execute: Effect.fn('ReadEnvironmentService.execute')(function* (): Effect.fn.Return<ReadEnvironmentResult, MissingEnvironmentIdentityError> {
      return { environmentId: identity.environmentId() };
    }) };
  }));
}`;
const nativeClock = `import { Context } from 'effect';
export interface Clock { now(): string; }
export const Clock = Context.Service<'@porcelain/kernel/Clock', Clock>('@porcelain/kernel/Clock');`;

export const effectRuleCases = [
  ...[
    nativeService.replace(
      "'@porcelain/access/ReadEnvironmentService'",
      "'@porcelain/access/Other'",
    ),
    nativeService.replace('readonly execute:', 'execute:'),
    nativeService.replace('static readonly layer', 'readonly layer'),
    nativeService.replace(
      'Layer.effect(ReadEnvironmentService,',
      'Layer.effect(OtherService,',
    ),
    nativeService.replace(
      "'ReadEnvironmentService.execute'",
      "'Other.execute'",
    ),
    nativeService.replace(
      'readonly execute:',
      'readonly refresh: () => Effect.Effect<void>; readonly execute:',
    ),
    nativeService.replace(
      'static readonly layer',
      'constructor(reader: Reader) {} static readonly layer',
    ),
    nativeService.replace('Layer.effect', 'custom.effect'),
    nativeService.replace(
      "import { Context, Effect, Layer } from 'effect';",
      "import { Effect, Layer } from 'effect'; const Context = { Service: makeService };",
    ),
  ].map((invalid) => ({
    rule: 'operation-class-shape',
    path: 'packages/access/src/services/read-environment-service.ts',
    valid: nativeService,
    invalid,
    errors: invalid.includes('const Context') ? 4 : 1,
  })),
  {
    rule: 'operation-class-shape',
    path: 'packages/access/src/services/read-environment-service.ts',
    valid: nativeService,
    invalid:
      'export class ReadEnvironmentService { execute(): Effect.Effect<ReadEnvironmentResult> { return Effect.succeed(result); } }',
    errors: 1,
  },
  ...[
    nativeClock.replace(
      "Clock>('@porcelain/kernel/Clock')",
      "Clock>('@porcelain/kernel/Other')",
    ),
    nativeClock.replace("'@porcelain/kernel/Clock', Clock", 'Clock, Clock'),
    nativeClock.replace('Context.Service', 'Context.Reference'),
    nativeClock.replace('const Clock', 'let Clock'),
  ].map((invalid) => ({
    rule: 'models-are-types',
    path: 'packages/kernel/src/ports/clock.ts',
    valid: nativeClock,
    invalid,
    errors: 1,
  })),
  {
    rule: 'models-are-types',
    path: 'packages/kernel/src/models/clock.ts',
    validPath: 'packages/kernel/src/ports/clock.ts',
    valid: nativeClock,
    invalid: nativeClock,
    errors: 2,
  },
  ...['AbortSignal', 'AbortController'].map((raw) => ({
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: operation,
    invalid: operation.replace(
      'private readonly reader:',
      `private readonly cancellation: ${raw}; private readonly reader:`,
    ),
    errors: 1,
  })),
  {
    rule: 'spec-imports',
    path: 'packages/client/src/shared/api/write-queue.spec.ts',
    valid: `import { it } from '@effect/vitest'; import { Deferred, Effect } from 'effect';`,
    invalid: `import { useMutation } from '@tanstack/react-query';`,
    errors: 1,
  },

  ...[
    `import { FileDraft } from '@porcelain/client/files'; export { FileDraft };`,
    `import { FileDraft as Draft } from '@porcelain/client/files'; export { Draft as FileDraft };`,
    `import * as files from '@porcelain/client/files'; export { files };`,
    `import type { FileDraftState } from '@porcelain/client/files'; export type { FileDraftState };`,
  ].map((invalid) => ({
    rule: 'client-owns-shared-logic',
    path: 'apps/web/src/features/files/store.ts',
    valid: `import type { FileDraft } from '@porcelain/client/files'; export const snapshot = (draft: FileDraft) => draft.snapshot();`,
    invalid,
    errors: 1,
  })),
  ...['web', 'mobile'].map((app) => ({
    rule: 'web-transport-owner',
    path: `apps/${app}/src/shared/live/socket.ts`,
    validPath: `apps/${app}/src/shared/adapters/live-socket.ts`,
    valid: `import { Effect } from 'effect'; import { Socket } from 'effect/socket'; export const open = (url: string) => Socket.makeWebSocket(url).pipe(Effect.provideService(Socket.WebSocketConstructor, (address) => new WebSocket(address)));`,
    invalid: `export const open = (url: string) => new WebSocket(url);`,
    errors: 1,
  })),
  {
    rule: 'spec-imports',
    path: 'packages/client/src/features/live/commands/live-queries.spec.ts',
    valid: `import { createOperationStore } from '@porcelain/client/git-actions'; import { Socket } from 'effect/socket';`,
    invalid: `import { createOperationStore } from '../../git-actions/store/operations.ts';`,
    errors: 1,
  },
  ...[
    `import { withReadLease } from '@porcelain/effects';`,
    `import { withWriteLease as admit } from '@porcelain/effects/worktree';`,
    `import { WorktreeRead } from '@porcelain/effects';`,
    `import { WorktreeWrite as capability } from '@porcelain/effects/worktree';`,
    `import * as capabilities from '@porcelain/effects';`,
    `export { withReadLease as admit } from '@porcelain/effects';`,
    `export * from '@porcelain/effects/worktree';`,
  ].map((invalid) => ({
    rule: 'worktree-admission-owner',
    path: 'packages/files/src/services/read-text-file-service.ts',
    valid: `import { nativeRead, type WorktreeRead } from '@porcelain/effects';`,
    invalid,
    errors: 1,
  })),
  {
    rule: 'spec-asserts',
    path: 'apps/server/src/runtime/read.spec.ts',
    valid: `import { it, expect } from '@effect/vitest'; import { Effect } from 'effect'; import { read } from './read.ts';
it.effect('reads the saved value', () => Effect.gen(function* () { const result = yield* read(); expect(result).toBe('saved'); }));`,
    invalid: `import { it, expect } from 'vitest'; import { Effect } from 'effect'; import { read } from './read.ts';
it('reads the saved value', () => { Effect.gen(function* () { const result = yield* read(); expect(result).toBe('saved'); }); });`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/src/runtime/read.spec.ts',
    valid: `import { it, expect } from '@effect/vitest'; import { Effect } from 'effect'; import { read } from './read.ts';
it.effect('reads the saved value', () => Effect.gen(function* () { const result = yield* read(); expect(result).toBe('saved'); }));`,
    invalid: `import { it, expect } from '@effect/vitest'; import { Effect } from 'effect'; import { read } from './read.ts';
it.effect('reads the saved values', () => Effect.gen(function* () { const result = yield* read(); result.map(value => expect(value).toBe('saved')); }));`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/src/runtime/read.spec.ts',
    valid: `import { it, expect } from 'vitest'; import { read } from './read.ts';
it('reads once', async () => { const test = { read }; const result = await test.read(); expect(result).toBe('saved'); });`,
    invalid: `import { it, expect } from 'vitest'; import { read } from './read.ts';
it('reads once', async () => { const result = await read(); if (result) it('asserts later', () => expect(result).toBe('saved')); });`,
    errors: 1,
  },
  ...[
    route.replace("'@porcelain/contracts/files'", "'./private-api.ts'"),
    route.replace("group(FilesApi, 'files'", "group(otherApi, 'files'"),
    route.replace("group(FilesApi, 'files'", 'group(FilesApi, groupName'),
    route.replace(
      "(handlers) =>\n  handlers.handle('readTextFile', ({ params, query }) => useCases.readTextFile.execute({ ...params, ...query }))",
      'buildHandlers',
    ),
    route.replace(
      "import { effectRoutes } from '../../effect-bridge.ts';",
      'const effectRoutes = (api, layer) => layer;',
    ),
    route.replace(
      'effectRoutes(FilesApi, layer)',
      'manualRoutes(FilesApi, layer)',
    ),
  ].map((invalid) => ({
    rule: 'feature-route-shape',
    path,
    valid: route,
    invalid,
    errors: 1,
  })),
  ...[
    "server.route({ method: 'GET', url: '/api/worktrees/:worktreeId/text' });",
    "server['get']('/api/worktrees/:worktreeId/text', handler);",
    "server.addHook('preHandler', handler);",
    'server.register(otherRoutes);',
  ].map((registration) => ({
    rule: 'feature-route-registrations',
    path,
    valid: route,
    invalid: `${route}\n${registration}`,
    errors: 1,
  })),
  ...[
    route.replace(
      'useCases.readTextFile.execute({ ...params, ...query })',
      'Effect.succeed({ text: "wrong" })',
    ),
    route.replace(
      'useCases.readTextFile.execute({ ...params, ...query })',
      'Effect.andThen(useCases.readTextFile.execute(params), useCases.editFile.execute(query))',
    ),
    route.replace(
      '({ params, query }) => useCases',
      'async ({ params, query }) => useCases',
    ),
    route.replace(
      'useCases.readTextFile.execute({ ...params, ...query })',
      'flag ? useCases.readTextFile.execute(params) : Effect.void',
    ),
  ].map((invalid) => ({
    rule: 'feature-route-handler',
    path,
    valid: route,
    invalid,
    errors: 1,
  })),
  ...[
    {
      invalid: operation.replace('ReadHealthUseCase', 'ReadHealthController'),
      errors: 2,
    },
    {
      invalid: operation.replace('private readonly reader', 'private reader'),
      errors: 1,
    },
    {
      invalid: operation.replace('private readonly reader', 'readonly reader'),
      errors: 1,
    },
    {
      invalid: operation.replace(
        'execute():',
        'execute(context: OperationContext):',
      ),
      errors: 1,
    },
    {
      invalid: operation.replace(
        'execute():',
        'execute(input: ReadHealthInput, signal?: AbortSignal):',
      ),
      errors: 2,
    },
    {
      invalid: operation.replace(
        'Effect.Effect<ReadHealthResponse, MissingEnvironmentIdentityError>',
        'Promise<ReadHealthResponse>',
      ),
      errors: 1,
    },
    { invalid: operation.replace('execute():', 'async execute():'), errors: 1 },
    {
      invalid: operation.replace('execute():', 'execute(input: {}):'),
      errors: 1,
    },
    { invalid: operation.replace('execute():', 'read():'), errors: 2 },
    { invalid: `${operation}\nexport const fallback = undefined;`, errors: 1 },
    {
      invalid: operation
        .replace('execute():', 'readonly execute = ():')
        .replace('> { return', '> => { return'),
      errors: 3,
    },
    {
      invalid: operation.replace(
        'execute():',
        'forOwner(): void {}\n  execute():',
      ),
      errors: 1,
    },
  ].map((entry) => ({
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: operation,
    ...entry,
  })),
  {
    rule: 'operation-class-shape',
    path: 'packages/files/src/services/read-text-file-service.ts',
    valid:
      'export class ReadTextFileService { execute(input: ReadTextFileInput): Effect.Effect<ReadTextFileResult, ReadFailure, WorktreeRead> { return Effect.succeed(result); } }',
    invalid:
      'export class ReadTextFileService { execute(input: ReadTextFileInput, signal?: AbortSignal): Effect.Effect<ReadTextFileResult, ReadFailure, WorktreeRead> { return Effect.succeed(result); } }',
    errors: 2,
  },
  {
    rule: 'port-shape',
    path: 'apps/server/src/ports/check-worktree-use-case-port.ts',
    valid:
      'export interface CheckWorktreeUseCasePort { execute(input: CheckWorktreeInput): Effect.Effect<ListedWorktree, WorktreeAccessFailure>; }',
    invalid:
      'export interface CheckWorktreeUseCasePort { execute(input: CheckWorktreeInput, context: OperationContext): Effect.Effect<ListedWorktree, WorktreeAccessFailure>; }',
    errors: 1,
  },
];

const atomicMutation = `import { Effect } from 'effect';
import type { Lanes } from '../../runtime/lanes.ts';
export class RenameEnvironmentUseCase {
  private readonly lanes: Lanes;
  execute(input: RenameEnvironmentRequest): Effect.Effect<RenameEnvironmentResponse> {
    return this.lanes.commit(this.laneKeys.access(), () => this.renameEnvironment.execute(input), () => Effect.sync(() => this.events.inventoryChanged()));
  }
}`;
const preparedMutation = `import { Effect } from 'effect';
import type { WorktreeAccess } from '../../runtime/worktree-access.ts';
export class PublishReviewUseCase {
  private readonly access: WorktreeAccess;
  execute(input: PublishReviewInput): Effect.Effect<PublishReviewResult> {
    return this.access.transaction(input.worktreeId, () => this.readEvidence.execute(input), (evidence) => this.publishReview.execute({ ...input, evidence }), () => Effect.sync(() => this.events.worktreeChanged(input)));
  }
}`;

effectRuleCases.push(
  {
    rule: 'events-after-lane',
    path: 'apps/server/src/use-cases/access/rename-environment.ts',
    valid: atomicMutation,
    invalid: atomicMutation.replace(
      '() => this.renameEnvironment.execute(input)',
      '() => Effect.sync(() => { this.events.inventoryChanged(); return this.renameEnvironment.execute(input); })',
    ),
    errors: 1,
  },
  ...[
    preparedMutation.replace(
      '() => this.readEvidence.execute(input)',
      '() => Effect.sync(() => { this.events.worktreeChanged(input); return this.readEvidence.execute(input); })',
    ),
    preparedMutation.replace(
      '(evidence) => this.publishReview.execute({ ...input, evidence })',
      '(evidence) => Effect.sync(() => { this.events.worktreeChanged(input); return this.publishReview.execute({ ...input, evidence }); })',
    ),
  ].map((invalid) => ({
    rule: 'events-after-lane',
    path: 'apps/server/src/use-cases/reviews/publish-review.ts',
    valid: preparedMutation,
    invalid,
    errors: 1,
  })),
  {
    rule: 'events-after-lane',
    path: 'apps/server/src/use-cases/git-actions/run-git-action.ts',
    valid: `export class RunGitActionUseCase { private failed(run: GitActionRun, error: unknown): Effect.Effect<void> { return this.lanes.finish(this.laneKeys.receipts(run), () => this.abandon(run, error)); } private abandon(run: GitActionRun, error: unknown): Effect.Effect<void> { return Effect.sync(() => this.events.gitActionChanged(run)); } }`,
    invalid: `export class RunGitActionUseCase { private failed(run: GitActionRun, error: unknown): Effect.Effect<void> { return this.lanes.finish(this.laneKeys.receipts(run), () => this.announceAbandon(run, error)); } private announceAbandon(run: GitActionRun, error: unknown): Effect.Effect<void> { return Effect.sync(() => this.events.gitActionChanged(run)); } }`,
    errors: 1,
  },
  ...[
    atomicMutation.replace(
      '() => this.renameEnvironment.execute(input)',
      "() => this.lanes.run(this.laneKeys.access(), 'write', () => this.renameEnvironment.execute(input))",
    ),
    atomicMutation.replace(
      '() => this.renameEnvironment.execute(input)',
      '() => this.checkWorktree.execute(input)',
    ),
    preparedMutation.replace(
      '() => this.readEvidence.execute(input)',
      '() => this.access.read(input.worktreeId, () => this.readEvidence.execute(input))',
    ),
    preparedMutation.replace(
      '(evidence) => this.publishReview.execute({ ...input, evidence })',
      "(evidence) => this.access.reviews(input.worktreeId, 'write', () => this.publishReview.execute({ ...input, evidence }))",
    ),
  ].map((invalid) => ({
    rule: 'no-nested-lane',
    path: 'apps/server/src/use-cases/reviews/publish-review.ts',
    valid: invalid.includes('class Rename') ? atomicMutation : preparedMutation,
    invalid,
    errors: 1,
  })),
  {
    rule: 'no-nested-lane',
    path: 'apps/server/src/use-cases/access/rename-environment.ts',
    valid: atomicMutation.replace(
      '() => this.renameEnvironment.execute(input)',
      "() => this.lanes.start(() => this.lanes.run(this.laneKeys.access(), 'write', () => this.renameEnvironment.execute(input)), () => Effect.void)",
    ),
    invalid: atomicMutation.replace(
      '() => this.renameEnvironment.execute(input)',
      "() => this.lanes.run(this.laneKeys.access(), 'write', () => this.renameEnvironment.execute(input))",
    ),
    errors: 1,
  },
);

for (const original of [...effectRuleCases].filter(
  (entry) =>
    ['events-after-lane', 'no-nested-lane'].includes(entry.rule) &&
    entry.valid === preparedMutation,
)) {
  const aliased = (source) =>
    source
      .replace('WorktreeAccess }', 'WorktreeAccess as Access }')
      .replace('access: WorktreeAccess', 'access: Access');
  effectRuleCases.push({
    ...original,
    valid: aliased(original.valid),
    invalid: aliased(original.invalid),
  });
}

for (const invalid of [
  "import { HttpApiClient as Client } from 'effect/http-api';",
  "import * as Client from 'effect/http-api';",
  "import * as Client from 'effect/http-api/HttpApiClient';",
  "const Client = import('effect/http-api');",
  "export { HttpApiClient as Client } from 'effect/http-api';",
  "export * from 'effect/http-api';",
  "import { transportClient as Client } from '../../../shared/api/effect-client.ts';",
])
  effectRuleCases.push({
    rule: 'web-api-owns-request',
    path: 'packages/client/src/features/files/commands/save.ts',
    valid:
      "import { filesApi } from '../api.ts'; import { runRequest } from '../../../shared/api/effect-client.ts';",
    invalid,
    errors: 1,
  });

for (const path of [
  'packages/client/src/features/files/rules/quick-open.ts',
  'apps/web/src/features/files/rules/quick-open.ts',
])
  effectRuleCases.push({
    rule: 'web-rules-are-pure',
    path,
    valid:
      "import { FILE_QUICK_OPEN_MAX } from '../../../config/limits.ts'; export const limit = FILE_QUICK_OPEN_MAX;",
    invalid:
      "import { queryOptions } from '@tanstack/query-core'; export const options = queryOptions;",
    errors: 1,
  });
for (const path of [
  'apps/web/src/features/access/api.ts',
  'apps/web/src/shared/api/transport.ts',
])
  effectRuleCases.push({
    rule: 'web-api-owns-request',
    path,
    valid: "import { accessApi } from '@porcelain/client/access/api';",
    invalid: "import { HttpApiClient } from 'effect/http-api';",
    errors: 1,
  });
