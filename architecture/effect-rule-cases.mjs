const route = `
import { FilesApi } from '@porcelain/contracts/files';
import { HttpApiBuilder } from 'effect/http-api';
import { Layer } from 'effect';
const handlers = HttpApiBuilder.group(FilesApi, 'files', (handlers) =>
  handlers.handle('readTextFile', ({ params, query }) => useCases.readTextFile.execute({ ...params, ...query })));
export const routes = HttpApiBuilder.layer(FilesApi).pipe(Layer.provide(handlers));`;
const path = 'apps/server/src/http/routes/files/files-api.ts';

export const nativeHealthOperation = `import { Context, Effect, Layer } from 'effect';
export class ReadHealthUseCase extends Context.Service<ReadHealthUseCase, {
  readonly execute: () => Effect.Effect<ReadHealthResponse, MissingEnvironmentIdentityError>
}>()('@porcelain/server/ReadHealthUseCase') {
  static readonly layer = Layer.effect(ReadHealthUseCase, Effect.gen(function* () {
    const reader = yield* ReadEnvironmentService;
    return { execute: Effect.fn('ReadHealthUseCase.execute')(function* (): Effect.fn.Return<ReadHealthResponse, MissingEnvironmentIdentityError> {
      return yield* reader.execute();
    }) };
  }));
}`;

const nativeIdSource = `import { Context } from 'effect';
export interface IdSource { next(): string; }
export const IdSource = Context.Service<'@porcelain/kernel/IdSource', IdSource>('@porcelain/kernel/IdSource');`;

export const effectRuleCases = [
  ...['desktop', 'mobile'].map((app) => ({
    rule: 'web-journey-retrying-assertions',
    path: 'apps/web/spec/e2e/scope.e2e.ts',
    validPath: `apps/${app}/spec/e2e/scope.e2e.ts`,
    valid:
      "test('observes the native state', () => { expect('ready').toBe('ready'); });",
    invalid:
      "test('observes the page state', () => { expect('ready').toBe('ready'); });",
    errors: 1,
  })),
  {
    rule: 'web-rules-are-pure',
    path: 'packages/client/src/features/files/rules/read.ts',
    validPath: 'packages/client/src/features/files/rules/read.spec.ts',
    valid: "import { expect } from 'vitest';",
    invalid: "import { useQuery } from '@tanstack/react-query';",
    errors: 1,
  },
  {
    rule: 'operation-capability',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: nativeHealthOperation.replace(
      "Effect.fn('ReadHealthUseCase.execute')",
      "Effect.fn('health')",
    ),
    invalid:
      'export class ReadHealthUseCase { execute() { return undefined; } }',
    errors: 1,
  },
  {
    rule: 'operation-capability',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: nativeHealthOperation.replace(
      'static readonly layer',
      "static readonly label = 'health'; static readonly layer",
    ),
    invalid: nativeHealthOperation.replace(
      "'@porcelain/server/ReadHealthUseCase'",
      "'@porcelain/server/Other'",
    ),
    errors: 1,
  },
  ...[
    nativeIdSource.replace("IdSource>('", "IdSource>('wrong"),
    nativeIdSource.replace(
      "'@porcelain/kernel/IdSource', IdSource",
      'IdSource, IdSource',
    ),
    nativeIdSource.replace('Context.Service', 'Context.Reference'),
    nativeIdSource.replace('const IdSource', 'let IdSource'),
  ].map((invalid) => ({
    rule: 'models-are-types',
    path: 'packages/kernel/src/ports/id-source.ts',
    valid: nativeIdSource,
    invalid,
    errors: 1,
  })),
  {
    rule: 'models-are-types',
    path: 'packages/kernel/src/models/id-source.ts',
    validPath: 'packages/kernel/src/ports/id-source.ts',
    valid: nativeIdSource,
    invalid: nativeIdSource,
    errors: 2,
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

for (const invalid of [
  "import { AtomRef as State } from 'effect/reactivity'; State.make(false);",
  "import * as State from 'effect/reactivity/AtomRef'; State.make(false);",
  "import { make as state } from 'effect/reactivity/AtomRef'; state(false);",
  "import { Atom as State } from 'effect/reactivity'; State.make(false);",
  "import * as State from 'effect/reactivity/Atom'; State.make(false);",
])
  effectRuleCases.push({
    rule: 'web-store-owns-atoms',
    path: 'apps/web/src/features/files/views/ownership.tsx',
    valid:
      "import { AsyncResult } from 'effect/reactivity'; import type { AtomRef } from 'effect/reactivity';",
    invalid,
    errors: 1,
  });
for (const path of [
  'apps/web/src/features/files/store.ts',
  'apps/mobile/src/features/projects/store.ts',
  'packages/client/src/features/files/store.ts',
])
  effectRuleCases.push({
    rule: 'web-store-owns-atoms',
    path,
    valid:
      "import { Atom, AtomRef } from 'effect/reactivity'; const state = AtomRef.make(false);",
    invalid: "import { createStore } from 'zustand/vanilla';",
    errors: 1,
  });

for (const invalid of [
  "import { Atom as State } from 'effect/reactivity'; State.kvs({});",
  "import { kvs as persisted } from 'effect/reactivity/Atom'; persisted({});",
])
  effectRuleCases.push({
    rule: 'web-store-owns-atoms',
    path: 'apps/web/src/features/files/commands/save.ts',
    valid:
      "import { Atom } from 'effect/reactivity'; const command = Atom.fn(() => undefined);",
    invalid,
    errors: 1,
  });
