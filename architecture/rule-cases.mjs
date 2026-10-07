const fixtureWatchWorktreesEventsFromUseCases = `import { Effect } from 'effect';
import { AnnounceWorktreeChangeUseCasePort } from '../../ports/announce-worktree-change-use-case-port.ts';
export const announce = Effect.flatMap(AnnounceWorktreeChangeUseCasePort, (operation) => operation.execute({ worktreeId: 'one', change: 'git' }));`;
const fixtureNativeEventPublisherLayer = `import { Layer as NativeLayer, Effect } from 'effect';
import { EventPublisher as Publisher } from '../../ports/event-publisher.ts';
export const publisherLayer = NativeLayer.effect(Publisher, Effect.succeed({ inventoryChanged: () => Effect.void }));`;
const fixtureReadChangeLinesUseCaseComputes = `import type { ReadChangeLinesService } from '@porcelain/changes/services';
import type { ReadChangeLinesQuery } from '@porcelain/contracts/changes';

export class ReadChangeLinesUseCase {
  private readonly readChangeLines: ReadChangeLinesService;
  execute(input: ReadChangeLinesQuery & { text: string }) {
    const { path, from, to, at, text } = input;
    return this.readChangeLines.execute({ path, from, to, at, text });
  }
}
`;
import {
  effectRuleCases,
  nativeHealthOperation,
} from './effect-rule-cases.mjs';
const commentSeenStore = `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`;
const filesystemDirectoryReader = `export class FilesystemDirectoryReader implements DirectoryReader {
  async list(
  ): Promise<DirectoryRead> {
    try {
      for await (const entry of await opendir(before.path, {
      })) {
        if (found.length === input.limit) {
        }
      }
    } catch (error) {
    }
  }
}`;
const remoteLinkCases = `import { describe, expect, it } from 'vitest';
import { remoteLink } from './remotes.ts';

describe('remoteLink', () => {
  it('reads the address, code and environment of a pairing link', () => {
    expect(remoteLink('http://192.0.2.10:4738/pair#c=a&e=env')).toEqual({
      address: 'http://192.0.2.10:4738',
      code: 'a',
      environmentId: 'env',
    });
  });

  it.each(['', 'http://192.0.2.10:4738/pair#c=a'])('reads nothing from %j', (value) => {
    expect(remoteLink(value)).toBeUndefined();
  });
});
`;
const apiErrorCases = `import { apiErrorSchema } from '@porcelain/contracts/shared';
import { expect } from 'vitest';
import { z } from 'zod';
import { worktreeNotFound } from '../kit/answers.ts';
import { test } from '../kit/server-test.ts';
import { record, text } from '../kit/session.ts';

const unknownChanges = () => ({ method: 'GET', path: \`/api/worktrees/\${'0'.repeat(32)}/changes\` });
const health = () => ({ method: 'GET', path: '/api/health' });

test('the changes of an unknown worktree are refused with the error contract', async ({ session }) => {
  const response = await session.send(unknownChanges());
  const body = record(response.body);
  expect(response.body).toEqual(expect.schemaMatching(apiErrorSchema));
});
`;

const encodedCredential = `import type { CredentialKind, CredentialParts } from '../models/credential.ts';

export function parseCredential(
  kind: CredentialKind,
  value: string,
): CredentialParts | undefined {
  const parts = new RegExp(\`^\${kind}_(?<id>[0-9a-f-]{36})_(?<secret>[\\\\w-]{43})$\`).exec(value)?.groups;
  return parts?.id && parts.secret
    ? { id: parts.id, secret: parts.secret }
    : undefined;
}
`;

const runtimeJobs = `const openServer: OpenServer = async (input) => {
  const jobs: readonly Job[] = [
    new IntervalJob(
      { atStart: true, everyMs: limits.jobs.refreshInventoryMs },
    ),
  ];
};`;

const runtimeUseCases = `const openServer: OpenServer = async (input) => {
  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,
  };
};`;

const observedStoreState = `describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });
});
`;

export default [
  ...[
    '@effect/platform-node',
    'effect/cli',
    './operations.ts',
    './settings.ts',
    '../config/environment-settings.ts',
  ].map((source) => ({
    rule: 'spec-imports',
    path: 'apps/server/src/cli/cli-program.spec.ts',
    valid: `import { capability } from '${source}';`,
    invalid: "import { startServer } from '../bootstrap/compose-server.ts';",
    errors: 1,
  })),

  ...effectRuleCases,
  {
    rule: 'spec-imports',
    path: 'apps/server/src/installer/records.spec.ts',
    valid: "import { NodeServices } from '@effect/platform-node';",
    invalid: "import { useQuery } from '@tanstack/react-query';",
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'apps/web/src/features/reviews/live.ts',
    valid: "import { RequestError } from '@porcelain/client/transport';",
    invalid: "import { HttpApiClient } from 'effect/http-api';",
    errors: 1,
  },
  {
    rule: 'spec-imports',
    path: 'packages/client/src/features/reviews/commands/reviewed.spec.ts',
    valid:
      "import { QueryClient } from '@tanstack/query-core'; import { reviewedQueryOptions } from '@porcelain/client/reviews';",
    invalid: "import { useQueryClient } from '@tanstack/react-query';",
    errors: 1,
  },
  {
    rule: 'web-cache-writes-in-commands',
    path: 'apps/web/src/features/reviews/queries/comments.ts',
    validPath: 'packages/client/src/features/reviews/commands/reviewed.spec.ts',
    valid: 'client.setQueryData(key, { marks: [] });',
    invalid: 'client.setQueryData(key, { marks: [] });',
    errors: 1,
  },

  {
    rule: 'client-owns-shared-logic',
    path: 'apps/web/src/shared/query/file-drafts.ts',
    valid: "import { retainedFileDrafts } from '@porcelain/client/files';",
    invalid: "export { retainedFileDrafts } from '@porcelain/client/files';",
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'apps/web/src/features/files/index.ts',
    valid: "export { FileEditor } from './views/file-editor';",
    invalid: "export type { FileDraftState } from '@porcelain/client/files';",
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'apps/mobile/src/features/files/api.ts',
    valid: "import { filesApi } from '@porcelain/client/files/api';",
    invalid: "export * from '@porcelain/client/files/api';",
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'apps/mobile/src/features/projects/queries/inventory.ts',
    valid: 'const options = { queryKey: queryKeys.inventory(environmentId) };',
    invalid:
      "const key = ['inventory', environmentId]; const options = { queryKey: key };",
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'packages/client/src/features/reviews/queries/comments.ts',
    valid:
      "const options = { queryKey: queryKeys.worktreeSurface(connection, scope, ['comments']) };",
    invalid:
      "const options = { queryKey: ['review', connection.environmentId, scope.worktreeId, 'comments'] };",
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'packages/client/src/features/projects/store.ts',
    valid:
      'const queue = createWriteQueue(); const submit = () => queue.enqueue(write);',
    invalid:
      'let tail = Promise.resolve(); const submit = () => tail.then(write);',
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'apps/web/src/features/files/queries/text.ts',
    valid: 'function read(connection) { return connection.transport; }',
    invalid:
      "function read(connection) { if (!connection) throw new Error('A connection is required'); }",
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'packages/client/src/features/files/queries/text.ts',
    valid:
      'assertCurrentAnswer(signal, result.worktreeId === scope.worktreeId);',
    invalid:
      "signal.throwIfAborted(); if (result.worktreeId !== scope.worktreeId) throw new Error('Wrong worktree');",
    errors: 1,
  },
  {
    rule: 'client-owns-shared-logic',
    path: 'packages/client/src/features/reviews/commands/comments.ts',
    valid:
      'assertCurrentAnswer(signal, threads.every(thread => thread.worktreeId === worktreeId));',
    invalid:
      "throw new Error('The comment context changed. Reopen Porcelain to continue safely.');",
    errors: 1,
  },
  {
    rule: 'implementation-name',
    path: 'packages/storage/src/repositories/reviews/sqlite-comment-seen-store.ts',
    valid: `import { Effect, Layer } from 'effect';
import { CommentSeenStore } from '@porcelain/reviews/ports';
export const sqliteCommentSeenStoreLayer = Layer.effect(CommentSeenStore, Effect.succeed({}));`,
    invalid: `import { Effect, Layer } from 'effect';
import { CommentSeenStore, CommentStore } from '@porcelain/reviews/ports';
export const sqliteCommentSeenStoreLayer = Layer.mergeAll(Layer.effect(CommentSeenStore, Effect.succeed({})), Layer.effect(CommentStore, Effect.succeed({})));`,
    errors: 1,
  },
  {
    rule: 'interfaces-only-in-ports',
    path: 'packages/files/src/models/list-directory.ts',
    valid: `export type ListDirectoryInput = { worktreeId: string; path: string };`,
    invalid: `export interface ListDirectoryInput {
  worktreeId: string;
  path: string;
}`,
    errors: 1,
  },
  {
    rule: 'interfaces-only-in-ports',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid:
      "import type { ListDirectoryOptions } from '../models/list-directory.ts'; export type ListingOptions = ListDirectoryOptions;",
    invalid:
      'export interface ListDirectoryOptions { maxEntries: number; maxResponseBytes: number; }',
    errors: 1,
  },
  {
    rule: 'interfaces-only-in-ports',
    path: 'apps/server/src/runtime/lane-observer.ts',
    valid: `import type { LaneObserver } from '../ports/lane-observer.ts'; export type LaneObserverOptions = { observer: LaneObserver };`,
    invalid: `export interface LaneObserver {
  queued(lane: string): void;
  settled(lane: string, failed: boolean): void;
}
`,
    errors: 1,
  },
  {
    rule: 'interfaces-only-in-ports',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: `declare global { type ListingBudget = { entries: number }; } export {};`,
    invalid: `
declare global {
  interface ListingBudget {
    entries: number;
  }
}
`,
    errors: 1,
  },
  {
    rule: 'models-file-shape',
    path: 'packages/files/src/models/list-directory.ts',
    valid: `
export type ListDirectoryOutcome =
  | { kind: 'listed'; entries: DirectoryEntry[] }
  | { kind: 'too-large' };
`,
    invalid: `
export type ListDirectoryOutcome =
  | { outcome: 'listed'; entries: DirectoryEntry[] }
  | { outcome: 'too-large' };
`,
    errors: 1,
  },
  {
    rule: 'models-file-shape',
    path: 'packages/files/src/models/list-directory.ts',
    valid: `export type ListDirectoryInput = {
  path: string;
  cursor?: string | undefined;
};`,
    invalid: `export type ListDirectoryInput = {
  path: string;
  cursor?: string;
};`,
    errors: 1,
  },
  {
    rule: 'models-file-shape',
    path: 'packages/reviews/src/models/record-review-activity.ts',
    valid: `export type RecordReviewActivityResult = { recorded: boolean };`,
    invalid: `export type RecordReviewActivityResult = void;`,
    errors: 1,
  },
  {
    rule: 'naming',
    path: 'packages/access/src/rules/credential.ts',
    valid: `const ID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';`,
    invalid: `const idPattern =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';`,
    errors: 1,
  },
  {
    rule: 'naming',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: `export class InMemoryCommentSeenStore implements CommentSeenStore {
}`,
    invalid: `export class MemoryCommentSeenStore implements CommentSeenStore {
}`,
    errors: 1,
  },
  {
    rule: 'naming',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid:
      "import { Effect } from 'effect';\nimport type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';\nimport type { ReadEnvironmentService } from '@porcelain/access/services';\nimport type { ReadHealthResponse } from '@porcelain/contracts/access';\nimport type { LaneKeys } from '../../runtime/lane-keys.ts';\nimport type { Lanes } from '../../runtime/lanes.ts';\n\nexport class ReadHealthUseCase {\n  private readonly readEnvironment: ReadEnvironmentService;\n  private readonly lanes: Lanes;\n  private readonly laneKeys: LaneKeys;\n\n  constructor(\n    readEnvironment: ReadEnvironmentService,\n    lanes: Lanes,\n    laneKeys: LaneKeys,\n  ) {\n    this.readEnvironment = readEnvironment;\n    this.lanes = lanes;\n    this.laneKeys = laneKeys;\n  }\n\n  execute(): Effect.Effect<\n    ReadHealthResponse,\n    MissingEnvironmentIdentityError\n  > {\n    return Effect.gen({ self: this }, function* () {\n      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>\n        Effect.gen({ self: this }, function* () {\n          const { environmentId } = yield* this.readEnvironment.execute();\n          return { status: 'ok' as const, environmentId };\n        }),\n      );\n    });\n  }\n}\n",
    invalid:
      "import { Effect } from 'effect';\nimport type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';\nimport type { ReadEnvironmentService } from '@porcelain/access/services';\nimport type { ReadHealthResponse } from '@porcelain/contracts/access';\nimport type { LaneKeys } from '../../runtime/lane-keys.ts';\nimport type { Lanes } from '../../runtime/lanes.ts';\n\nexport class ReadHealthUseCase {\n  private readonly readEnvironmentService: ReadEnvironmentService;\n  private readonly lanes: Lanes;\n  private readonly laneKeys: LaneKeys;\n\n  constructor(\n    readEnvironment: ReadEnvironmentService,\n    lanes: Lanes,\n    laneKeys: LaneKeys,\n  ) {\n    this.readEnvironmentService = readEnvironment;\n    this.lanes = lanes;\n    this.laneKeys = laneKeys;\n  }\n\n  execute(): Effect.Effect<\n    ReadHealthResponse,\n    MissingEnvironmentIdentityError\n  > {\n    return Effect.gen({ self: this }, function* () {\n      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>\n        Effect.gen({ self: this }, function* () {\n          const { environmentId } = yield* this.readEnvironmentService.execute();\n          return { status: 'ok' as const, environmentId };\n        }),\n      );\n    });\n  }\n}\n",
    errors: 1,
  },
  {
    rule: 'no-inline-execute-types',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: `export class ListDirectoryService {
  async execute(
    input: ListDirectoryInput,
    signal?: AbortSignal,
  ): Promise<ListDirectoryResult> {
  }
}`,
    invalid: `export class ListDirectoryService {
  async execute(
    input: { worktreeId: string; path: string },
    signal?: AbortSignal,
  ): Promise<ListDirectoryResult> {
  }
}`,
    errors: 1,
  },
  {
    rule: 'interfaces-only-in-ports',
    path: 'apps/server/src/runtime/delay.ts',
    valid: `import type { ProbeDelay } from '../ports/probe-delay.ts'; export type DelayOptions = { delay: ProbeDelay };`,
    invalid: `
export interface ProbeDelay {
  readonly milliseconds: string;
}
`,
    errors: 1,
  },
  {
    rule: 'no-port-shaped-alias',
    path: 'apps/server/src/runtime/probe-handle.ts',
    valid: `import type { ProbeHandle } from '../ports/probe-handle.ts'; export type ProbeHandleResult = ProbeHandle;`,
    invalid: `export type ProbeHandle = { close(): Promise<void> };
`,
    errors: 1,
  },
  {
    rule: 'no-port-shaped-alias',
    path: 'packages/git/src/shared/dtos/probe-handle.ts',
    valid: `import type { ProbeHandle } from '../interfaces/probe-handle.ts'; export type ProbeHandleResult = ProbeHandle;`,
    invalid: `export type ProbeHandle = { close(): Promise<void> };
`,
    errors: 1,
  },
  {
    rule: 'naming',
    path: 'apps/server/src/adapters/runtime/probe-reader.ts',
    valid: `export class ProbeReader {}`,
    invalid: `export class probeReader {}`,
    errors: 1,
  },
  {
    rule: 'models-file-shape',
    path: 'packages/files/src/models/list-directory.ts',
    valid: `export type ListDirectoryInput = { path: string };`,
    invalid: `export interface ListDirectoryInput { path: string }`,
    errors: 1,
  },
  {
    rule: 'no-inline-execute-types',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: `export class ListDirectoryService { execute(input: ListDirectoryInput): Promise<ListDirectoryResult> {} }`,
    invalid: `export class ListDirectoryService { execute(input: ListDirectoryInput): Promise<{ entries: DirectoryEntry[] }> {} }`,
    errors: 1,
  },

  {
    rule: 'port-shape',
    path: 'apps/server/src/ports/notice-port.ts',
    valid: `export interface NoticeWriter { send(input: NoticeInput): void; }`,
    invalid: `export interface NoticePort { send(input: NoticeInput): void; }`,
    errors: 1,
  },
  {
    rule: 'interfaces-hold-interfaces',
    path: 'packages/git/src/inspection/interfaces/status-reader.ts',
    valid: `export interface StatusReader { read(input: WorktreeKey): Promise<WorktreeStatus>; }`,
    invalid: `export type StatusReader = { read(input: WorktreeKey): Promise<WorktreeStatus> };`,
    errors: 1,
  },

  {
    rule: 'spec-behaviour-names',
    path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
    valid:
      "it('records the revision the reader saw', () => { expect(seen.revision).toBe(2); });",
    invalid:
      "it('should record the revision the reader saw', () => { expect(seen.revision).toBe(2); });",
    errors: 1,
  },
  {
    rule: 'spec-behaviour-names',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "test('the review content appears after pairing', async ({ workspace }) => { await expect.element(workspace.getByRole('region', { name: 'Review content' })).toBeVisible(); });",
    invalid:
      "test('review appears', async ({ workspace }) => { await expect.element(workspace.getByRole('region', { name: 'Review content' })).toBeVisible(); });",
    errors: 1,
  },
  {
    rule: 'spec-behaviour-names',
    path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
    valid:
      "it('records the revision the reader saw', () => { expect(seen.revision).toBe(2); });",
    invalid:
      "it('records the revision the reader saw', () => { expect(true).toBe(true); });",
    errors: 1,
  },
  {
    rule: 'no-comments',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid:
      "import { Effect } from 'effect'; export const execute = Effect.fn('ListDirectoryService.execute')(function* () { return limit; });",
    invalid:
      "/** oxlint-disable */\nimport { Effect } from 'effect'; export const execute = Effect.fn('ListDirectoryService.execute')(function* () { return limit; });",
    errors: 1,
  },
  {
    rule: 'no-comments',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: 'export const options = { limit: entries + 1 };',
    invalid:
      'export const options = { /** eslint-disable-next-line */ limit: entries + 1 };',
    errors: 1,
  },
  {
    rule: 'no-comments',
    path: 'architecture/oxlint-plugin.mjs',
    valid: `const domainPackage = '(?:projects|changes|reviews|files|git-actions|access)';
`,
    invalid: `// the six domain packages
const domainPackage = '(?:projects|changes|reviews|files|git-actions|access)';
`,
    errors: 1,
  },
  {
    rule: 'no-comments',
    path: 'vitest.config.ts',
    valid: `export default defineConfig({
});`,
    invalid: `// one project per package
export default defineConfig({
});`,
    errors: 1,
  },
  {
    rule: 'no-comments',
    path: 'packages/projects/src/rules/probe-loose.ts',
    valid:
      'export function probeLoose(left: string, right: string): boolean { return left === right; }',
    invalid: `// compares loosely
export function probeLoose(left: string, right: string): boolean {
  return left == right;
}
`,
    errors: 1,
  },
  {
    rule: 'spec-behaviour-names',
    path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
    valid: observedStoreState,
    invalid: `describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });

  it('answers 404 to an unknown worktree', () => {
    const { service } = setup();
    expect(service.execute({ worktreeId: 'c'.repeat(64), throughRevision: 1 }).seenThrough).toBe(0);
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-behaviour-names',
    path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
    valid: observedStoreState,
    invalid: `describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });

  it('returns 404 for an unknown worktree', () => {
    const { service } = setup();
    expect(service.execute({ worktreeId: 'c'.repeat(64), throughRevision: 1 }).seenThrough).toBe(0);
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-behaviour-names',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "test('the review content appears after pairing', async ({ workspace }) => { await expect.element(workspace.getByRole('region', { name: 'Review content' })).toBeVisible(); });",
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('access.pairing: works', async ({ workspace }) => {
  await expect.element(workspace.getByRole('region', { name: 'Review content' })).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/contracts/src/shared/api-error.ts',
    valid: 'export const API_ERROR_STATUS = { content_changed: 409 };',
    invalid: 'export const retries = 409;',
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/contracts/src/files/failures.ts',
    valid:
      "export const contentChanged = httpFailure(ContentChangedError, 'Conflict', { code: 'content_changed' });",
    invalid: 'export const API_ERROR_STATUS = { content_changed: 409 };',
    errors: 1,
  },

  {
    rule: 'no-number-outside-limits',
    path: 'apps/server/src/adapters/access/http-tunnel-probe.ts',
    valid:
      'export const decodeHealth = Schema.decodeUnknownResult(readHealthResponseSchema);',
    invalid: 'export const schema = readHealthEndpoint.responses[200];',
    errors: 1,
  },

  {
    rule: 'spec-imports',
    path: 'packages/contracts/src/shared/http-api.spec.ts',
    valid: "import { Schema } from 'effect';",
    invalid:
      "import { readHealth } from '@porcelain/server/src/http/routes/access/read-health';",
    errors: 1,
  },

  {
    rule: 'root-scripts-import-no-package',
    path: 'scripts/api-calls.ts',
    valid: "import * as files from '@porcelain/contracts/files';",
    invalid: "import { filesApi } from '@porcelain/client/files/api';",
    errors: 1,
  },
  {
    rule: 'spec-imports',
    path: 'packages/client/src/shared/api/effect-client.spec.ts',
    valid: "import { FilesApi } from '@porcelain/contracts/files';",
    invalid:
      "import { ReadTextFileUseCase } from '@porcelain/server/src/use-cases/files/read-text-file';",
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/contracts/src/files/failures.ts',
    valid:
      "export const contentChanged = httpFailure(ContentChangedError, 'Conflict', { code: 'content_changed' });",
    invalid:
      'export const contentChanged = httpFailure(ContentChangedError, 409);',
    errors: 1,
  },

  {
    rule: 'spec-asserts',
    path: 'apps/server/src/http/status-policy.spec.ts',
    valid:
      "it('reads the observed server health', () => { expect(readHealth().status).toBe('ok'); });",
    invalid:
      "it('reads the observed server health', () => { expect(true).toBe(true); });",
    errors: 1,
  },
  {
    rule: 'spec-imports',
    path: 'packages/client/spec/integration/files.integration.ts',
    valid:
      "import { directoryQueryOptions } from '@porcelain/client/files'; import { test } from '@porcelain/server/kit/server-test';",
    invalid:
      "import { composeServer } from '@porcelain/server/src/bootstrap/compose-server';",
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'apps/mobile/src/shared/api/transport.ts',
    valid:
      "import { REQUEST_TIMEOUT_MS } from '../../config/limits'; export const timeout = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);",
    invalid: 'export const timeout = () => AbortSignal.timeout(15_000);',
    errors: 1,
  },
  {
    rule: 'client-platform-through-ports',
    path: 'packages/client/src/features/access/store.ts',
    valid: "import { AtomRef } from 'effect/reactivity';",
    invalid: "import { useAtomRef } from '@effect/atom-react';",
    errors: 1,
  },
  {
    rule: 'spec-imports',
    path: 'packages/client/src/features/access/commands/pairing.spec.ts',
    valid:
      "import { AtomRegistry } from 'effect/reactivity'; import { AccessStore } from '@porcelain/client/access'; import type { Remote } from '@porcelain/client/access/rules'; import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';",
    invalid:
      "import { SettingsScreen } from '../../../../../../apps/mobile/src/features/access/views/settings-screen.tsx';",
    errors: 1,
  },
  {
    rule: 'client-platform-through-ports',
    path: 'packages/client/src/features/access/queries/environments.ts',
    valid: "import type { QueryFunctionContext } from '@tanstack/query-core';",
    invalid: "import { useQuery } from '@tanstack/react-query';",
    errors: 1,
  },
  {
    rule: 'web-transport-owner',
    path: 'apps/mobile/src/shared/api/transport.ts',
    valid: 'export const send = (address: URL) => fetch(address);',
    invalid:
      'export const listen = (address: string) => new WebSocket(address);',
    errors: 1,
  },
  {
    rule: 'web-transport-owner',
    path: 'apps/mobile/src/features/access/views/settings-screen.tsx',
    valid: 'export const Settings = () => <Text>Environments</Text>;',
    invalid:
      'export const read = () => fetch("http://localhost/api/environment");',
    errors: 1,
  },
  {
    rule: 'client-platform-through-ports',
    path: 'packages/client/src/features/access/api.ts',
    valid:
      'export const name = (platform: { name(): string }) => platform.name();',
    invalid: 'export const name = navigator.userAgent;',
    errors: 1,
  },
  {
    rule: 'web-queries-export-reads',
    path: 'packages/client/src/features/access/queries/environments.ts',
    valid:
      "import { Effect } from 'effect'; export const readEnvironment = () => Effect.succeed([]);",
    invalid: 'export const defaultEnvironment = "local";',
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'packages/client/src/features/access/commands/pairing.ts',
    valid: "import { ConnectionError } from '@porcelain/client/transport';",
    invalid: "import { HttpApiClient } from 'effect/http-api';",
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/shell/tablet-split.ios.tsx',
    valid:
      "import { SplitView } from 'expo-router/unstable-split-view'; export const Tablet = () => <SplitView />;",
    invalid:
      "import { PhoneTabs } from './phone-tabs'; export const Detail = () => <PhoneTabs />;",
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/shell/tablet-split.ios.tsx',
    valid: "import type { NativeTabsProps } from 'expo-router/native-tabs';",
    invalid:
      "import { NativeTabs as Tabs } from 'expo-router/native-tabs'; export const Detail = () => <Tabs />;",
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/shell/phone-tabs.tsx',
    valid:
      "import { NativeTabs } from 'expo-router/native-tabs'; export const Phone = () => <NativeTabs />;",
    invalid: "export { Platform } from 'react-native';",
    errors: 1,
  },
  {
    rule: 'client-platform-through-ports',
    path: 'packages/client/src/shared/api/transport.ts',
    valid: 'export function address(value: string) { return new URL(value); }',
    invalid: "import { Text } from '@expo/ui';",
    errors: 1,
  },
  {
    rule: 'client-platform-through-ports',
    path: 'packages/client/src/shared/api/transport.ts',
    valid:
      'export function name(platform: { name: string }) { return platform.name; }',
    invalid: 'export const platform = navigator.userAgent;',
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/features/files/views/files-screen.tsx',
    valid:
      "import { Button } from '@expo/ui'; export const Action = () => <Button label='Open' />;",
    invalid:
      "import { Pressable as Button } from 'react-native'; export const Action = () => <Button />;",
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/shell/phone-tabs.tsx',
    valid:
      "import { View } from 'react-native'; export const Frame = () => <View />;",
    invalid:
      "import { Platform as System } from 'react-native'; export const kind = System.OS;",
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/features/files/views/files-screen.tsx',
    valid: "import {Text} from 'react-native'; export const Label = Text;",
    invalid: "export { TextInput as Field } from 'react-native';",
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/shared/menu.ios.tsx',
    valid: "export { Button } from '@expo/ui/swift-ui';",
    invalid:
      "import * as Native from 'react-native'; export const Button = Native.Pressable;",
    errors: 1,
  },
  {
    rule: 'mobile-native-ui',
    path: 'apps/mobile/src/features/files/views/files-screen.tsx',
    valid: "export { Button } from '@expo/ui';",
    invalid: "export { Button } from '@expo/ui/swift-ui';",
    errors: 1,
  },
  {
    rule: 'web-views-no-await',
    path: 'apps/mobile/src/features/access/views/settings-screen.tsx',
    valid: 'export const pair = (command: () => void) => command();',
    invalid:
      'export const pair = async (command: () => Promise<void>) => { await command(); };',
    errors: 1,
  },

  {
    rule: 'web-rules-are-pure',
    path: 'packages/client/src/features/access/rules/probe-rule.ts',
    valid:
      'export function readCode(fragment: string) { return new URLSearchParams(fragment).get("c"); }',
    invalid: 'export function readCode() { return window.location.hash; }',
    errors: 2,
  },
  {
    rule: 'web-rules-are-pure',
    path: 'packages/client/src/features/access/rules/index.ts',
    valid: 'export { parsePairingLink } from "./pairing-link.ts";',
    invalid: 'export { Platform } from "react-native";',
    errors: 1,
  },
  {
    rule: 'web-rules-are-pure',
    path: 'apps/web/src/features/access/rules/probe-rule.ts',
    valid:
      'import { parsePairingLink } from "@porcelain/client/access/rules"; import * as Schema from "effect/Schema"; import * as Redacted from "effect/Redacted"; export const readCode = parsePairingLink; export const secret = Redacted.make("secret"); export const shape = Schema.String;',
    invalid:
      'import { Button } from "@porcelain/client/access/views"; export const button = Button;',
    errors: 1,
  },
  {
    rule: 'adapters-never-import-services',
    path: 'apps/server/src/adapters/files/checked-worktree-access-reader.ts',
    valid:
      "import type { WorktreeAccessReader } from '@porcelain/kernel/ports'; export class CheckedWorktreeAccessReader implements WorktreeAccessReader { constructor(private readonly reader: WorktreeAccessReader) {} known(input: WorktreeKey, signal?: AbortSignal) { return this.reader.known(input, signal); } }",
    invalid: `import type { WorktreeCheck } from '@porcelain/kernel/models';
import type { WorktreeAccessReader } from '@porcelain/kernel/ports';
import type { CheckWorktreeService } from '@porcelain/projects/services';

export class CheckedWorktreeAccessReader implements WorktreeAccessReader {
  private readonly checkWorktree: CheckWorktreeService;

  constructor(checkWorktree: CheckWorktreeService) {
    this.checkWorktree = checkWorktree;
  }

  async known(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId },
      signal,
    );
    return { kind: 'found', worktree };
  }

  async forWriting(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<WorktreeCheck> {
    const worktree = await this.checkWorktree.execute(
      { worktreeId: input.worktreeId, purpose: 'writing' },
      signal,
    );
    return { kind: 'found', worktree };
  }
}
`,
    errors: 1,
  },
  {
    rule: 'adapters-report-facts',
    path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
    valid: filesystemDirectoryReader,
    invalid: filesystemDirectoryReader.replace(
      `        if (found.length === input.limit) {
`,
      `        if (name.toLowerCase() === '.git') continue;
        if (found.length === input.limit) {
`,
    ),
    errors: 1,
  },
  {
    rule: 'adapters-report-facts',
    path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
    valid: `import { readdir } from 'node:fs/promises';

export async function entryNames(path: string): Promise<string[]> {
  const names: string[] = [];
  for (const name of await readdir(path)) names.push(name);
  return names;
}
`,
    invalid: `import { readdir } from 'node:fs/promises';

const HIDDEN = '.git' as const;

export async function entryNames(path: string): Promise<string[]> {
  const names: string[] = [];
  for (const name of await readdir(path)) {
    if (name === HIDDEN) continue;
    names.push(name);
  }
  return names;
}
`,
    errors: 1,
  },
  {
    rule: 'adapters-report-facts',
    path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
    valid: filesystemDirectoryReader,
    invalid: filesystemDirectoryReader.replace(
      `        if (found.length === input.limit) {
`,
      `        if (['.git'].includes(name)) continue;
        if (found.length === input.limit) {
`,
    ),
    errors: 1,
  },
  {
    rule: 'adapters-report-facts',
    path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
    valid: 'lstat(join(full, options.gitDirectoryName));',
    invalid: `lstat(join(full, '.git'))`,
    errors: 1,
  },
  {
    rule: 'bootstrap-constructs-only',
    path: 'apps/server/src/bootstrap/main.ts',
    valid: 'export const application = composeApplication();',
    invalid: `
if (import.meta.main) await runCli();
`,
    errors: 1,
  },
  {
    rule: 'bootstrap-starts-nothing',
    path: 'apps/server/src/bootstrap/compose-server.ts',
    valid: `const openServer: OpenServer = async (input) => {
  const useCases = { access, projects, files, changes, reviews, gitActions };
};`,
    invalid: `const openServer: OpenServer = async (input) => {
  for (const job of jobs) job.start();
  const useCases = { access, projects, files, changes, reviews, gitActions };
};`,
    errors: 1,
  },
  {
    rule: 'bootstrap-starts-nothing',
    path: 'apps/server/src/bootstrap/compose-server.ts',
    valid: runtimeJobs,
    invalid: `const openServer: OpenServer = async (input) => {
  const jobs: readonly Job[] = [
    new IntervalJob(
      { atStart: true, everyMs: limits.jobs.refreshInventoryMs ?? 60_000 },
    ),
  ];
};`,
    errors: 1,
  },
  {
    rule: 'bootstrap-starts-nothing',
    path: 'apps/server/src/bootstrap/compose-server.ts',
    valid: `import type { OpenServer } from '../runtime/start-application.ts';

export const openServer: OpenServer = async (input) => {
  const { settings } = input;
  const { limits } = settings;
  return {
    limits,
    debug: settings.debug,
  };
};
`,
    invalid: `import type { OpenServer } from '../runtime/start-application.ts';

export const openServer: OpenServer = async (input) => {
  const { settings } = input;
  const { limits } = settings;
  const { env } = process;
  return {
    limits,
    debug: env.PORCELAIN_DEBUG === '1',
  };
};
`,
    errors: 1,
  },
  {
    rule: 'bootstrap-starts-nothing',
    path: 'apps/server/src/bootstrap/compose-server.ts',
    valid: runtimeUseCases,
    invalid: `const openServer: OpenServer = async (input) => {
  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,
    debug: globalThis.process.env.PORCELAIN_DEBUG === '1',
  };
};`,
    errors: 1,
  },
  {
    rule: 'bootstrap-starts-nothing',
    path: 'apps/server/src/bootstrap/compose-server.ts',
    valid: runtimeJobs,
    invalid: `const openServer: OpenServer = async (input) => {
  const jobs: readonly Job[] = [
    new IntervalJob(
      { atStart: true, everyMs: limits.jobs.refreshInventoryMs || 60_000 },
    ),
  ];
};`,
    errors: 1,
  },
  {
    rule: 'bootstrap-starts-nothing',
    path: 'apps/server/src/bootstrap/compose-server.ts',
    valid: runtimeUseCases,
    invalid: `const openServer: OpenServer = async (input) => {
  const useCases = { access, projects, files, changes, reviews, gitActions };
  return {
    jobs,
    debug: process.env.PORCELAIN_DEBUG === '1',
  };
};`,
    errors: 1,
  },
  {
    rule: 'cross-domain-through-use-cases',
    path: 'packages/reviews/src/ports/review-status-reader.ts',
    valid:
      "import type { ReviewEvidence } from '../models/review-evidence.ts'; export interface ReviewStatusReader { read(input: ReviewKey, signal?: AbortSignal): Promise<ReviewEvidence>; }",
    invalid: `import type { WorktreeKey } from '@porcelain/kernel/models';
import type { ReviewEvidence } from '../models/review-evidence.ts';

export interface ReviewStatusReader {
  execute(input: WorktreeKey, signal?: AbortSignal): Promise<ReviewEvidence>;
}
`,
    errors: 1,
  },

  {
    rule: 'events-from-use-cases',
    path: 'apps/server/src/runtime/live-updates/watch-worktrees.ts',
    valid: fixtureWatchWorktreesEventsFromUseCases,
    invalid:
      fixtureWatchWorktreesEventsFromUseCases +
      `\nimport { EventPublisher } from '../../ports/event-publisher.ts';
export const direct = Effect.flatMap(EventPublisher, (events) => events.worktreeChanged({ worktreeId: 'one', change: 'git' }));`,
    errors: 1,
  },
  ...[
    `export const direct = Effect.flatMap(Publisher, (events) => events.inventoryChanged());`,
    `const alias = Publisher; export const second = NativeLayer.effect(alias, Effect.succeed({}));`,
    `import * as Events from '../../ports/event-publisher.ts'; export const direct = Effect.flatMap(Events.EventPublisher, (events) => events.inventoryChanged());`,
  ].map((invalid) => ({
    rule: 'events-from-use-cases',
    path: 'apps/server/src/adapters/events/web-socket-event-publisher.ts',
    valid: fixtureNativeEventPublisherLayer,
    invalid: fixtureNativeEventPublisherLayer + invalid,
    errors: 1,
  })),
  {
    rule: 'failure-in-service',
    path: 'packages/files/src/errors/probe-failure-error.ts',
    valid: 'export class PathNotFoundError extends Error {}',
    invalid: `import { PathNotFoundError } from './path-not-found-error.ts';

export function probeFailureError(failure: 'missing'): Error {
  return failure === 'missing' ? new PathNotFoundError() : new PathNotFoundError();
}
`,
    errors: 1,
  },
  {
    rule: 'failure-in-service',
    path: 'packages/changes/src/services/read-change-lines-service.ts',
    valid: `export class ReadChangeLinesService {
  private failure(problem: LineRangeProblem): Error {
  }
}`,
    invalid: `export class ReadChangeLinesService {
  failure(problem: LineRangeProblem): Error {
  }
}`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid:
      'export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) { this.seen.set(input.worktreeId, input.seenThrough); } }',
    invalid:
      'export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) {     if ((this.seen.get(input.worktreeId) ?? 0) > input.seenThrough) return;\n    this.seen.set(input.worktreeId, input.seenThrough); } }',
    errors: 1,
  },
  ...[
    {
      invalid: commentSeenStore
        .replace(
          `    this.seen.set(input.worktreeId, input.seenThrough);
`,
          `    this.saves.push(input);
    this.seen.set(input.worktreeId, input.seenThrough);
`,
        )
        .replace(
          `  private readonly seen = new Map<string, number>();

`,
          `  private readonly seen = new Map<string, number>();
  readonly saves: { worktreeId: string; seenThrough: number }[] = [];

`,
        ),
      errors: 1,
    },
    {
      invalid: commentSeenStore
        .replace(
          `    this.seen.set(input.worktreeId, input.seenThrough);
`,
          `    this.saves = [...this.saves, input];
    this.seen.set(input.worktreeId, input.seenThrough);
`,
        )
        .replace(
          `  private readonly seen = new Map<string, number>();

`,
          `  private readonly seen = new Map<string, number>();
  saves: { worktreeId: string; seenThrough: number }[] = [];

`,
        ),
      errors: 2,
    },
    {
      invalid: commentSeenStore.replace(
        `    this.seen.set(input.worktreeId, input.seenThrough);
`,
        `    const stored = this.seen.get(input.worktreeId);
    (stored === undefined || stored < input.seenThrough) &&
      this.seen.set(input.worktreeId, input.seenThrough);
`,
      ),
      errors: 1,
    },
    {
      invalid: commentSeenStore
        .replace(
          `    this.seen.set(input.worktreeId, input.seenThrough);
`,
          `    this.#count++;
    this.#calls.set(\`save:\${this.#count}\`, input.seenThrough);
    const stored = this.seen.get(input.worktreeId);
    stored === undefined && this.seen.set(input.worktreeId, input.seenThrough);
    stored ?? this.seen.set(input.worktreeId, input.seenThrough);
    [stored ?? 0]
      .filter((known) => known < input.seenThrough)
      .forEach(() => this.seen.set(input.worktreeId, input.seenThrough));
`,
        )
        .replace(
          `  private readonly seen = new Map<string, number>();

`,
          `  private readonly seen = new Map<string, number>();
  #count = 0;
  readonly #calls = new Map<string, number>();

  calls(): number {
    return this.#count + this.#calls.size;
  }

`,
        ),
      errors: 5,
    },
    {
      invalid: commentSeenStore.replace(
        `    this.seen.set(input.worktreeId, input.seenThrough);
`,
        `    [this.seen.get(input.worktreeId) ?? 0]
      .filter((stored) => stored < input.seenThrough)
      .forEach(() => this.seen.set(input.worktreeId, input.seenThrough));
`,
      ),
      errors: 1,
    },
    {
      invalid: commentSeenStore
        .replace(
          `    this.seen.set(input.worktreeId, input.seenThrough);
`,
          `    this.counter.calls = input.seenThrough;
    this.seen.set(input.worktreeId, input.seenThrough);
`,
        )
        .replace(
          `  private readonly seen = new Map<string, number>();

`,
          `  private readonly seen = new Map<string, number>();
  private readonly counter = { calls: 0 };

`,
        ),
      errors: 1,
    },
    {
      invalid: commentSeenStore.replace(
        `    this.seen.set(input.worktreeId, input.seenThrough);
`,
        `    this.seen.get(input.worktreeId) ??
      this.seen.set(input.worktreeId, input.seenThrough);
`,
      ),
      errors: 1,
    },
    {
      invalid: commentSeenStore
        .replace(
          `    this.seen.set(input.worktreeId, input.seenThrough);
`,
          `    this.#calls.set(\`save:\${this.seen.size}\`, input.seenThrough);
    this.seen.set(input.worktreeId, input.seenThrough);
`,
        )
        .replace(
          `  private readonly seen = new Map<string, number>();

`,
          `  private readonly seen = new Map<string, number>();
  readonly #calls = new Map<string, number>();

  calls(): number {
    return this.#calls.size;
  }

`,
        ),
      errors: 1,
    },
    {
      invalid: commentSeenStore
        .replace(
          `    this.seen.set(input.worktreeId, input.seenThrough);
`,
          `    this.#count++;
    this.seen.set(input.worktreeId, input.seenThrough);
`,
        )
        .replace(
          `  private readonly seen = new Map<string, number>();

`,
          `  private readonly seen = new Map<string, number>();
  #count = 0;

  calls(): number {
    return this.#count;
  }

`,
        ),
      errors: 1,
    },
  ].map(({ invalid, errors }) => ({
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid,
    errors,
  })),
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid:
      'export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) { this.seen.set(input.worktreeId, input.seenThrough); } }',
    invalid:
      'export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) {     const current = this.seen.get(input.worktreeId) ?? 0;\n    this.seen.set(\n      input.worktreeId,\n      current > input.seenThrough ? current : input.seenThrough,\n    ); } }',
    errors: 1,
  },

  {
    rule: 'fixture-imports',
    path: 'packages/git/spec/fixtures/capture.ts',
    valid:
      "import {execFileSync} from 'node:child_process'; import {writeFileSync} from 'node:fs'; writeFileSync('status.txt', execFileSync('git', ['status']));",
    invalid: `import { parseGitStatus } from '../../src/inspection/parsers/parse-git-status.ts';

parseGitStatus(Buffer.from(''));
`,
    errors: 1,
  },
  {
    rule: 'fixture-imports',
    path: 'packages/git/spec/fixtures/fixture.ts',
    valid:
      "import {readFileSync} from 'node:fs'; export function fixture(name: string) { return readFileSync(new URL(name, import.meta.url)); }",
    invalid: `import { readFileSync } from 'node:fs';
import { isMissing } from '../../src/shared/errors/is-missing.ts';

export function fixtureMissing(error: unknown): boolean {
  return isMissing(error);
}`,
    errors: 1,
  },
  {
    rule: 'fixture-imports',
    path: 'packages/git/spec/fixtures/fixture.ts',
    valid:
      "import {readFileSync} from 'node:fs'; export function fixture(name: string) { return readFileSync(new URL(name, import.meta.url)); }",
    invalid:
      "import { readFileSync } from 'node:fs';\nimport { z } from 'zod';\n  export async function fixture(input: Input, environmentId: string) { return readFileSync(new URL(z.string().parse(name), import.meta.url)); }",
    errors: 1,
  },
  {
    rule: 'fixture-imports',
    path: 'packages/git/spec/fixtures/fixture.ts',
    valid:
      "import type {WorktreeKey} from '@porcelain/kernel/models'; export type CapturedWorktree = WorktreeKey;",
    invalid: `import type { CommandOutput } from '@porcelain/process';
import { readFileSync } from 'node:fs';

export type CapturedOutput = CommandOutput;`,
    errors: 1,
  },
  {
    rule: 'fixture-imports',
    path: 'packages/changes/spec/fixtures/comparisons.ts',
    valid:
      "import type {ReviewComparison} from '../../src/models/review-comparison.ts'; export type CapturedComparison = ReviewComparison;",
    invalid: `import { isRelativePath } from '@porcelain/kernel/rules';
export const probeRule = isRelativePath;
`,
    errors: 1,
  },

  {
    rule: 'imports-by-path',
    path: 'packages/kernel/src/rules/index.ts',
    valid: "export {utf8ByteLength} from './utf8-byte-length.ts';",
    invalid: `import { utf8ByteLength } from './utf8-byte-length.ts';
export { utf8ByteLength };`,
    errors: 2,
  },
  {
    rule: 'imports-by-path',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: "import type {DirectoryEntry} from '../models/directory-entry.ts';",
    invalid: `import type { DirectoryEntry } from '@porcelain/files/models';`,
    errors: 1,
  },
  {
    rule: 'imports-by-path',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: "import type {DirectoryEntry} from '../models/directory-entry.ts';",
    invalid: `import type { DirectoryEntry } from '../models/index.ts';`,
    errors: 1,
  },
  {
    rule: 'interfaces-hold-interfaces',
    path: 'packages/git/src/inspection/interfaces/status-reader.ts',
    valid: `export interface StatusReader { read(input: WorktreeKey): Promise<WorktreeStatus>; }`,
    invalid: 'export function readStatus(): number { return 0; }',
    errors: 1,
  },

  {
    rule: 'lane-after-check',
    path: 'apps/server/src/use-cases/files/list-directory.ts',
    valid: `export class ListDirectoryUseCase {
  async execute(
  ): Promise<ListDirectoryResponse> {
    const worktree = await this.checkWorktree.execute(
    );
  }
}`,
    invalid: `export class ListDirectoryUseCase {
  async execute(
  ): Promise<ListDirectoryResponse> {
    const early = this.laneKeys.filesystem();
    const worktree = await this.checkWorktree.execute(
    );
  }
}`,
    errors: 1,
  },
  {
    rule: 'lane-only-with-store',
    path: 'apps/server/src/use-cases/access/clear-browser-session.ts',
    valid: `export class ClearBrowserSessionUseCase {
  constructor(lanes: Lanes) {
    return this.lanes.unqueued(
      async (): Promise<ClearBrowserSessionResponse> => undefined,
    );
  }
}`,
    invalid: `export class ClearBrowserSessionUseCase {
  constructor(lanes: Lanes) {
    return this.lanes.run(
      'access',
      'read',
      async (): Promise<ClearBrowserSessionResponse> => undefined,
    );
  }
}`,
    errors: 1,
  },
  {
    rule: 'limits-from-settings',
    path: 'apps/server/src/http/routes/files/files-api.ts',
    valid: `import type { Limits } from '../../../config/limits.ts';
export function filesRoutes(limits: Limits['http']) {
  return requestBodyLimit(FilesApi.groups.files.endpoints.editFile, limits.editFileBodyBytes);
}`,
    invalid: `import { LIMITS } from '../../../config/limits.ts';
export function filesRoutes() {
  return requestBodyLimit(FilesApi.groups.files.endpoints.editFile, LIMITS.http.editFileBodyBytes);
}`,
    errors: 1,
  },
  {
    rule: 'mcp-tool-handler',
    path: 'apps/server/src/http/mcp/review-server.ts',
    valid: `import { ReviewToolkit } from '@porcelain/contracts/reviews';
export function reviewMcpHandlers() { return ReviewToolkit.toLayer({ read_review: (input) => useCases.reviews.readPublishedReviewAtPath.execute(input) }); }`,
    invalid: `import { ReviewToolkit } from '@porcelain/contracts/reviews';
export function reviewMcpHandlers() { return ReviewToolkit.toLayer({ read_review: (input) => useCases.reviews.readPublishedReviewAtPath.run(input) }); }`,
    errors: 2,
  },
  {
    rule: 'models-are-types',
    path: 'packages/projects/src/models/probe/probe-model.ts',
    valid:
      "import type {ProjectKey} from '../project.ts'; export type ProbeResult = ProjectKey | undefined;",
    invalid: `import type { ProjectKey } from '../project.ts'; export type ProbeResult = ProjectKey | undefined; export function probeKey(projectId: string): ProjectKey { return { projectId }; }`,
    errors: 1,
  },

  {
    rule: 'models-are-types',
    path: 'packages/projects/src/models/probe/probe-model.ts',
    valid: `import { Schema, Struct } from 'effect';
const keySchema = Schema.Struct({ projectId: Schema.mutableKey(Schema.String) });
export const projectSchema = Schema.Struct({ ...Struct.omit(keySchema.fields, []), name: Schema.String });
export const secretSchema = Schema.Struct({ token: Schema.Redacted(Schema.String), failure: Schema.Cause(Schema.Never, Schema.Defect()) });
export type Project = typeof projectSchema.Type;`,
    invalid: `import { Effect, Schema } from 'effect';
export const projectSchema = Schema.Struct({ projectId: Schema.String });
export const readSchema = Effect.succeed('project');`,
    errors: 2,
  },
  {
    rule: 'models-are-types',
    path: 'packages/projects/src/models/probe/probe-model.ts',
    valid: `import { Schema } from 'effect'; export const projectSchema = Schema.Struct({ name: Schema.String });`,
    invalid: `import { Schema } from 'effect'; const resultSchema = process.read(); export const projectSchema = Schema.Struct({ name: resultSchema });`,
    errors: 2,
  },
  {
    rule: 'no-blocking-child-process',
    path: 'apps/server/src/adapters/access/mac-network-command.ts',
    valid:
      "import {runCommand} from '@porcelain/process'; export function readRoute() { return runCommand({executable: '/sbin/route', args: ['-n', 'get', 'default']}); }",
    invalid: `import * as childProcess from 'child_process';
import { execSync as run, spawnSync } from 'node:child_process';

export function readRoute(): string {
  run('/sbin/route -n get default');
  spawnSync('/usr/sbin/scutil', []);
  return childProcess.execFileSync('/sbin/route', ['-n', 'get', 'default'], {
    encoding: 'utf8',
  });
}
`,
    errors: 3,
  },

  {
    rule: 'no-exported-constants',
    path: 'packages/reviews/src/rules/comment-threads.ts',
    valid:
      'export function threadCapacityLeft(threads: number, limit: number) { return Math.max(0, limit - threads); }',
    invalid: `
export const THREADS_PER_WORKTREE = 100;
`,
    errors: 1,
  },
  {
    rule: 'no-exported-constants',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: `export class ListDirectoryService {
}`,
    invalid: `export const LIST_DIRECTORY_KIND = 'directory';

export class ListDirectoryService {
}`,
    errors: 1,
  },

  {
    rule: 'no-loose-equality-in-domain',
    path: 'packages/access/src/services/issue-pairing-service.ts',
    valid: 'if (value === undefined) throw new InvalidDeviceDetailsError();',
    invalid: `    if (value == null) throw new InvalidDeviceDetailsError();`,
    errors: 1,
  },
  {
    rule: 'no-node-globals',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid:
      'if (listing.entries.length > options.maxEntries) throw new DirectoryTooLargeError();',
    invalid: `    if (Buffer.byteLength(JSON.stringify(listing)) > this.options.maxResponseBytes)
import { withoutGitDirectory } from '@porcelain/kernel/rules';`,
    errors: 1,
  },
  {
    rule: 'no-node-globals',
    path: 'packages/access/src/rules/credential.ts',
    valid:
      'export function credential(id: string, secret: string, encoded: string) { return {id, secret, token: `${id}_${encoded}`}; }',
    invalid:
      "export async function fixture(input: Input, environmentId: string) {   const encoded = Buffer.from(secret).toString('base64url');\n  return { id, secret, token: `${kind}_${id}_${encoded}` }; }",
    errors: 1,
  },
  {
    rule: 'no-node-globals',
    path: 'packages/projects/src/rules/probe-stamp.ts',
    valid:
      'export function probeStamp(instant: string, id: string) { return {instant, id}; }',
    invalid: `export function probeStamp(): string {
  console.log(performance.now());
  return crypto.randomUUID();
}
`,
    errors: 3,
  },
  {
    rule: 'no-node-globals',
    path: 'apps/server/src/use-cases/projects/probe-env.ts',
    valid:
      "import { Effect } from 'effect'; export class ProbeEnvUseCase { constructor(private readonly reader: EnvironmentReader) {} execute(): Effect.Effect<string, EnvironmentUnavailableError> { return this.reader.read(); } }",
    invalid:
      "import { Effect } from 'effect';\nexport class ProbeEnvUseCase {\n  execute(): Effect.Effect<string> {\n    const fs = process.getBuiltinModule('node:fs');\n    return fs.readFileSync(`${process.env.HOME ?? ''}/.gitconfig`, 'utf8');\n  }\n}\n",
    errors: 2,
  },
  {
    rule: 'no-null-in-domain',
    path: 'packages/files/src/rules/encode-base64.ts',
    valid:
      "export function encode(binary: string) { return binary === '' ? '' : btoa(binary); }",
    invalid:
      'export async function fixture(input: Input, environmentId: string) {   return binary === "" ? String(null) : btoa(binary); }',
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/agents/src/commit-planning/claude-provider.ts',
    valid: `export const answer = Effect.fn('ClaudeProvider.answer')(function* () {
  return yield* runProvider({ maxBytes: limits.claudeOutputBytes });
});`,
    invalid: `export const answer = Effect.fn('ClaudeProvider.answer')(function* () {
  return yield* runProvider({ maxBytes: 1024 * 1024 });
});`,
    errors: 3,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/contracts/src/projects/inventory.ts',
    valid: `export const browseProjectFoldersQuerySchema = z.strictObject({
  name: z
    .max(PROJECT_NAME_LENGTH)
});`,
    invalid: `export const browseProjectFoldersQuerySchema = z.strictObject({
  name: z
    .max(100)
});`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/git/src/inspection/commands/read-status.ts',
    valid: `export async function readStatus(
): Promise<GitStatusObservation> {
  const output = await runInspection(
    { maxBytes: limits.inspection.statusBytes, config },
  );
}`,
    invalid: `export async function readStatus(
): Promise<GitStatusObservation> {
  const output = await runInspection(
    { maxBytes: 8 * 1024 * 1024, config },
  );
}`,
    errors: 4,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'apps/server/src/installer/service-health.ts',
    valid: 'attempt < settings.maxAttempts;',
    invalid: `attempt < 60;`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'apps/server/src/http/routes/files/edit-file.ts',
    valid: `export function editFile(
) {
  api.post(
    {
      bodyLimit: options.limits.editFileBodyBytes,
    },
  );
}`,
    invalid: `export function editFile(
) {
  api.post(
    {
      bodyLimit: 2048,
    },
  );
}`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: `export class ListDirectoryService {
  async execute(
  ): Promise<ListDirectoryResult> {
    const read = await this.directoryReader.list(
      {
        limit: this.options.maxEntries + 1,
      },
    );
  }
}`,
    invalid: `export class ListDirectoryService {
  async execute(
  ): Promise<ListDirectoryResult> {
    const read = await this.directoryReader.list(
      {
        limit: Math.min(this.options.maxEntries, 2000) + 1,
      },
    );
  }
}`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'apps/server/src/use-cases/changes/read-changes.ts',
    valid: `export class ReadChangesUseCase {
  async execute(
  ): Promise<ReadChangesResponse> {
    const worktree = await this.checkWorktree.execute(
      async ({ signal }) => {
        return {
          changes,
          ...(interrupted.kind === 'interrupted' && {
          }),
        };
      },
    );
  }
}`,
    invalid: `export class ReadChangesUseCase {
  async execute(
  ): Promise<ReadChangesResponse> {
    const worktree = await this.checkWorktree.execute(
      async ({ signal }) => {
        return {
          changes: changes.slice(0, 2000),
          ...(interrupted.kind === 'interrupted' && {
          }),
        };
      },
    );
  }
}`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/reviews/src/rules/comment-threads.ts',
    valid:
      'export function threadCapacityLeft(threads: number, maxThreads: number): number { return Math.max(0, maxThreads - threads); }',
    invalid: `
const MAX_THREADS = 100;

export function threadCapacityLeft(threads: number): number {
  return Math.max(0, MAX_THREADS - threads);
}
`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/reviews/src/rules/comment-threads.ts',
    valid:
      'export function threadCapacityLeft(threads: number, maxThreads: number): number { return Math.max(0, maxThreads - threads); }',
    invalid: `
const MAX_THREADS = Number('100');

export function threadCapacityLeft(threads: number): number {
  return Math.max(0, MAX_THREADS - threads);
}
`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'apps/web/src/features/access/commands/probe-command.ts',
    valid:
      'export const probeDelay = (limits: {delayMs: number}) => limits.delayMs;',
    invalid: `export const probeDelay = 250;
`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
    valid: filesystemDirectoryReader,
    invalid: filesystemDirectoryReader.replace(
      `        if (found.length === input.limit) {
`,
      `        if (found.length >= 2000) {
`,
    ),
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/projects/src/errors/probe-limit.ts',
    valid:
      "export class PageLimitError extends Error { constructor(readonly pageSize: number) { super('Page limit exceeded'); } }",
    invalid: `export const PAGE_SIZE = 50;
`,
    errors: 1,
  },
  {
    rule: 'no-number-outside-limits',
    path: 'packages/projects/src/services/probe-page-size-service.ts',
    valid:
      'export class ProbePageSizeService { constructor(private readonly options: {pageSize: number}) {} execute(): number { return this.options.pageSize; } }',
    invalid: `export class ProbePageSizeService {
  execute(): number {
    return [0, 0, 0, 0, 0].length * (1 + 1);
  }
}
`,
    errors: 1,
  },

  {
    rule: 'no-schema-parse-in-typed-code',
    path: 'packages/files/src/rules/encode-base64.ts',
    valid:
      'export function byteLength(value: Uint8Array) { return value.byteLength; }',
    invalid: `import { decodeUnknownSync as parse } from 'effect/Schema';
const { decodeUnknownResult: parseResult } = Schema;
export function probeParser(value: object): unknown { return Reflect.get(value, "decodeUnknownSync"); }
`,
    errors: 3,
  },
  {
    rule: 'no-schema-parse-in-typed-code',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid:
      "export const execute = Effect.fn('ListDirectoryService.execute')(function* (input: ListDirectoryInput) { return input.path; });",
    invalid:
      "export const execute = Effect.fn('ListDirectoryService.execute')(function* (input: ListDirectoryInput) { Schema.decodeUnknownSync(Schema.String)(input.path); return input.path; });",
    errors: 1,
  },
  {
    rule: 'no-undefined-union-result',
    path: 'packages/git-actions/src/services/read-interrupted-git-action-service.ts',
    valid:
      "export class ReadInterruptedGitActionService { execute(input: ReadInterruptedGitActionInput): ReadInterruptedGitActionResult { return { kind: 'none' }; } }",
    invalid:
      'export class ReadInterruptedGitActionService { execute(input: ReadInterruptedGitActionInput): GitActionReceiptView | undefined { return undefined; } }',
    errors: 1,
  },
  {
    rule: 'no-void-statement',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid:
      "export const execute = Effect.fn('ListDirectoryService.execute')(function* () { return yield* reader.list(); });",
    invalid:
      "export const execute = Effect.fn('ListDirectoryService.execute')(function* (signal: AbortSignal) { void signal; return yield* reader.list(); });",
    errors: 1,
  },
  {
    rule: 'one-clock',
    path: 'packages/git-actions/src/services/accept-git-action-service.ts',
    valid: 'export const acceptedAt = clock.now();',
    invalid:
      'export const acceptedAt = new Date(Date.parse(clock.now())).toISOString();',
    errors: 2,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: nativeHealthOperation,
    invalid:
      "export async function fixture(input: Input, environmentId: string) {         return new HealthReply(\n          this.readEnvironment.execute().environmentId,\n        ).body();\n\nclass HealthReply {\n  private readonly environmentId: string;\n\n  constructor(environmentId: string) {\n    this.environmentId = environmentId;\n  }\n\n  body(): ReadHealthResponse {\n    return { status: 'ok', environmentId: this.environmentId };\n  }\n}\n }",
    errors: 3,
  },

  {
    rule: 'port-shape',
    path: 'apps/server/src/ports/edit-announcement-writer.ts',
    valid:
      'export interface ContextualEditWriter { announce(input: EditAnnouncement, signal?: AbortSignal): void; }',
    invalid: `
export interface ContextualEditWriter {
  announce(input: EditAnnouncement, context: EditAnnouncement): void;
}
`,
    errors: 1,
  },
  {
    rule: 'port-shape',
    path: 'apps/server/src/ports/check-worktree-use-case-port.ts',
    valid: `export interface CheckWorktreeUseCasePort {
  execute(
    input: CheckWorktreeInput,
  ): Effect.Effect<ListedWorktree, WorktreeAccessFailure>;
}`,
    invalid: `export interface CheckWorktreeUseCasePort {
  execute(
    input: CheckWorktreeInput,
  ): Effect.Effect<ListedWorktree, WorktreeAccessFailure>;
  refresh(input: CheckWorktreeInput): Effect.Effect<void>;
}`,
    errors: 1,
  },
  {
    rule: 'port-shape',
    path: 'apps/server/src/ports/notice-port.ts',
    valid: 'export interface NoticeWriter { send(input: NoticeInput): void; }',
    invalid: `export interface Clock {
  send(worktreeId: string, kind: string, revision: number): void;
}
`,
    errors: 3,
  },
  {
    rule: 'port-shape',
    path: 'packages/reviews/src/ports/summary-port.ts',
    valid:
      'export interface SummaryReader { read(input: SummaryInput): Summary | undefined; }',
    invalid: `export interface SummaryPort {
  read(input: { token: string }): string | undefined;
}
`,
    errors: 2,
  },
  {
    rule: 'port-shape',
    path: 'packages/reviews/src/ports/review-store.ts',
    valid: `export interface ReviewStore {
  setActive(input: ReviewActivity): void;
}`,
    invalid: `export interface ReviewStore {
  setActive(worktreeId: string, revision: number, active: boolean): void;
}`,
    errors: 2,
  },
  {
    rule: 'port-shape',
    path: 'apps/server/src/ports/event-publisher.ts',
    valid: `export interface EventPublisher {
  inventoryChanged(): void;
}`,
    invalid: `export interface EventPublisher {
  inventoryChanged(): void;
  reviewChanged?(worktreeId: string, revision: number): void;
}`,
    errors: 2,
  },
  {
    rule: 'port-shape',
    path: 'packages/reviews/src/ports/worktree-change-reader.ts',
    valid:
      "import type {ReadWorktreeStatusResult} from '@porcelain/changes/models'; export interface WorktreeChangeReader { read(input: WorktreeKey, signal?: AbortSignal): Promise<ReadWorktreeStatusResult>; }",
    invalid: `import type { ReadWorktreeStatusResult } from '@porcelain/changes/models';

export interface WorktreeChangeReader {
  read(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<ReadWorktreeStatusResult>;
}
`,
    errors: 1,
  },
  {
    rule: 'port-shape',
    path: 'packages/reviews/src/ports/worktree-change-reader.ts',
    valid:
      'export interface WorktreeChangeReader { read(input: WorktreeKey, signal?: AbortSignal): Promise<WorktreeStatus>; }',
    invalid: `export interface WorktreeChangeReader {
  read(
    input: { worktreeId: string },
    signal?: AbortSignal,
  ): Promise<{ statusToken: string; changes: { path: string; fingerprint: string }[] }>;
}
`,
    errors: 2,
  },
  {
    rule: 'root-scripts-import-no-package',
    path: 'scripts/probe-reach.ts',
    valid:
      "import {readFileSync} from 'node:fs'; process.stdout.write(readFileSync('package.json', 'utf8'));",
    invalid: `import { deriveProjectName } from '../packages/projects/src/rules/derive-project-name.ts';

process.stdout.write(\`\${deriveProjectName(undefined, '/tmp/probe')}\\n\`);
`,
    errors: 1,
  },
  {
    rule: 'root-scripts-import-no-package',
    path: 'scripts/probe-reach.ts',
    valid:
      "import { Schema } from 'effect'; process.stdout.write(Schema.decodeUnknownSync(Schema.String)('value'));",
    invalid: `import { redeemPairingResponseSchema } from '@porcelain/contracts/access';

process.stdout.write(\`\${JSON.stringify(redeemPairingResponseSchema.parse({}))}\\n\`);
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/reviews/src/rules/review-digests.ts',
    valid:
      'export function summaryAgeMs(createdAt: string, now: string): number { return Date.parse(now) - Date.parse(createdAt); }',
    invalid: `
export function summaryAgeMs(createdAt: string): number {
  return Date.now() - Date.parse(createdAt);
}
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/credential.ts',
    valid:
      'export function issuedAt(instant: string): number { return Date.parse(instant); }',
    invalid: `
export function issuedNow(): number {
  return Reflect.apply(Date.now, undefined, []);
}
`,
    errors: 2,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/pairing-grant.ts',
    valid:
      'export function pairingGrantExpired(grant: StoredPairingGrant, now: string): boolean { return Date.parse(grant.expiresAt) < Date.parse(now); }',
    invalid: `
export function pairingGrantExpired(grant: StoredPairingGrant): boolean {
  return Date.parse(grant.expiresAt) < Date.now();
}
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/credential.ts',
    valid: encodedCredential,
    invalid: `import type { CredentialKind, CredentialParts } from '../models/credential.ts';
import { InvalidPairingError } from '../errors/invalid-pairing-error.ts';

export function parseCredential(
  kind: CredentialKind,
  value: string,
): CredentialParts | undefined {
  const parts = new RegExp(\`^\${kind}_(?<id>[0-9a-f-]{36})_(?<secret>[\\\\w-]{43})$\`).exec(value)?.groups;
  return parts?.id && parts.secret
    ? { id: parts.id, secret: parts.secret }
    : undefined;
}

export function credentialFailure(): Error {
  return new InvalidPairingError();
}
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/credential.ts',
    valid:
      "export function credentialFailure() { return {kind: 'malformed'}; }",
    invalid: `
export function credentialFailure(): Error {
  return Error('Malformed credential');
}
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/credential.ts',
    valid:
      'export function secretValid(secret: string): boolean { return secret.length > 0; }',
    invalid: `
export function mintSecret(): string {
  return crypto.getRandomValues(new Uint8Array(32)).toHex();
}
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/credential.ts',
    valid:
      'export function retryJitterMs(baseMs: number, fraction: number): number { return Math.floor(baseMs * fraction); }',
    invalid: `
export function retryJitterMs(baseMs: number): number {
  return Math.floor(baseMs * Math.random());
}
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/credential.ts',
    valid:
      "import {timingSafeEqual} from 'node:crypto'; export function secretsEqual(left: Uint8Array, right: Uint8Array): boolean { return timingSafeEqual(left, right); }",
    invalid: `import { randomBytes } from 'node:crypto';


export function mintSecret(): string {
  return randomBytes(32).toString('base64url');
}
`,
    errors: 1,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/access/src/rules/credential.ts',
    valid: encodedCredential,
    invalid: `import type { CredentialKind, CredentialParts } from '../models/credential.ts';
import { InvalidPairingError } from '../errors/invalid-pairing-error.ts';

export function parseCredential(
  kind: CredentialKind,
  value: string,
): CredentialParts | undefined {
  const parts = new RegExp(\`^\${kind}_(?<id>[0-9a-f-]{36})_(?<secret>[\\\\w-]{43})$\`).exec(value)?.groups;
  if (!parts?.id || !parts.secret) throw new InvalidPairingError();
  return { id: parts.id, secret: parts.secret };
}
`,
    errors: 2,
  },
  {
    rule: 'rules-are-pure',
    path: 'packages/projects/src/rules/probe-day.ts',
    valid:
      "export function probeDay(instant: string): string { return instant.slice(0, 'YYYY-MM-DD'.length); }",
    invalid: `export function probeDay(instant: string): string {
  return Intl.DateTimeFormat('en').format(new Date(instant));
}
`,
    errors: 1,
  },
  {
    rule: 'scope-shape',
    path: 'apps/server/src/http/scopes/paired.ts',
    valid: `import { Layer } from 'effect'; export function pairedScope(options) { return Layer.mergeAll(options.application.files, options.application.reviews).pipe(Layer.provide(policy(options).combine(options.boundary).layer)); }`,
    invalid: `import { Layer } from 'effect'; export function pairedScope(options) { return options.application.files.execute(options.input); }`,
    errors: 1,
  },

  {
    rule: 'spec-asserts',
    path: 'packages/projects/src/rules/derive-project-name.spec.ts',
    valid:
      "describe('deriveProjectName', () => { it('names a project after its folder', () => { expect(deriveProjectName(undefined, '/srv/app')).toBe('app'); }); });",
    invalid: `
const RUNS = [].length > 0;

describe('deriveProjectName probe', () => {
  if (RUNS)
    it('never registers', () => {
      expect(deriveProjectName(undefined, '/srv/app')).toBe('api');
    });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/projects/src/rules/derive-project-name.spec.ts',
    valid:
      "describe('deriveProjectName', () => { it.each([['/srv/app', 'app'], ['/srv/api', 'api']])('names %s as %s', (path, expected) => { expect(deriveProjectName(undefined, path)).toBe(expected); }); });",
    invalid: `
describe('deriveProjectName probe', () => {
  it('names every project after its folder', () => {
    ['/srv/app', '/srv/api'].map((path) =>
      expect(deriveProjectName(undefined, path)).toBe(path.slice(5)),
    );
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/projects/src/rules/derive-project-name.spec.ts',
    valid:
      "describe('deriveProjectName', () => { it('names a project after its folder', () => { expect(deriveProjectName(undefined, '/srv/app')).toBe('app'); }); });",
    invalid: `
describe('deriveProjectName probe', () => {
  it('names a project after its folder', () => {
    expect(deriveProjectName(undefined, '/srv/app'));
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.status).toBe(404);\n  expect(response.body).toStrictEqual(worktreeNotFound);\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.status).toBe(response.status);\n  expect(response.body).toStrictEqual(response.body);\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.body).toStrictEqual(worktreeNotFound);\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.body).not.toStrictEqual('sentinel');\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid: apiErrorCases,
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused with the error contract', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.body).toEqual(expect.schemaMatching(z.unknown()));\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(body.statusCode).toBe(404);\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect({ refused: body.statusCode !== 200, statusCode: body.statusCode }).toStrictEqual({ refused: true, statusCode: 404 });\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(body.error).toBe('Not Found');\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect('Not').toBe('Not');\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.body).toStrictEqual({ ...worktreeNotFound });\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.body).toStrictEqual({ ...record(response.body) });\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused as JSON', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.headers['content-type']).toBe('application/json; charset=utf-8');\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused as JSON', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.headers['content-type']).toBe(response.headers['content-type']);\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect({ wrapped: response.body }).toStrictEqual({ wrapped: worktreeNotFound });\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect({ wrapped: response.body }).toStrictEqual({ wrapped: body });\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid: apiErrorCases,
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused with the error contract', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.body).toEqual(expect.schemaMatching(apiErrorSchema.partial()));\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect([body.statusCode, body.message]).toStrictEqual([404, 'Worktree not found']);\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect([body.statusCode, typeof body.message === 'string']).toStrictEqual([404, true]);\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(text(body.message)).toBe('Worktree not found');\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(text(body.message).split(' ')[0]).toBe('Worktree');\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.status).not.toBe(200);\n  expect(body.error).toBe('Not Found');\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the changes of an unknown worktree are refused', async ({ session }) => {\n  const response = await session.send(unknownChanges());\n  const body = record(response.body);\n  expect(response.status).not.toBe(record(response.body).error);\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(response.status).toBe(200);\n  expect(body.status).toBe('ok');\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  const again = await session.send(health());\n  expect(response.status).toBe(again.status);\n  expect(response.body).toStrictEqual(again.body);\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(body.status).toMatch(/^ok$/);\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(body.status).toMatch(/(?:)/);\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(response.status).toBe(200);\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  await session.send(health());\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(response.body).toBeDefined();\n  expect(body.status).toBe('ok');\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(response.body).toBeDefined();\n  expect(response.status).toBeGreaterThan(0);\n  expect(response).toBeInstanceOf(Object);\n  expect(body.status).toBeTruthy();\n  expect(() => apiErrorSchema.parse(body)).not.toThrow();\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(body.error).toBeUndefined();\n  expect(Object.keys(body)).toEqual(['status', 'environmentId']);\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  expect(body.error).toBeUndefined();\n  expect(Object.keys(body.errors ?? {})).toEqual([]);\n  expect(text(body.status)).not.toHaveLength(0);\n  expect([]).toHaveLength(0);\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/server/spec/integration/access-health.integration.ts',
    valid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  const project = { name: 'App' };\n  expect(body.status).not.toBe(project.name);\n  expect(body.status).toBe('ok');\n});\n",
    invalid:
      "import { apiErrorSchema } from '@porcelain/contracts/shared';\nimport { expect } from 'vitest';\nimport { z } from 'zod';\nimport { worktreeNotFound } from '../kit/answers.ts';\nimport { test } from '../kit/server-test.ts';\nimport { record, text } from '../kit/session.ts';\n\nconst unknownChanges = () => ({ method: 'GET', path: `/api/worktrees/${'0'.repeat(32)}/changes` });\nconst health = () => ({ method: 'GET', path: '/api/health' });\n\ntest('the health route answers', async ({ session }) => {\n  const response = await session.send(health());\n  const body = record(response.body);\n  const project = { name: 'App' };\n  expect(project.name).toBe('App');\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/projects/src/rules/derive-project-name.spec.ts',
    valid:
      "it('names a project after its folder', () => {\n  expect(deriveProjectName(undefined, '/srv/app')).toBe('app');\n});\n",
    invalid:
      "it('names a project after its folder', () => {\n  expect(deriveProjectName(undefined, '/srv/app')).toBe(deriveProjectName(undefined, '/srv/app'));\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/projects/src/rules/derive-project-name.spec.ts',
    valid:
      "it('calls back with the derived name', () => {\n  const seen: string[] = [];\n  derive('/srv/app', (name) => seen.push(name));\n  expect(seen).toEqual(['app']);\n});\n",
    invalid:
      "it('calls back with the derived name', () => {\n  const notify = vi.fn();\n  derive('/srv/app', notify);\n  expect(notify).toHaveBeenCalled();\n});\n",
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/web/src/features/access/rules/remotes.spec.ts',
    valid: remoteLinkCases,
    invalid: `import { describe, expect, it } from 'vitest';
import { remoteLink } from './remotes.ts';

describe('remoteLink', () => {
  it.each(['', 'http://192.0.2.10:4738/pair#c=a'])('reads nothing from %j', (value) => {
    expect(remoteLink(value)).toBeUndefined();
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/web/src/features/access/rules/remotes.spec.ts',
    valid: remoteLinkCases,
    invalid: remoteLinkCases.replace(
      `    expect(remoteLink(value)).toBeUndefined();
  });
`,
      `    expect(remoteLink(value)).toBeUndefined();
    expect(remoteLink('http://192.0.2.10:4738/pair#c=b&e=env')).toEqual({
      address: 'http://192.0.2.10:4738',
      code: 'b',
      environmentId: 'env',
    });
  });
`,
    ),
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/web/src/features/access/rules/remotes.spec.ts',
    valid: remoteLinkCases.replace(
      `
  it.each(['', 'http://192.0.2.10:4738/pair#c=a'])('reads nothing from %j', (value) => {
    expect(remoteLink(value)).toBeUndefined();
  });
`,
      '',
    ),
    invalid: remoteLinkCases.replace(
      `  it.each(['', 'http://192.0.2.10:4738/pair#c=a'])('reads nothing from %j', (value) => {
    expect(remoteLink(value)).toBeUndefined();
`,
      `  it('reads the same link the same way again', () => {
    expect(remoteLink('http://192.0.2.10:4738/pair#c=a&e=env')).toEqual({
      ...remoteLink('http://192.0.2.10:4738/pair#c=a&e=env'),
    });
`,
    ),
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/client/src/shared/api/per-connection.spec.ts',
    valid: `import { describe, expect, it } from 'vitest';
import { perConnection } from './per-connection.ts';

describe('perConnection', () => {
  it('builds the API of a connection from its transport', () => {
    const api = perConnection((transport) => ({ transport }));
    const transport = () => Promise.resolve(Response.json({}));
    expect(api({ transport }).transport).toBe(transport);
  });

  it('shares one API across contexts for the same remote transport', () => {
    const api = perConnection((transport) => ({ transport }));
    const transport = () => Promise.resolve(Response.json({}));
    expect(api({ transport })).toBe(api({ transport }));
  });
});
`,
    invalid: `import { describe, expect, it } from 'vitest';
import { perConnection } from './per-connection.ts';

describe('perConnection', () => {
  it('shares one API across contexts for the same remote transport', () => {
    const api = perConnection((transport) => ({ transport }));
    const transport = () => Promise.resolve(Response.json({}));
    expect(api({ transport })).toBe(api({ transport }));
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/changes/src/rules/fingerprint-branch-file.spec.ts',
    valid: `import { describe, expect, it } from 'vitest';
import { fingerprintBranchFile } from './fingerprint-branch-file.ts';

describe('fingerprintBranchFile', () => {
  it('gives the same file the same fingerprint', () => {
    expect(fingerprintBranchFile(branchFile())).toBe(fingerprintBranchFile(branchFile()));
  });

  it('is a SHA-256 in hexadecimal', () => {
    expect(fingerprintBranchFile(branchFile())).toMatch(/^[0-9a-f]{64}$/);
  });
});
`,
    invalid: `import { describe, expect, it } from 'vitest';
import { fingerprintBranchFile } from './fingerprint-branch-file.ts';

describe('fingerprintBranchFile', () => {
  it('gives the same file the same fingerprint', () => {
    expect(fingerprintBranchFile(branchFile())).toBe(fingerprintBranchFile(branchFile()));
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/kernel/src/rules/absence.spec.ts',
    valid: `import { describe, expect, it } from 'vitest';

describe('absence spelled every way, beside what each subject produces', () => {
  it('names nothing when neither side has a path', () => {
    expect(trackedPath({})).toBe(undefined);
  });
  it('answers nothing for no entries', () => {
    expect(withoutGitDirectory([]).length).toBe(0);
  });
  it('reads no options from nothing', () => {
    expect(parseOptions('')).toEqual({});
  });
  it('holds no marks when nothing was reviewed', () => {
    expect(markSet([]).size).toBe(0);
  });
  it('labels a blank name with nothing', () => {
    expect(label('   ')).toBe('');
  });
  it('refuses a token of the other kind', () => {
    expect(accepts('pcd', token)).toBe(false);
  });
  it('finds no parent for the root', () => {
    expect(parentOf('/')).toBeNull();
  });
  it('confirms a sound draft', () => {
    expect(() => check(draft)).not.toThrow();
  });
  it('reads a list of remotes as a list', () => {
    expect(parseRemotes([remote])).toBeInstanceOf(Array);
  });

  it('names the new path of an added file', () => {
    expect(trackedPath({ newPath: 'a.md' })).toBe('a.md');
  });
  it('keeps every entry but the Git directory', () => {
    expect(withoutGitDirectory([{ name: '.git' }, { name: 'a' }])).toEqual([{ name: 'a' }]);
  });
  it('reads a flag', () => {
    expect(parseOptions('--all')).toEqual({ all: true });
  });
  it('holds a mark for each reviewed path', () => {
    expect([...markSet(['a.md'])]).toEqual(['a.md']);
  });
  it('trims a label', () => {
    expect(label(' Phone ')).toBe('Phone');
  });
  it('accepts a token of its own kind', () => {
    expect(accepts('pcp', token)).toBe(true);
  });
  it('finds the parent of a file', () => {
    expect(parentOf('/a/b')).toBe('/a');
  });
  it('refuses a draft with a duplicate step', () => {
    expect(() => check(duplicated)).toThrow(DuplicateStepError);
  });
  it('reads the remotes of a list', () => {
    expect(parseRemotes([remote])).toEqual([remote]);
  });
});
`,
    invalid: `import { describe, expect, it } from 'vitest';

describe('absence spelled every way, alone', () => {
  it('names nothing when neither side has a path', () => {
    expect(trackedPath({})).toBe(undefined);
  });
  it('answers nothing for no entries', () => {
    expect(withoutGitDirectory([]).length).toBe(0);
  });
  it('reads no options from nothing', () => {
    expect(parseOptions('')).toEqual({});
  });
  it('holds no marks when nothing was reviewed', () => {
    expect(markSet([]).size).toBe(0);
  });
  it('labels a blank name with nothing', () => {
    expect(label('   ')).toBe('');
  });
  it('refuses a token of the other kind', () => {
    expect(accepts('pcd', token)).toBe(false);
  });
  it('finds no parent for the root', () => {
    expect(parentOf('/')).toBeNull();
  });
  it('confirms a sound draft', () => {
    expect(() => check(draft)).not.toThrow();
  });
  it('reads a list of remotes as a list', () => {
    expect(parseRemotes([remote])).toBeInstanceOf(Array);
  });
});
`,
    errors: 9,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/desktop/src/rules/content-security-policy.spec.ts',
    valid: `import { describe, expect, it } from 'vitest';
import { desktopContentSecurityPolicy } from './content-security-policy.ts';

describe('desktop content security policy', () => {
  it('frames only the app and its own blobs', () => {
    expect(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .find((directive) => directive.startsWith('frame-src ')),
    ).toBe("frame-src 'self' blob:");
  });

  it('admits the inline script Vite injects only for the development web', () => {
    expect(desktopContentSecurityPolicy('development')).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-src 'self' blob:",
    );
  });
});
`,
    invalid: `import { describe, expect, it } from 'vitest';
import { desktopContentSecurityPolicy } from './content-security-policy.ts';

describe('desktop content security policy', () => {
  it('frames only the app and its own blobs', () => {
    expect(
      desktopContentSecurityPolicy('built')
        .split('; ')
        .find((directive) => directive.startsWith('frame-src ')),
    ).toBe("frame-src 'self' blob:");
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'packages/git/src/actions/commands/commit-paths.spec.ts',
    valid: `import { describe, expect, it } from 'vitest';

describe('commitPaths', () => {
  it('commits the asked paths', async () => {
    expect(await commit(['a.txt'])).toMatchObject({ state: 'committed' });
  });

  it('leaves no lock behind when a hook rejects the commit', async () => {
    await commit(['b.txt']);
    expect(readdirSync(gitDirectory).filter((entry) => entry === 'index.lock')).toEqual([]);
  });
});
`,
    invalid: `import { describe, expect, it, vi } from 'vitest';

describe('commitPaths', () => {
  it('commits the asked paths', async () => {
    expect(await commit(['a.txt'])).toMatchObject({ state: 'committed' });
  });

  it('tells the hook about the commit', async () => {
    const notify = vi.fn();
    await commit(['b.txt'], notify);
    expect(notify).toHaveBeenCalled();
  });
});
`,
    errors: 1,
  },

  {
    rule: 'spec-imports',
    path: 'apps/server/src/http/status-policy.spec.ts',
    valid:
      "import {statusPolicy} from './status-policy.ts'; import {expect, it} from 'vitest'; it('maps the outcome to a response', () => { expect(statusPolicy({kind: 'missing'})).toBe(404); });",
    invalid: `import { openStorageSession } from '@porcelain/storage';
describe('probe', () => {
  it('opens storage', () => {
    expect(openStorageSession).toBeTypeOf('function');
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-no-mocking',
    path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
    valid: observedStoreState,
    invalid: `describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });

  it('reads the clock once per mark', async () => {
    const { vi } = await import('vitest');
    const spy = vi.fn();
    spy();
    expect(spy.mock.calls.length).toBe(1);
  });
});
`,
    errors: 2,
  },
  {
    rule: 'spec-no-mocking',
    path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
    valid: observedStoreState,
    invalid: `describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });

  it('saves the mark it answers', () => {
    const { service, seen } = setup();
    const saved = seen.save.bind(seen);
    service.execute({ worktreeId, throughRevision: 1 });
    expect(saved).toHaveBeenNthCalledWith(1, { worktreeId, seenThrough: 1 });
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-no-skips',
    path: 'packages/files/src/rules/encode-base64.spec.ts',
    valid:
      "describe('encodeBase64', () => { it('encodes nothing as an empty string', () => { expect(encodeBase64(new Uint8Array(), 1)).toBe(''); }); });",
    invalid: `
describe.skip("encodeBase64 probe", () => {
  it("encodes nothing as an empty string", () => {
    expect(encodeBase64(new Uint8Array(), 1)).toBe("");
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-one-case-per-behaviour',
    path: 'packages/files/src/rules/encode-base64.spec.ts',
    valid:
      "describe('encodeBase64', () => { it.each([1, 2])('encodes %s bytes', (size) => { expect(encodeBase64(new Uint8Array(size), 1)).not.toBe(''); }); });",
    invalid: `
describe("encodeBase64 probe", () => {
  it("encodes every size", () => {
    for (const size of [1, 2])
      expect(encodeBase64(new Uint8Array(size), 1)).not.toBe("");
  });
});
`,
    errors: 1,
  },
  {
    rule: 'static-imports',
    path: 'apps/server/src/runtime/delay.ts',
    valid:
      "export function probeLoad(): Promise<unknown> { return import('./delay.ts'); }",
    invalid: `
export function probeLoad(name: string): Promise<unknown> {
  return import(name);
}
`,
    errors: 1,
  },
  {
    rule: 'timers-in-runtime',
    path: 'apps/server/src/http/hooks/prevent-caching.ts',
    valid: "reply.header('Cache-Control', 'no-store');",
    invalid: `  reply.header('Cache-Control', 'no-store');
  await new Promise((resolve) => setTimeout(resolve, 0));`,
    errors: 1,
  },
  {
    rule: 'typed-evaluation',
    path: 'apps/desktop/spec/e2e/bridge.e2e.ts',
    valid: `const saved = await page.evaluate(() => porcelainDesktop.credentials.read());
await page.evaluate((value) => porcelainDesktop.credentials.write(value), saved);`,
    invalid: `const saved = await page.evaluate('window.porcelainDesktop.credentials.read()');
await page.evaluate(\`window.porcelainDesktop.credentials.write(\${JSON.stringify(saved)})\`);
await page.waitForFunction("document.querySelector('.dark') !== null");`,
    errors: 3,
  },
  {
    rule: 'typed-evaluation',
    path: 'apps/web/spec/kit/app.ts',
    valid:
      'export const theme = () => page.evaluateHandle(() => document.documentElement);',
    invalid: `export const theme = () => page.evaluateHandle('document.documentElement');`,
    errors: 1,
  },
  {
    rule: 'use-case-computes',
    path: 'apps/server/src/use-cases/projects/find-worktree-by-path.ts',
    valid:
      "import { Effect } from 'effect';\nexport class FindWorktreeByPathUseCase { execute(input: FindWorktreeInput) { return this.findWorktree.execute(input); } }",
    invalid:
      "import { NoWorktreeAtPathError } from '@porcelain/projects/errors';\n\n    export async function fixture(input: Input, environmentId: string) { if (input.path === '') return Promise.reject(new NoWorktreeAtPathError());\n    await this.refreshInventory.execute(context); }",
    errors: 2,
  },
  {
    rule: 'use-case-computes',
    path: 'apps/server/src/use-cases/changes/read-change-lines.ts',
    valid: fixtureReadChangeLinesUseCaseComputes,
    invalid: fixtureReadChangeLinesUseCaseComputes
      .replace(
        `    return this.readChangeLines.execute({ path, from, to, at, text });
`,
        `    if (from > to) throw new InvalidLineRangeError();
    return this.readChangeLines.execute({ path, from, to, at, text });
`,
      )
      .replace(
        `import type { ReadChangeLinesService } from '@porcelain/changes/services';
`,
        `import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type { ReadChangeLinesService } from '@porcelain/changes/services';
`,
      ),
    errors: 2,
  },
  ...[
    {
      invalid:
        "import {\n  readHealthResponseSchema,\n  type ReadHealthResponse,\n} from '@porcelain/contracts/access';\n    export async function fixture(input: Input, environmentId: string) { const check = readHealthResponseSchema.parse;\n    return check({ status: 'ok', environmentId }); }",
      errors: 1,
    },
    {
      invalid:
        "import {\n  readHealthResponseSchema,\n  type ReadHealthResponse,\n} from '@porcelain/contracts/access';\n    export async function fixture(input: Input, environmentId: string) { const { parse: check } = readHealthResponseSchema;\n    return check({ status: 'ok', environmentId }); }",
      errors: 1,
    },
    {
      invalid:
        "import {\n  readHealthResponseSchema,\n  type ReadHealthResponse,\n} from '@porcelain/contracts/access';\n    export async function fixture(input: Input, environmentId: string) { const decoded = readHealthResponseSchema.safeDecode({ status: 'ok', environmentId });\n    return decoded.success ? decoded.data : { status: 'ok', environmentId }; }",
      errors: 1,
    },
  ].map(({ invalid, errors }) => ({
    rule: 'use-case-imports',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid:
      "import { Effect } from 'effect';\nimport type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';\nimport type { ReadEnvironmentService } from '@porcelain/access/services';\nimport type { ReadHealthResponse } from '@porcelain/contracts/access';\nimport type { LaneKeys } from '../../runtime/lane-keys.ts';\nimport type { Lanes } from '../../runtime/lanes.ts';\n\nexport class ReadHealthUseCase {\n  private readonly readEnvironment: ReadEnvironmentService;\n  private readonly lanes: Lanes;\n  private readonly laneKeys: LaneKeys;\n\n  constructor(\n    readEnvironment: ReadEnvironmentService,\n    lanes: Lanes,\n    laneKeys: LaneKeys,\n  ) {\n    this.readEnvironment = readEnvironment;\n    this.lanes = lanes;\n    this.laneKeys = laneKeys;\n  }\n\n  execute(): Effect.Effect<\n    ReadHealthResponse,\n    MissingEnvironmentIdentityError\n  > {\n    return Effect.gen({ self: this }, function* () {\n      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>\n        Effect.gen({ self: this }, function* () {\n          const { environmentId } = yield* this.readEnvironment.execute();\n          return { status: 'ok' as const, environmentId };\n        }),\n      );\n    });\n  }\n}\n",
    invalid,
    errors,
  })),

  {
    rule: 'use-case-input-is-contract',
    path: 'apps/server/src/use-cases/reviews/rule-fixture.ts',
    valid:
      "import { Effect } from 'effect';\nimport type {\n  CommentAuthor,\n  CreateCommentThreadRequest,\n  CreateCommentThreadResponse,\n} from '@porcelain/contracts/reviews';\nimport type { WorktreeParams } from '@porcelain/contracts/shared';\nimport type { CreateCommentThreadService } from '@porcelain/reviews/services';\nexport class CreateCommentThreadUseCase {\n  private readonly createCommentThread: CreateCommentThreadService;\n\n  constructor(createCommentThread: CreateCommentThreadService) {\n    this.createCommentThread = createCommentThread;\n  }\n\n  execute(\n    input: WorktreeParams & CreateCommentThreadRequest & CommentAuthor,\n  ): Effect.Effect<CreateCommentThreadResponse, CreateCommentThreadError> {\n    return this.createCommentThread.execute(input);\n  }\n}\n",
    invalid:
      "import { Effect } from 'effect';\nimport type { CreateCommentThreadResponse } from '@porcelain/contracts/reviews';\nimport type { CreateCommentThreadInput } from '@porcelain/reviews/models';\nimport type { CreateCommentThreadService } from '@porcelain/reviews/services';\nexport class CreateCommentThreadUseCase {\n  private readonly createCommentThread: CreateCommentThreadService;\n\n  constructor(createCommentThread: CreateCommentThreadService) {\n    this.createCommentThread = createCommentThread;\n  }\n\n  execute(\n    input: CreateCommentThreadInput,\n  ): Effect.Effect<CreateCommentThreadResponse, CreateCommentThreadError> {\n    return this.createCommentThread.execute(input);\n  }\n}\n",
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'apps/web/src/features/access/queries/probe-query.ts',
    valid:
      "import {pairingApi} from '../api'; export const pairingQuery = () => pairingApi.read();",
    invalid: `import { HttpApiClient } from 'effect/http-api';

export const probeRequest = HttpApiClient;
`,
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'apps/web/src/features/access/commands/pairing.ts',
    valid: "import { RequestError } from '@porcelain/client/transport';",
    invalid: "import { HttpApiClient as read } from 'effect/http-api';",
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'apps/mobile/src/features/access/views/access-screen.tsx',
    valid:
      "import {useEnvironments} from '@porcelain/client/access'; export const Screen = () => <Text>{useEnvironments().length}</Text>;",
    invalid: "import * as client from 'effect/http-api';",
    errors: 1,
  },
  {
    rule: 'web-browser-spec-no-mocks',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; expect.element(workspace.getByRole('region')).toBeVisible();",
    invalid: `import { vi } from 'vitest';

vi.fn();
`,
    errors: 2,
  },
  {
    rule: 'web-browser-spec-no-skips',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {test} from 'vitest'; test('opens the workspace', () => undefined);",
    invalid: `import { test } from 'vitest';

test.skip('probe', () => undefined);
`,
    errors: 1,
  },
  {
    rule: 'web-browser-spec-no-skips',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; import {test} from './fixtures.tsx'; test('the workspace opens after pairing', async ({workspace}) => { await expect.element(workspace.getByRole('region', {name: 'Review content'})).toBeVisible(); });",
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('the workspace opens after pairing', { retry: 2 }, async ({ workspace }) => {
  await expect.element(workspace.getByRole('region', { name: 'Review content' })).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'web-cache-writes-in-commands',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "export function probeRead(client: {getQueryData: (key: string[]) => unknown}) { return client.getQueryData(['access']); }",
    invalid: `export function probeReset(client: {
  setQueryData: (key: string[], value: undefined) => void;
}) {
  client.setQueryData(['access'], undefined);
}
`,
    errors: 1,
  },
  {
    rule: 'web-dialogs-from-ui',
    path: 'apps/web/src/app/settings-page.tsx',
    valid: `import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function SettingsDialog({ open }: { open: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogTitle>Settings</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}
`,
    invalid: `export function SettingsPage() {
  return (
    <div role="dialog" aria-modal="true" aria-label="Settings">
      <h1>Settings</h1>
    </div>
  );
}
`,
    errors: 1,
  },
  {
    rule: 'web-dialogs-from-ui',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {AlertDialog} from '@/components/ui/alert-dialog'; export function ProbeView() { return <AlertDialog>Remove?</AlertDialog>; }",
    invalid: `export function ProbeView() {
  return <section role={'alertdialog'}>Remove?</section>;
}
`,
    errors: 1,
  },
  {
    rule: 'web-keys-through-hotkeys',
    path: 'apps/web/src/app/settings-page.tsx',
    valid: `import { useHotkey } from '@tanstack/react-hotkeys';
import { SHORTCUTS } from '@/shared/workspace/shortcuts';

export function SettingsPage({ onLeave }: { onLeave: () => void }) {
  useHotkey(SHORTCUTS.toggleSidebar, onLeave);
  return <h1>Settings</h1>;
}
`,
    invalid: `import { useEffect } from 'react';

export function SettingsPage({ onLeave }: { onLeave: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onLeave();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onLeave]);
  return <h1>Settings</h1>;
}
`,
    errors: 1,
  },
  {
    rule: 'web-navigation-through-router',
    path: 'apps/web/src/app/settings-page.tsx',
    valid: `import { useCanGoBack, useRouter } from '@tanstack/react-router';

export function useLeave() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return () => {
    if (canGoBack) router.history.back();
  };
}
`,
    invalid: `export function leave() {
  if (window.history.length > 1) window.history.back();
}
`,
    errors: 2,
  },
  {
    rule: 'web-commands-own-writes',
    path: 'apps/web/src/features/access/queries/probe-query.ts',
    valid:
      "import {usePairingCommand} from '../commands/pairing'; export const useProbeWrite = usePairingCommand;",
    invalid: `import { useMutation } from '@tanstack/react-query';

export function useProbeWrite() {
  return useMutation({ mutationFn: async () => undefined });
}
`,
    errors: 1,
  },
  {
    rule: 'web-browser-spec-no-mocks',
    path: 'apps/web/spec/e2e/probe.e2e.ts',
    valid: `import { expect, test } from './fixtures.ts';

test('the workspace opens after pairing', async ({ pairedPage }) => {
  await expect(pairedPage.getByRole('region', { name: 'Review content', exact: true })).toBeVisible();
});
`,
    invalid: `import { expect, test } from './fixtures.ts';

test('the inventory read fails', async ({ pairedPage }) => {
  await pairedPage.route('**/api/inventory', (route) => route.fulfill({ status: 503 }));
  await expect(pairedPage.getByRole('region', { name: 'Review content', exact: true })).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'web-browser-spec-no-skips',
    path: 'apps/web/spec/e2e/probe.e2e.ts',
    valid:
      "import {expect, test} from './fixtures.ts'; test('the workspace opens after pairing', async ({pairedPage}) => { await expect(pairedPage.getByRole('region', {name: 'Review content', exact: true})).toBeVisible(); });",
    invalid: `import { expect, test } from './fixtures.ts';

test.fixme('the workspace opens after pairing', async ({ pairedPage }) => {
  await expect(pairedPage.getByRole('region', { name: 'Review content', exact: true })).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-imports',
    path: 'apps/web/spec/e2e/probe.e2e.ts',
    valid:
      "import {expect, test} from './fixtures.ts'; test('the workspace opens after pairing', async ({pairedPage}) => { await expect(pairedPage.getByRole('region', {name: 'Review content', exact: true})).toBeVisible(); });",
    invalid: `import { expect, test } from '@playwright/test';

test('the workspace opens after pairing', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Review content', exact: true })).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-retrying-assertions',
    path: 'apps/web/spec/e2e/probe.e2e.ts',
    valid: `import { expect, test } from './fixtures.ts';

test('a renamed project keeps its new name on the server', async ({ pairedPage, server }) => {
  await expect(pairedPage.getByRole('button', { name: 'Rename', exact: true })).toBeEnabled();
  await expect.poll(async () => (await server.project()).name).toBe('Renamed');
});
`,
    invalid: `import { expect, test } from './fixtures.ts';

test('a renamed project keeps its new name on the server', async ({ pairedPage, server }) => {
  await pairedPage.getByRole('button', { name: 'Rename', exact: true }).click();
  expect((await server.project()).name).toBe('Renamed');
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-asserts',
    path: 'apps/web/spec/e2e/probe.e2e.ts',
    valid:
      "import {expect, test} from './fixtures.ts'; test('opening the commit dialog shows its form', async ({pairedPage}) => { await pairedPage.getByRole('button', {name: 'Commit', exact: true}).click(); await expect(pairedPage.getByRole('dialog')).toBeVisible(); });",
    invalid: `import { test } from './fixtures.ts';

test('opening the commit dialog shows its form', async ({ pairedPage }) => {
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-asserts',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; import {test} from './fixtures.tsx'; test('opening the commit dialog shows its form', async ({workspace}) => { await workspace.getByRole('button', {name: 'Commit', exact: true}).click(); await expect.element(workspace.getByRole('dialog')).toBeVisible(); });",
    invalid: `import { test } from './fixtures.tsx';

test('opening the commit dialog shows its form', async ({ workspace }) => {
  await workspace.getByRole('button', { name: 'Commit', exact: true }).click();
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-imports',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; import {test} from './fixtures.tsx'; test('the server keeps its health status', async ({server}) => { await expect.poll(async () => (await server.health()).status).toBe('ok'); });",
    invalid: `import { expect } from 'vitest';
import { isContentChangedError } from '../../src/features/review/queries/review';
import { test } from './fixtures.tsx';

test('a conflict is recognised by the review client', async ({ server }) => {
  await expect.poll(async () => isContentChangedError(await server.health())).toBe(false);
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-locators',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; import {test} from './fixtures.tsx'; test('the workspace names its review region', async ({workspace}) => { await expect.element(workspace.getByRole('region', {name: 'Review content', exact: true})).toBeVisible(); });",
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('the workspace names its review region', async ({ workspace }) => {
  const region = workspace.getByRole('region', { name: 'Review content', exact: true }).element();
  await expect.element(region).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-locators',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; import {test} from './fixtures.tsx'; test('the workspace offers a commit button', async ({workspace}) => { await expect.element(workspace.getByRole('button', {name: 'Commit', exact: true})).toBeVisible(); });",
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('the workspace offers a commit button', async ({ workspace }) => {
  await expect.element(workspace.getByTestId('commit-button')).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-locators',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('marking a file reviewed presses its toggle', async ({ workspace }) => {
  await workspace.getByRole('button', { name: 'Mark notes.md as reviewed', exact: true }).click();
  await expect.element(workspace.getByRole('button', { name: /^Reviewed$/ })).toBeVisible();
  await expect.element(workspace.getByText('Reviewed', { exact: true })).toBeVisible();
  await expect.element(workspace.getByLabelText(new RegExp('^Comment'))).toBeVisible();
});
`,
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('marking a file reviewed presses its toggle', async ({ workspace }) => {
  await workspace.getByRole('button', { name: 'Mark notes.md as reviewed' }).click();
  await expect.element(workspace.getByText('Reviewed')).toBeVisible();
  await expect.element(workspace.getByLabelText('Comment', { exact: false })).toBeVisible();
});
`,
    errors: 3,
  },
  {
    rule: 'web-journey-no-waits',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; import {test} from './fixtures.tsx'; test('the commit dialog opens after a click', async ({workspace}) => { await workspace.getByRole('button', {name: 'Commit', exact: true}).click(); await expect.element(workspace.getByRole('dialog')).toBeVisible(); });",
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('the commit dialog opens after a click', async ({ workspace }) => {
  await workspace.getByRole('button', { name: 'Commit', exact: true }).click();
  await new Promise((done) => setTimeout(done, 500));
  await expect.element(workspace.getByRole('dialog')).toBeVisible();
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-retrying-assertions',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      "import {expect} from 'vitest'; import {test} from './fixtures.tsx'; test('a renamed project keeps its name on the server', async ({server}) => { await expect.poll(async () => (await server.project()).name).toBe('Renamed'); });",
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('a renamed project keeps its new name on the server', async ({ workspace, server }) => {
  await workspace.getByRole('button', { name: 'Rename', exact: true }).click();
  expect((await server.project()).name).toBe('Renamed');
});
`,
    errors: 1,
  },
  {
    rule: 'web-journey-through-kit',
    path: 'apps/web/spec/integration/probe.test.tsx',
    valid:
      'export async function probeFocus(locator: {click(): Promise<void>}) { await locator.click(); }',
    invalid: `import { expect } from 'vitest';
import { test } from './fixtures.tsx';

test('the paired browser can read its inventory', async ({ workspace }) => {
  await expect.element(workspace.getByRole('region', { name: 'Review content' })).toBeVisible();
  await expect.poll(async () => (await fetch('/api/inventory')).status).toBe(200);
});
`,
    errors: 2,
  },
  {
    rule: 'web-no-action-hooks',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {usePairingCommand} from '../commands/pairing'; export const ProbeView = () => <button onClick={usePairingCommand().mutate}>Pair</button>;",
    invalid: `import { useOptimistic } from 'react';

export function ProbeView() {
  const [value] = useOptimistic('probe');
  return <p>{value}</p>;
}
`,
    errors: 1,
  },
  {
    rule: 'web-no-context',
    path: 'apps/web/src/shared/probe-context.ts',
    valid:
      "import {accessStore} from '../features/access/store'; export const read = () => accessStore.getState();",
    invalid: `import { createContext } from 'react';

export const ProbeContext = createContext('');
`,
    errors: 1,
  },
  ...[
    'apps/web/src/features/files/views/file-editor.tsx',
    'apps/web/src/features/access/queries/probe-query.ts',
  ].map((path) => ({
    rule: 'web-no-empty-catch',
    path,
    valid:
      'export function read(run: () => void) { try { run(); } catch(error) { throw error; } }',
    invalid:
      'export function read(run: () => void) { try { run(); } catch {} }',
    errors: 1,
  })),
  {
    rule: 'web-no-manual-memo',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      'export function ProbeView(props: {label: string}) { return <p>{props.label.trim()}</p>; }',
    invalid: `import { useMemo } from 'react';

export function ProbeView(props: { label: string }) {
  const label = useMemo(() => props.label.trim(), [props.label]);
  return <p>{label}</p>;
}
`,
    errors: 1,
  },
  {
    rule: 'web-no-module-mutable-binding',
    path: 'apps/web/src/features/access/rules/probe-rule.ts',
    valid:
      'export function nextGeneration(generation: number) { return generation + 1; }',
    invalid: `let generation = 0;
export function nextGeneration() { return ++generation; }
`,
    errors: 1,
  },
  {
    rule: 'web-overlays-own-handles',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {pairingOverlay} from '../overlays'; export const openPairing = () => pairingOverlay.open();",
    invalid: `import { Dialog } from '@base-ui/react/dialog';

export const probeHandle = Dialog.createHandle();
`,
    errors: 1,
  },
  {
    rule: 'web-queries-export-reads',
    path: 'apps/web/src/features/access/queries/probe-query.ts',
    valid:
      "import { useAtomValue } from '@effect/atom-react'; import { readPairedAccess } from '@porcelain/client/access'; export function usePairedAccess(connection: Parameters<typeof readPairedAccess>[0]) { return useAtomValue(readPairedAccess(connection)); }",
    invalid: `export { connectionErrorMessage } from '../rules/connection-error-message';
`,
    errors: 1,
  },
  {
    rule: 'web-queries-own-reads',
    path: 'apps/web/src/features/access/commands/probe-command.ts',
    valid:
      'export const invalidatePairing = (client: QueryClient, options: QueryOptions) => client.invalidateQueries({queryKey: options.queryKey});',
    invalid: `export const probeInvalidation = { queryKey: ['access', 'session'] };
`,
    errors: 1,
  },
  {
    rule: 'web-queries-own-reads',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {usePairing} from '../queries/pairing'; export function ProbeView() { return <p>{usePairing().data}</p>; }",
    invalid: `import { useQuery } from '@tanstack/react-query';

export function ProbeView() {
  const probe = useQuery({
    queryKey: ['access', 'probe'],
    queryFn: () => 'probe',
  });
  return <p>{probe.data}</p>;
}
`,
    errors: 2,
  },
  ...[
    "import { useState } from 'react'; export const probeHook = useState;",
    'export const probeWidth = () => window.innerWidth;',
  ].map((invalid) => ({
    rule: 'web-rules-are-pure',
    path: 'apps/web/src/features/access/rules/probe-rule.ts',
    valid: 'export const label = (value: string) => value.trim();',
    invalid,
    errors: 1,
  })),
  {
    rule: 'web-shadcn-wrapper',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {Button} from '@/components/ui/button'; export function SaveControl(props: {onSave(): void}) { return <Button onClick={props.onSave}>Save</Button>; }",
    invalid: `import type { ComponentProps } from 'react';

export function SaveControl(props: ComponentProps<'button'>) {
  return <button {...props} />;
}
`,
    errors: 1,
  },
  {
    rule: 'web-store-owns-storage',
    path: 'apps/web/src/features/access/queries/probe-query.ts',
    valid:
      "import {accessStore} from '../store'; export function probeSaved() { return accessStore.getState().saved; }",
    invalid: `export function probeSaved() {
  return localStorage.getItem('probe');
}
`,
    errors: 1,
  },
  {
    rule: 'web-timers-in-commands-and-store',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeLater(done: () => void) { done(); }',
    invalid: `export function probeLater(done: () => void) {
  setTimeout(done);
}
`,
    errors: 1,
  },
  {
    rule: 'web-transport-owner',
    path: 'apps/web/src/features/access/api.ts',
    valid:
      "import {requestJson} from '@/shared/api/request'; export function probeRead() { return requestJson('/api/probe'); }",
    invalid: `
export function probeRead() {
  return fetch('/api/probe');
}
`,
    errors: 1,
  },
  {
    rule: 'web-transport-owner',
    path: 'apps/web/src/features/access/live.ts',
    valid:
      "import {connectLive} from '@/shared/live'; export function probeListen() { return connectLive('/api/live'); }",
    invalid: `export function probeListen() {
  return new WebSocket('/api/live');
}
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-await',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeSave(save: () => void) { save(); }',
    invalid: `export async function probeSave(save: () => Promise<void>) {
  await save();
}
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-command-loops',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      'export function probeRenameAll(names: string[], rename: {mutate(names: string[]): void}) { rename.mutate(names); }',
    invalid: `export function probeRenameAll(
  names: string[],
  rename: { mutate: (name: string) => void },
) {
  names.forEach((name) => rename.mutate(name));
}
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-contracts',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export type ProbePrincipal = {name: string};',
    invalid: `import type { Principal } from '@porcelain/contracts/access';

export type ProbePrincipal = Principal;
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-direct-data',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {useAccess} from '../queries/access'; export const ProbeView = () => <p>{useAccess().name}</p>;",
    invalid: `import { useQueryClient } from '@tanstack/react-query';

export const probeClient = useQueryClient;
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-direct-data',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      'export const ProbeView = (props: {search: string}) => <p>{props.search}</p>;',
    invalid: `import { useSearch } from '@tanstack/react-router';

export const probeSearch = useSearch;
`,
    errors: 1,
  },
  ...[
    {
      invalid: `export function probeSave(save: () => Promise<void>) {
  void save().catch(() => undefined);
}
`,
      errors: 1,
    },
    {
      invalid: `export function probeSave(save: () => Promise<void>) {
  void save()['then'](() => undefined);
}
`,
      errors: 1,
    },
    {
      invalid: `export function probeSave(save: () => Promise<void>) {
  void save().finally(() => undefined);
}
`,
      errors: 1,
    },
    {
      invalid: `export function probeSave(save: () => Promise<void>) {
  void save().then(() => undefined);
}
`,
      errors: 1,
    },
  ].map(({ invalid, errors }) => ({
    rule: 'web-views-no-promise-chains',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeSave(save: () => void) { save(); }',
    invalid,
    errors,
  })),

  {
    rule: 'web-views-no-transport',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {usePairing} from '../queries/pairing'; export const ProbeView = () => <p>{usePairing().state}</p>;",
    invalid: `import { createPairingLive } from '../api/pairing-live';

export const probeLive = createPairingLive;
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-try',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeGuard(run: () => void) { run(); }',
    invalid: `export function probeGuard(run: () => void, done: () => void) {
  try {
    run();
  } finally {
    done();
  }
}
`,
    errors: 1,
  },
];

const duplicateFixtureSource = `export function matchPaths(paths: readonly string[], query: string) {
  const needle = query.trim().toLowerCase();
  const found = paths.filter((path) => path.toLowerCase().includes(needle));
  const ranked = found.toSorted((left, right) => left.length - right.length);
  const shown = ranked.slice(0, 20).map((path) => ({ path, name: path.split('/').at(-1) ?? path }));
  return { needle, shown, more: ranked.length > shown.length };
}`;

const clientRouteFiles = {
  'packages/client/package.json': JSON.stringify({
    exports: {
      './files': './src/features/files/index.ts',
      './reviews': './src/features/reviews/index.ts',
      './access': './src/features/access/index.ts',
    },
  }),
  'packages/client/src/features/files/index.ts': `
export { textQuery as textQueryOptions } from './queries/text.ts';
export { unusedQuery as unusedQueryOptions } from './queries/unused.ts';
export { filesApi } from './api.ts';`,
  'packages/client/src/features/reviews/index.ts': `export { reviewsApi } from './api.ts';`,
  'packages/client/src/shared/api/per-connection.ts': `
export const perConnection = (create) => (connection) => create(connection.transport);`,
  'packages/client/src/features/files/queries/text.ts': `
import { filesApi } from '../api.ts';
export const textQuery = () => ({ queryFn: () => filesApi(connection).readTextFile({ params, query }) });`,
  'packages/client/src/features/files/queries/unused.ts': `
import { reviewsApi } from '../../reviews/api.ts';
export const unusedQuery = () => ({ queryFn: () => reviewsApi(connection).publishReview({ params, payload }) });`,
  'packages/client/src/features/files/api.ts': `
import { FilesApi } from '@porcelain/contracts/files';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { perConnection } from '../../shared/api/per-connection.ts';
function createFilesApi(transport) {
  return Effect.runSync(HttpApiClient.makeWith(FilesApi, { httpClient })).files;
}
export const filesApi = perConnection(createFilesApi);`,
  'packages/client/src/features/reviews/api.ts': `
import { ReviewsApi } from '@porcelain/contracts/reviews';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { perConnection } from '../../shared/api/per-connection.ts';
function createReviewsApi(transport) {
  return Effect.runSync(HttpApiClient.makeWith(ReviewsApi, { httpClient })).reviews;
}
export const reviewsApi = perConnection(createReviewsApi);`,
};

const clientRequestRouteFiles = {
  ...clientRouteFiles,
  'packages/client/src/features/files/api.ts': `import { FilesApi } from '@porcelain/contracts/files'; import { Context, Effect, Layer } from 'effect'; import { HttpApiClient } from 'effect/http-api'; import { Atom } from 'effect/reactivity'; export const filesApi = Atom.family((connection) => { class Client extends Context.Service()('FilesApiClient') { static runtime = connection.atoms(Layer.effect(Client, Effect.map(HttpApiClient.make(FilesApi), (api) => ({ request: (use) => withLifetime(use(api), connection.request) })))); } return Client; });`,
  'packages/client/src/features/reviews/api.ts': `import { ReviewsApi } from '@porcelain/contracts/reviews'; import { Context, Effect, Layer } from 'effect'; import { HttpApiClient } from 'effect/http-api'; import { Atom } from 'effect/reactivity'; export const reviewsApi = Atom.family((connection) => { class Client extends Context.Service()('ReviewsApiClient') { static runtime = connection.atoms(Layer.effect(Client, Effect.map(HttpApiClient.make(ReviewsApi), (api) => ({ request: (use) => withLifetime(use(api), connection.request) })))); } return Client; });`,
  'packages/client/src/features/files/queries/text.ts': `import { Effect } from 'effect'; import { filesApi } from '../api.ts'; const shadow = (reviewsApi: () => void) => reviewsApi(); export const textQuery = () => Effect.gen(function* () { shadow(() => undefined); const client = yield* filesApi(connection); return yield* client.request((api) => api.files.readTextFile({ params, query })); });`,
  'packages/client/src/features/files/queries/unused.ts': `import { Effect } from 'effect'; import { reviewsApi } from '../../reviews/api.ts'; export const unusedQuery = () => Effect.gen(function* () { const client = yield* reviewsApi(connection); return yield* client.request((api) => api.reviews.publishReview({ params, payload })); });`,
};

const clientInjectedRouteFiles = {
  ...clientRequestRouteFiles,
  'packages/client/src/features/files/queries/text.ts': `import { Effect, Layer } from 'effect'; import { Atom } from 'effect/reactivity'; import { filesApi } from '../api.ts'; export const textQuery = () => { const runtime = Atom.runtime((get) => Layer.merge(base, get(filesApi(connection).runtime.layer))); return runtime.atom(Effect.gen(function* () { const api = yield* filesApi(connection); return yield* api.files.readTextFile({ params, query }); })); };`,
};

const clientMethodReads = [
  `return filesApi(connection).readTextFile({ params, query });`,
  `const api = filesApi(connection); const alias = api; return alias.readTextFile({ params, query });`,
  `const read = filesApi(connection).readTextFile; const alias = read; return alias({ params, query });`,
  `const { readTextFile: read } = filesApi(connection); return read({ params, query });`,
  `const factory = filesApi; return factory(connection)["readTextFile"]({ params, query });`,
];

const clientNestedMethodFiles = {
  ...clientRouteFiles,
  'packages/client/src/features/access/index.ts': `export { accessApi } from './api.ts';`,
  'packages/client/src/features/access/api.ts': `
import { AccessApi } from '@porcelain/contracts/access';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { perConnection } from '../../shared/api/per-connection.ts';
function createAccessApi(transport) {
  return Effect.runSync(HttpApiClient.makeWith(AccessApi, { httpClient }));
}
export const accessApi = perConnection(createAccessApi);`,
  'packages/client/src/features/files/queries/unused.ts': `
import { accessApi } from '../../access/api.ts';
export const unusedQuery = () => ({ queryFn: () => accessApi(connection).session.issueLiveTicket() });`,
};

const clientNestedMethodReads = [
  `return accessApi(connection).session.readSession();`,
  `const { session: group } = accessApi(connection); const { readSession: read } = group; return read();`,
  `const group = accessApi(connection).session; const alias = group; return alias.readSession();`,
  `const { session: { readSession: read } } = accessApi(connection); return read();`,
];

function clientRoutesCase(files = clientRouteFiles, overrides = {}) {
  return {
    rule: 'client-route-reachability',
    app: 'apps/web/src/app.ts',
    files,
    mapped: ['GET /api/worktrees/:worktreeId/text'],
    valid: `
import { textQueryOptions as options } from '@porcelain/client/files';
export const read = () => options();`,
    invalid: `
import { textQueryOptions as options, unusedQueryOptions as unused } from '@porcelain/client/files';
export const read = () => options();
export const write = () => unused();`,
    errors: ['PUT /api/worktrees/:worktreeId/review'],
    ...overrides,
  };
}

export const guardrailCases = [
  {
    rule: 'unused-export',
    files: {
      'package.json': '{"private":true,"type":"module"}',
      'apps/desktop/package.json': '{"private":true}',
      'apps/mobile/package.json':
        '{"private":true,"dependencies":{"expo":"58.0.0"}}',
      'apps/mobile/tsconfig.json':
        '{"compilerOptions":{"moduleResolution":"Bundler","moduleSuffixes":[".ios",".android",""]}}',
      'apps/web/package.json': '{"private":true}',
      'packages/client/package.json':
        '{"name":"@porcelain/client","private":true,"exports":{".":"./src/index.ts"}}',
      'apps/desktop/src/main.ts':
        "import { kept as alias } from '@porcelain/client'; console.log(alias); void import('./dynamic.ts').then(module => console.log(module));",
      'apps/desktop/src/dynamic.ts': 'export const dynamicLive = true;',
      'apps/web/src/main.tsx':
        "import * as names from './namespace.ts'; console.log(names.live);",
      'apps/web/src/namespace.ts': 'export const live = true;',
      'packages/client/src/index.ts': "export { kept } from './owner.ts';",
      'packages/client/src/owner.ts': 'export const kept = true;',
      'apps/mobile/src/app/_layout.tsx':
        "export { RootLayout as default } from '../shell/root-layout.tsx';",
      'apps/mobile/src/shell/root-layout.tsx':
        "import { native } from './native'; export function RootLayout() { return native(); }",
      'apps/mobile/src/shell/native.ios.tsx':
        'export function native() { return null; }',
      'apps/mobile/src/shell/native.android.tsx':
        'export function native() { return null; }',
    },
    valid: {},
    invalid: {
      'apps/desktop/src/unread.ts': 'export const unread = true;',
      'apps/mobile/src/app/_layout.tsx':
        "export { RootLayout as default } from '../shell/root-layout.tsx';\nexport const unusedRoute = true;",
      'apps/web/src/namespace.ts':
        'export const live = true; export const unusedMember = true;',
      'packages/client/src/owner.ts':
        'export const kept = true; export const unused = true;',
    },
    errors: [
      'unused-export: apps/desktop/src/unread.ts: apps/desktop/src/unread.ts',
      'unused-export: apps/mobile/src/app/_layout.tsx: unusedRoute',
      'unused-export: apps/web/src/namespace.ts: unusedMember',
      'unused-export: packages/client/src/owner.ts: unused',
    ],
  },
  {
    rule: 'unused-dependency',
    files: {
      'package.json': '{"private":true,"type":"module"}',
      'apps/web/package.json':
        '{"private":true,"dependencies":{"cmdk":"1.1.1","tailwindcss":"4.3.3"}}',
      'apps/web/src/main.tsx': "import './app.css';",
      'apps/web/src/app.css': "@import 'tailwindcss';",
    },
    valid: { 'apps/web/src/main.tsx': "import 'cmdk'; import './app.css';" },
    invalid: {},
    errors: ['unused-dependency: apps/web/package.json: cmdk'],
  },
  ...[
    "import { liveUrl as address } from '../api.ts'; export const unusedQuery = () => ({ queryFn: () => address({ query: {} }) });",
    "import * as urls from '../api.ts'; export const unusedQuery = () => ({ queryFn: () => urls.liveUrl({ query: {} }) });",
  ].map((query) =>
    clientRoutesCase(
      {
        ...clientRouteFiles,
        'packages/client/src/features/files/api.ts':
          clientRouteFiles['packages/client/src/features/files/api.ts'] +
          `
import { LiveUpdatesApi } from '@porcelain/contracts/access';
export const liveUrl = HttpApiClient.urlBuilder(LiveUpdatesApi).live.liveUpdates;`,
        'packages/client/src/features/files/queries/unused.ts': query,
      },
      { errors: ['GET /api/live'] },
    ),
  ),
  {
    rule: 'native-effect-diagnostics',
    valid: `import { Effect, Schema } from 'effect';
class Refused extends Schema.TaggedError<Refused>()('Refused', { message: Schema.String }) {}
const save = Effect.gen(function* () {
  yield* Effect.void;
  return yield* Effect.fail(new Refused({ message: 'Refused' }));
});
const settled = Effect.exit(save);`,
    invalid: `import { Effect } from 'effect';
Effect.succeed('never executed');
const save = Effect.fail(new Error('Refused'));`,
    errors: ['TS377001', 'TS377023'],
  },
  {
    rule: 'native-transport-types',
    valid:
      "import { Effect, Schema } from 'effect';\nimport { HttpApi, HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';\nimport type { HttpClient } from 'effect/http';\nconst api = HttpApi.make('test').add(HttpApiGroup.make('files').add(HttpApiEndpoint.post('save', '/api/files/:id', { params: Schema.Struct({ id: Schema.String }), payload: Schema.Struct({ text: Schema.String }), success: Schema.Struct({ fingerprint: Schema.String }) })));\ndeclare const httpClient: HttpClient.HttpClient;\nconst client = Effect.runSync(HttpApiClient.makeWith(api, { httpClient })).files;\nconst handlers = HttpApiBuilder.group(api, 'files', (handlers) => handlers.handle('save', ({ params, payload }) => Effect.succeed({ fingerprint: params.id + payload.text })));\nconst request = client.save({ params: { id: 'tree' }, payload: { text: 'saved' } });\nimport { Rpc, RpcClient, RpcGroup } from 'effect/rpc';\nconst group = RpcGroup.make(Rpc.make('save', { payload: Schema.Struct({ text: Schema.String }), success: Schema.Struct({ fingerprint: Schema.String }) }));\ndeclare const rpcClient: RpcClient.FromGroup<typeof group>;\nconst rpcHandlers = group.toLayer({ save: ({ text }) => Effect.succeed({ fingerprint: text }) });\nconst rpcRequest = rpcClient.save({ text: 'saved' });\nimport { AtomHttpApi } from 'effect/reactivity';\nimport { Layer } from 'effect';\nimport { HttpClient as NativeHttpClient } from 'effect/http';\nclass Client extends AtomHttpApi.Service<Client>()('Client', { api, httpClient: Layer.succeed(NativeHttpClient.HttpClient, httpClient) }) {}\nconst nativeRequest = Client.query('files', 'save', { params: { id: 'tree' }, payload: { text: 'saved' } });",
    invalid:
      "import { Effect, Schema } from 'effect';\nimport { HttpApi, HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from 'effect/http-api';\nimport type { HttpClient } from 'effect/http';\nconst api = HttpApi.make('test').add(HttpApiGroup.make('files').add(HttpApiEndpoint.post('save', '/api/files/:id', { params: Schema.Struct({ id: Schema.String }), payload: Schema.Struct({ text: Schema.String }), success: Schema.Struct({ fingerprint: Schema.String }) })));\ndeclare const httpClient: HttpClient.HttpClient;\nconst client = Effect.runSync(HttpApiClient.makeWith(api, { httpClient })).files;\nconst incomplete = HttpApiBuilder.group(api, 'files', (handlers) => handlers);\nconst invalidHandler = HttpApiBuilder.group(api, 'files', (handlers) => handlers.handle('save', () => Effect.succeed({ fingerprint: 123 })));\nconst invalidRequest = client.save({ params: { id: 'tree' }, payload: { text: 123 } });\nconst missingRequest = client.missing({});\nimport { Rpc, RpcClient, RpcGroup } from 'effect/rpc';\nconst group = RpcGroup.make(Rpc.make('save', { payload: Schema.Struct({ text: Schema.String }), success: Schema.Struct({ fingerprint: Schema.String }) }));\ndeclare const rpcClient: RpcClient.FromGroup<typeof group>;\nconst rpcHandlers = group.of({ save: () => Effect.succeed({ fingerprint: 123 }) });\nconst rpcRequest = rpcClient.save({ text: 123 });\nimport { AtomHttpApi } from 'effect/reactivity';\nimport { Layer } from 'effect';\nimport { HttpClient as NativeHttpClient } from 'effect/http';\nclass Client extends AtomHttpApi.Service<Client>()('Client', { api, httpClient: Layer.succeed(NativeHttpClient.HttpClient, httpClient) }) {}\nconst nativeRequest = Client.query('files', 'save', { params: { id: 'tree' }, payload: { text: 123 } });",
    errors: 'TS2322 TS2375 TS2322 TS2339 TS2322 TS2322 TS2322'.split(' '),
  },
  {
    rule: 'native-client-state-types',
    valid:
      "import { Effect, Redacted, type Context } from 'effect';\nimport { AccessStore } from '__CLIENT_ACCESS__';\nimport { ProjectSelectionStore } from '__CLIENT_SELECTION__';\ndeclare const access: Context.Service.Shape<typeof AccessStore>;\ndeclare const selection: Context.Service.Shape<typeof ProjectSelectionStore>;\nconst saved = access.save({environmentId: 'computer', name: 'Computer', address: 'http://localhost', credential: Redacted.make('secret')});\nconst selected = selection.selectWorktree('computer', 'project', 'tree');\nconst remotes = access.state.value.remotes;\nimport { OperationStore } from '__CLIENT_OPERATIONS__';\ndeclare const operations: Context.Service.Shape<typeof OperationStore>;\nconst pending = operations.state.value.operations.get('fetch');\nimport { WriteQueues } from '__CLIENT_QUEUES__';\nconst writes = WriteQueues.use((queues) => queues.run(['comments', 'tree'], Effect.succeed('written')));\nconst written = Effect.runPromise(Effect.provide(writes, WriteQueues.layer));\nimport { AccessSession } from '__CLIENT_SESSION__';\nimport { ConnectionFactory, RemoteConnectionFactory } from '__CLIENT_FACTORY__';\nimport { RemoteConnections } from '__CLIENT_REMOTE_CONNECTIONS__';\nimport { Layer } from 'effect';\ndeclare const session: Context.Service.Shape<typeof AccessSession>;\ndeclare const factory: Context.Service.Shape<typeof ConnectionFactory>;\nconst admitted = session.beginConnection(true);\ndeclare const pool: Context.Service.Shape<typeof RemoteConnections>;\nconst connections = pool.state.value;\nconst sessionGraph = Layer.build(AccessSession.layer.pipe(Layer.provide(Layer.succeed(ConnectionFactory, factory))));\ndeclare const remoteFactory: Context.Service.Shape<typeof RemoteConnectionFactory>;\nconst remoteGraph = Layer.build(RemoteConnections.layer.pipe(Layer.provide(Layer.succeed(RemoteConnectionFactory, remoteFactory))));",
    invalid:
      "import { Effect, Redacted, type Context } from 'effect';\nimport { AccessStore } from '__CLIENT_ACCESS__';\nimport { ProjectSelectionStore } from '__CLIENT_SELECTION__';\ndeclare const access: Context.Service.Shape<typeof AccessStore>;\ndeclare const selection: Context.Service.Shape<typeof ProjectSelectionStore>;\nEffect.runSync(AccessStore.pipe(Effect.provide(AccessStore.layer)));\naccess.state.set({remotes: [], status: 'ready', error: undefined});\naccess.state.value.remotes.push({environmentId: 'computer', name: 'Computer', address: 'http://localhost', credential: Redacted.make('secret')});\nselection.state.value.selections.computer = {projectId: 'project', worktreeId: 'tree'};\nimport { OperationStore } from '__CLIENT_OPERATIONS__';\ndeclare const operations: Context.Service.Shape<typeof OperationStore>;\nimport { operationStoreLayer } from '__CLIENT_OPERATION_LAYER__';\nEffect.runSync(OperationStore.pipe(Effect.provide(operationStoreLayer)));\noperations.state.value.operations.clear();\nimport { WriteQueues } from '__CLIENT_QUEUES__';\nconst writes = WriteQueues.use((queues) => queues.run(['comments', 'tree'], Effect.succeed('written')));\nconst written = Effect.runPromise(writes);\nimport { AccessSession } from '__CLIENT_SESSION__';\nimport { RemoteConnections } from '__CLIENT_REMOTE_CONNECTIONS__';\ndeclare const pool: Context.Service.Shape<typeof RemoteConnections>;\ndeclare const session: Context.Service.Shape<typeof AccessSession>;\nEffect.runSync(AccessSession.pipe(Effect.provide(AccessSession.layer)));\nsession.state.set({connection: null, generation: 0, writerIdentity: undefined});\npool.state.value.push({});\nconst wrong = session.beginConnection('automatic');\nEffect.runSync(RemoteConnections.pipe(Effect.provide(RemoteConnections.layer)));\npool.state.set([]);\nconst wrongRemotes = pool.synchronize('computer');\nimport { RemoteConnectionFactory } from '__CLIENT_FACTORY__';\ndeclare const remoteFactory: Context.Service.Shape<typeof RemoteConnectionFactory>;\nEffect.runPromise(remoteFactory.open({environmentId: 'computer', name: 'Computer', address: 'http://localhost', credential: Redacted.make('secret')}));",
    errors:
      'TS2379 TS377004 TS2339 TS2339 TS2542 TS2379 TS377004 TS2339 TS2379 TS377004 TS2379 TS377004 TS2339 TS2339 TS2345 TS2379 TS377004 TS2339 TS2345 TS2379 TS377004'.split(
        ' ',
      ),
  },
  {
    rule: 'native-process-types',
    valid:
      "import { Effect, type Context } from 'effect';\nimport { ChildProcessSpawner } from 'effect/process';\nimport { runCommand } from '__PROCESS_COMMAND__';\ndeclare const spawner: Context.Service.Shape<typeof ChildProcessSpawner.ChildProcessSpawner>;\nconst input = { command: 'git', args: ['status'], maxBytes: 1024, processGroup: { lingerMs: 250, cleanupMs: 5000, pollMs: 10 } };\nconst result = Effect.runPromise(runCommand(input).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)));",
    invalid:
      "import { Effect } from 'effect';\nimport { runCommand } from '__PROCESS_COMMAND__';\nconst input = { command: 'git', args: ['status'], maxBytes: 1024, processGroup: { lingerMs: 250, cleanupMs: 5000, pollMs: 10 } };\nconst result = Effect.runPromise(runCommand(input));\nconst wrong = runCommand({ ...input, maxBytes: '1024' });",
    errors: ['TS2379', 'TS377004', 'TS2322'],
  },
  {
    rule: 'native-agent-types',
    valid:
      "import { Effect, type Context } from 'effect';\nimport { CommitPlanner, CodexProvider, ClaudeProvider } from '__COMMIT_PLANNING__';\ndeclare const codex: Context.Service.Shape<typeof CodexProvider>;\ndeclare const claude: Context.Service.Shape<typeof ClaudeProvider>;\nconst limits = { maxGroups: 20, maxPaths: 2000, maxMessageLength: 16384, maxPathLength: 4096 };\nconst planner = Effect.runSync(CommitPlanner.pipe(Effect.provide(CommitPlanner.layer(limits)), Effect.provideService(CodexProvider, codex), Effect.provideService(ClaudeProvider, claude)));\nconst plan = planner.plan({ mode: 'message', model: 'claude:sonnet', paths: ['README.md'], evidence: 'diff' });",
    invalid:
      "import { Effect, type Context } from 'effect';\nimport { CommitPlanner } from '__COMMIT_PLANNING__';\nconst limits = { maxGroups: 20, maxPaths: 2000, maxMessageLength: 16384, maxPathLength: 4096 };\nconst planner = Effect.runSync(CommitPlanner.pipe(Effect.provide(CommitPlanner.layer(limits))));\ndeclare const subject: Context.Service.Shape<typeof CommitPlanner>;\nconst plan = subject.plan({ mode: 'message', model: 'claude:sonnet', paths: [123], evidence: 'diff' });",
    errors: ['TS2379', 'TS377004', 'TS2322'],
  },
  {
    rule: 'review-draft-types',
    valid:
      "import { Effect, type Context } from 'effect';\nimport type { ValidateReviewDraftService, PublishReviewService } from '__REVIEW_SERVICES__';\nimport type { ReviewDraft } from '__REVIEW_MODELS__';\ndeclare const validate: Context.Service.Shape<typeof ValidateReviewDraftService>;\ndeclare const publish: Context.Service.Shape<typeof PublishReviewService>;\nconst input: ReviewDraft = { expectedRevision: 0, summaryHtml: '<p>Review</p>', layers: [] };\nconst publication = validate.execute(input).pipe(Effect.flatMap((draft) => publish.execute({ worktreeId: 'tree', draft, evidence: { changes: [], texts: new Map(), diffs: [] } })));",
    invalid:
      "import { Effect, type Context } from 'effect';\nimport type { ValidateReviewDraftService, PublishReviewService } from '__REVIEW_SERVICES__';\nimport type { ReviewDraft } from '__REVIEW_MODELS__';\ndeclare const validate: Context.Service.Shape<typeof ValidateReviewDraftService>;\ndeclare const publish: Context.Service.Shape<typeof PublishReviewService>;\nconst input: ReviewDraft = { expectedRevision: 0, summaryHtml: '<p>Review</p>', layers: [] };\nconst publication = publish.execute({ worktreeId: 'tree', draft: input, evidence: { changes: [], texts: new Map(), diffs: [] } });",
    errors: ['TS2322'],
  },
  {
    rule: 'worktree-transaction-types',
    valid:
      "import { Effect, type Context } from 'effect';\nimport { nativeRead, withReadLease } from '__ADMISSION__';\nimport type { Lanes } from '__LANES__';\ndeclare const lanes: Context.Service.Shape<typeof Lanes>;\nconst transaction = lanes.transaction('review', () => withReadLease('tree', nativeRead('tree', () => Promise.resolve('text'))), (text) => Effect.succeed(text), () => Effect.void);",
    invalid:
      "import { Effect, type Context } from 'effect';\nimport { nativeRead, withReadLease } from '__ADMISSION__';\nimport type { Lanes } from '__LANES__';\ndeclare const lanes: Context.Service.Shape<typeof Lanes>;\nconst transaction = lanes.transaction('review', () => Effect.succeed('prepared'), () => nativeRead('tree', () => Promise.resolve('text')), () => Effect.void);",
    errors: ['TS2375', 'TS377004'],
  },
  {
    rule: 'worktree-capability-types',
    valid: `import { Effect } from 'effect';
import { nativeRead, nativeWrite, withReadLease, withWriteLease } from '__ADMISSION__';
const read = nativeRead('tree', () => Promise.resolve('text'));
const write = nativeWrite('tree', () => Promise.resolve('written'));
Effect.runPromise(withReadLease('tree', read));
Effect.runPromise(withWriteLease('tree', Effect.andThen(read, write)));`,
    invalid: `import { Effect } from 'effect';
import { nativeRead, nativeWrite, withReadLease, WorktreeRead } from '__ADMISSION__';
const read = nativeRead('tree', () => Promise.resolve('text'));
const write = nativeWrite('tree', () => Promise.resolve('written'));
Effect.runPromise(read);
Effect.runPromise(withReadLease('tree', write));
Effect.runPromise(Effect.provideService(read, WorktreeRead, { assert: () => undefined }));`,
    errors: ['TS2379', 'TS377004', 'TS2379', 'TS377004', 'TS2739'],
  },
  ...['web', 'desktop', 'mobile'].flatMap((app) =>
    [clientRequestRouteFiles, clientInjectedRouteFiles].map((files) =>
      clientRoutesCase(files, {
        app: `apps/${app}/src/app.ts`,
        valid: `import { textQueryOptions as options, type unusedQueryOptions } from '@porcelain/client/files'; import '@porcelain/client/files'; export const read = () => options();`,
      }),
    ),
  ),
  clientRoutesCase(clientRouteFiles, {
    invalid: `
import * as files from '@porcelain/client/files';
export const read = () => files.textQueryOptions();
export const write = () => files.unusedQueryOptions();`,
  }),
  clientRoutesCase(
    {
      ...clientRouteFiles,
      'packages/client/src/features/files/commands/startup.ts': `
import { reviewsApi } from '../../reviews/api.ts';
reviewsApi(connection).publishReview({ params, payload });`,
    },
    {
      invalid: `
import { textQueryOptions } from '@porcelain/client/files';
import '../../../packages/client/src/features/files/commands/startup.ts';
export const read = () => textQueryOptions();`,
    },
  ),
  ...['web', 'desktop', 'mobile'].flatMap((app) =>
    clientMethodReads.map((read) =>
      clientRoutesCase(
        {
          ...clientRouteFiles,
          'packages/client/src/features/files/queries/text.ts': `
import { filesApi } from '../api.ts';
export const textQuery = () => ({
  queryFn: () => {
    ${read}
  },
});`,
        },
        { app: `apps/${app}/src/app.ts` },
      ),
    ),
  ),
  ...clientMethodReads.map((read) =>
    clientRoutesCase(clientRouteFiles, {
      app: 'apps/mobile/src/app.ts',
      valid: `
import { filesApi } from '@porcelain/client/files';
export const read = () => {
  ${read}
};`,
      invalid: `
import { filesApi } from '@porcelain/client/files';
import { reviewsApi } from '@porcelain/client/reviews';
export const read = () => {
  ${read}
};
export const write = () => {
  const api = reviewsApi(connection);
  const alias = api;
  const { publishReview: write } = alias;
  return write({ params, payload });
};`,
    }),
  ),
  ...[
    `return filesApi(connection)[method]();`,
    `return consume(filesApi(connection));`,
    `const { readTextFile, ...rest } = filesApi(connection); return rest;`,
    `let api = filesApi(connection); api = other; return api.readTextFile({ params, query });`,
    `return filesApi(connection).unknown();`,
    `return filesApi(connection).request((api) => api[method]({ params, query }));`,
    `return filesApi(connection).request((api) => consume(api));`,
    `return filesApi(connection).request(consume);`,
  ].map((use) =>
    clientRoutesCase(
      {
        ...clientRouteFiles,
        'packages/client/src/features/files/queries/unused.ts': `
import { filesApi } from '../api.ts';
export const unusedQuery = () => ({ queryFn: () => { ${use} } });`,
      },
      {
        errors: [
          'select a literal generated endpoint, because an escaped or dynamic client binding cannot prove feature route coverage.',
          ...(use.includes('let api')
            ? [
                'keep the generated client binding traceable so its feature map can name the route.',
              ]
            : []),
        ],
      },
    ),
  ),
  ...[
    `if (dirty) yield* reviewsApi(connection).publishReview({ params, payload });`,
    `const read = filesApi(connection).readTextFile; const write = reviewsApi(connection).publishReview; yield* read({ params, query }); if (dirty) yield* write({ params, payload });`,
    `const plan = { ...other, dirty }; if (plan.dirty) yield* reviewsApi(connection).publishReview({ params, payload });`,
  ].map((decision) =>
    clientRoutesCase({
      ...clientRouteFiles,
      'packages/client/src/features/files/queries/unused.ts': `
import { Effect } from 'effect';
import { filesApi } from '../api.ts';
import { reviewsApi } from '../../reviews/api.ts';
export const unusedQuery = () => ({ queryFn: () => Effect.gen(function* () {
  yield* filesApi(connection).readTextFile({ params, query });
  ${decision}
}) });`,
    }),
  ),
  ...['web', 'desktop', 'mobile'].flatMap((app) =>
    clientNestedMethodReads.map((read) =>
      clientRoutesCase(
        {
          ...clientNestedMethodFiles,
          'packages/client/src/features/files/queries/text.ts': `
import { accessApi } from '../../access/api.ts';
export const textQuery = () => ({
  queryFn: () => {
    ${read}
  },
});`,
        },
        {
          app: `apps/${app}/src/app.ts`,
          mapped: ['GET /api/session'],
          errors: ['POST /api/live/tickets'],
        },
      ),
    ),
  ),
  ...[
    `return accessApi(connection).session[method]();`,
    `return accessApi(connection).session.unknown();`,
    `const { session: group } = accessApi(connection); return consume(group);`,
    `let group = accessApi(connection).session; group = other; return group.readSession();`,
  ].map((use) =>
    clientRoutesCase(
      {
        ...clientNestedMethodFiles,
        'packages/client/src/features/files/queries/text.ts': `
import { accessApi } from '../../access/api.ts';
export const textQuery = () => ({ queryFn: () => accessApi(connection).session.readSession() });`,
        'packages/client/src/features/files/queries/unused.ts': `
import { accessApi } from '../../access/api.ts';
export const unusedQuery = () => ({ queryFn: () => { ${use} } });`,
      },
      {
        mapped: ['GET /api/session'],
        errors: [
          'select a literal generated endpoint, because an escaped or dynamic client binding cannot prove feature route coverage.',
          ...(use.includes('let group')
            ? [
                'keep the generated client binding traceable so its feature map can name the route.',
              ]
            : []),
        ],
      },
    ),
  ),
  {
    rule: 'lane-per-table',
    valid: {
      'apps/server/src/ports/device-connection-store.ts':
        'export interface DeviceConnectionStore { insert(): void; }',
    },
    invalid: {
      'apps/server/src/ports/new-connection-store.ts':
        'export interface NewConnectionStore { insert(): void; }',
    },
    errors: ['lane-per-table'],
  },
  {
    rule: 'lane-per-table',
    files: {
      'apps/server/src/use-cases/reviews/read-review.ts':
        "import { ReadReviewService } from '../../../../../packages/reviews/src/services/read-review-service.ts'; export class ReadReviewUseCase { constructor(private readonly service: ReadReviewService, private readonly lanes: { run(key: string, mode: string, body: () => string[]): string[] }, private readonly laneKeys: { reviews(): string }) {} execute() { return this.lanes.run(this.laneKeys.reviews(), 'read', () => this.service.execute()); } }",
    },
    valid: {
      'packages/reviews/src/ports/review-store.ts':
        'export interface ReviewStore { list(): string[]; }',
      'packages/reviews/src/services/read-review-service.ts':
        "import type { ReviewStore as Store } from '../ports/review-store.ts'; export class ReadReviewService { constructor(private readonly store: Store) {} execute(): string[] { return this.store.list(); } }",
    },
    invalid: {
      'packages/reviews/src/ports/review-store.ts':
        'export interface NewReviewStore { list(): string[]; }',
      'packages/reviews/src/services/read-review-service.ts':
        "import type { NewReviewStore as Store } from '../ports/review-store.ts'; export class ReadReviewService { constructor(private readonly store: Store) {} execute(): string[] { return this.store.list(); } }",
    },
    errors: ['lane-per-table'],
  },
  {
    rule: 'lane-per-table',
    valid: {
      'packages/access/src/ports/device-store.ts':
        'export type DeviceStore = { save(): void };',
    },
    invalid: {
      'packages/access/src/ports/new-device-store.ts':
        'export type NewDeviceStore = { save(): void };',
    },
    errors: ['lane-per-table'],
  },
  ...[
    {
      rule: 'lane-per-table',
      call: 'return yield* lanes.commit(keys.access(), () => receipts.claimExecution());',
    },
    {
      rule: 'lane-mode-matches-service',
      call: "return yield* lanes.run(keys.receipts(), 'read', () => receipts.claimExecution());",
    },
  ].map(({ rule, call }) => {
    const workflow = (body) =>
      `import { Context, Effect, Layer } from 'effect'; import { GitActionReceiptStore } from '../../../../packages/git-actions/src/ports/git-action-receipt-store.ts'; import { Lanes } from './lanes.ts'; import { LaneKeys } from './lane-keys.ts'; export class GitActionWorkflow extends Context.Service<GitActionWorkflow, { readonly execute: () => Effect.Effect<boolean>; }>()('@porcelain/server/GitActionWorkflow') { static readonly layer = Layer.effect(GitActionWorkflow, Effect.gen(function* () { const receipts = yield* GitActionReceiptStore; const lanes = yield* Lanes; const keys = yield* LaneKeys; return { execute: Effect.fn('GitActionWorkflow.execute')(function* () { ${body} }), }; })); }`;
    return {
      rule,
      files: {
        'packages/git-actions/src/ports/git-action-receipt-store.ts':
          "import { Context, type Effect } from 'effect'; export interface GitActionReceiptStore { claimExecution(): Effect.Effect<boolean>; } export const GitActionReceiptStore = Context.Service<'@porcelain/git-actions/GitActionReceiptStore', GitActionReceiptStore>('@porcelain/git-actions/GitActionReceiptStore');",
        'apps/server/src/runtime/lanes.ts':
          "import { Context, type Effect } from 'effect'; export class Lanes extends Context.Service<Lanes, { readonly commit: (key: string, work: () => Effect.Effect<boolean>) => Effect.Effect<boolean>; readonly run: (key: string, mode: string, work: () => Effect.Effect<boolean>) => Effect.Effect<boolean>; }>()('@porcelain/server/Lanes') {}",
        'apps/server/src/runtime/lane-keys.ts':
          "import { Context } from 'effect'; export class LaneKeys extends Context.Service<LaneKeys, { readonly receipts: () => string; readonly access: () => string; }>()('@porcelain/server/LaneKeys') {}",
      },
      valid: {
        'apps/server/src/runtime/git-action-workflow.ts': workflow(
          'return yield* lanes.commit(keys.receipts(), () => receipts.claimExecution());',
        ),
      },
      invalid: {
        'apps/server/src/runtime/git-action-workflow.ts': workflow(call),
      },
      errors: [rule],
    };
  }),
  {
    rule: 'status-policy-complete',
    files: {
      'packages/access/src/errors/native-error.ts': `import { Schema } from 'effect'; export class NativeFailure extends Schema.TaggedError<NativeFailure>()('NativeFailure', {}) {}`,
      'packages/access/src/errors/index.ts':
        "export { NativeFailure as PublicFailure } from './native-error.ts';",
    },
    valid: {
      'apps/server/src/http/status-policy.ts':
        "import { PublicFailure as Outcome } from '../../../../packages/access/src/errors/index.ts'; export const rules = [{ errors: [Outcome], statusCode: 400 }];",
    },
    invalid: {
      'apps/server/src/http/status-policy.ts':
        "import { PublicFailure as Outcome } from '../../../../packages/access/src/errors/index.ts'; export const decoy = { errors: [Outcome] }; export const rules = [];",
    },
    errors: ['status-policy-complete'],
  },
  {
    rule: 'status-policy-complete',
    files: {
      'packages/kernel/src/errors/failure.ts':
        'class DomainFailure extends Error {} export class ReviewFailure extends DomainFailure {} export class Helper {}',
      'packages/kernel/src/errors/index.ts': "export * from './failure.ts';",
    },
    valid: {
      'apps/server/src/http/status-policy.ts':
        "import { ReviewFailure } from '../../../../packages/kernel/src/errors/index.ts'; export const rules = [{ errors: [ReviewFailure], statusCode: 409 }];",
    },
    invalid: {},
    errors: ['status-policy-complete'],
  },
  {
    rule: 'status-policy-complete',
    files: {
      'packages/reviews/src/errors/new-review-error.ts':
        'export class NewReviewError extends Error {}',
      'packages/reviews/src/errors/index.ts':
        "export { NewReviewError as PublicReviewError } from './new-review-error.ts';",
    },
    valid: {
      'apps/server/src/http/status-policy.ts':
        "import { PublicReviewError as Outcome } from '../../../../packages/reviews/src/errors/index.ts'; export const rules = [{ errors: [Outcome], statusCode: 409 }];",
    },
    invalid: {
      'apps/server/src/http/status-policy.ts':
        "import { PublicReviewError as Outcome } from '../../../../packages/reviews/src/errors/index.ts'; export const decoy = { errors: [Outcome] }; export const rules = [];",
    },
    errors: ['status-policy-complete'],
  },
  {
    rule: 'status-policy-complete',
    files: {
      'packages/reviews/src/errors/new-review-error.ts':
        'export class NewReviewError extends Error {} export class OtherReviewError extends Error {}',
      'packages/reviews/src/errors/index.ts':
        "export * from './new-review-error.ts';",
    },
    valid: {
      'apps/server/src/http/status-policy.ts':
        "import { NewReviewError, OtherReviewError } from '../../../../packages/reviews/src/errors/index.ts'; export const rules = [{ errors: [NewReviewError, OtherReviewError], statusCode: 409 }];",
    },
    invalid: {
      'apps/server/src/http/status-policy.ts':
        "import { NewReviewError } from '../../../../packages/reviews/src/errors/index.ts'; export const rules = [{ errors: [NewReviewError], statusCode: 409 }];",
    },
    errors: ['status-policy-complete'],
  },
  {
    rule: 'status-policy-complete',
    files: {
      'packages/storage/src/errors/invalid-data-directory-error.ts':
        'export class InvalidDataDirectoryError extends Error {}',
      'packages/storage/src/errors/unsupported-database-version-error.ts':
        'export class UnsupportedDatabaseVersionError extends Error {}',
      'packages/storage/src/index.ts':
        "export * from './errors/invalid-data-directory-error.ts'; export * from './errors/unsupported-database-version-error.ts';",
    },
    valid: {},
    invalid: {
      'packages/storage/src/errors/invalid-data-directory-error.ts':
        'export class InvalidDataDirectoryError extends Error {} export class RuntimeStorageError extends Error {}',
    },
    errors: ['status-policy-complete'],
  },
  ...[
    ['Review', '<Button>Review</Button>', 'export class ReviewService {}'],
    ['Name', 'label="Name"', 'const environmentName = "local";'],
    ['Unmark ', 'label="Unmark all"', 'const label = "reUnmark all";'],
    [
      'review-file',
      'data-testid="review-file"',
      'data-testid="review-file-menu"',
    ],
    ['a+b', 'label="a+b"', 'label="aab"'],
    ['Timeline of ', '`Timeline of ${path}`', 'const readTimeline = path;'],
  ].map(([selector, valid, invalid]) => ({
    rule: 'feature-selector',
    selector,
    valid,
    invalid,
  })),
  ...[
    ['apps/server/src/copy.ts', 'packages/reviews/src/copy.ts'],
    ['packages/client/src/copy.ts', 'packages/reviews/src/copy.ts'],
    ['apps/mobile/src/copy.ts', 'apps/desktop/src/copy.ts'],
    ['apps/web/src/copy.ts', 'packages/client/src/copy.ts'],
    ['apps/web/src/copy.ts', 'apps/web/src/copy-again.ts', 'web'],
  ].map(([first, second, scope = 'repository']) => ({
    rule: 'duplicate-code',
    first,
    second,
    scope,
    valid: 'export const label = "Unique";',
    invalid: duplicateFixtureSource,
  })),
  {
    rule: 'duplicate-count-ratchet',
    source: duplicateFixtureSource,
    ceiling: 7,
    valid: {
      before: { duplicatedLines: 7, clones: 1, rejected: false },
      afterDeletion: { duplicatedLines: 7, clones: 1, rejected: false },
    },
    invalid: { duplicatedLines: 14, clones: 2, rejected: true },
  },
];

export const scriptCases = [
  {
    folder: '.',
    required: [['node', 'scripts/probes.ts', '--check']],
    valid: 'node "./scripts/probes.ts" --check',
    invalid: 'node -e 0',
  },
  {
    folder: '.',
    required: [['turbo', 'run', 'typecheck', 'test:rules', 'probes:check']],
    valid: 'turbo run probes:check typecheck test:rules --continue',
    invalid: 'turbo run typecheck test:rules --continue',
  },
  {
    folder: 'apps/web',
    required: [
      ['tsc', '--noEmit'],
      ['tsc', '--noEmit', '-p', 'tsconfig.node.json'],
    ],
    valid: 'tsc --noEmit && tsc -p tsconfig.node.json --noEmit',
    invalid: 'tsc -p tsconfig.node.json --noEmit',
  },
  {
    folder: 'packages/storage',
    required: [['node', 'scripts/check-migrations.ts']],
    valid: 'node "./scripts/check-migrations.ts"',
    invalid: 'node scripts/unrelated-check.ts',
  },
  {
    folder: 'apps/mobile',
    required: [
      ['vitest', 'run', '--project', '@porcelain/mobile-e2e'],
      ['vitest', 'run', '--project', '@porcelain/mobile-e2e-tablet'],
    ],
    valid:
      'vitest run --project "@porcelain/mobile-e2e" && vitest run --project "@porcelain/mobile-e2e-tablet"',
    invalid: 'vitest run --project "@porcelain/mobile-e2e"',
  },
  {
    folder: '.',
    required: [['tsc', '--noEmit']],
    valid: 'tsc --noEmit --pretty',
    invalid: 'tsc --noEmit --help',
  },
  {
    folder: '.',
    required: [['tsc', '--noEmit']],
    valid: 'tsc --noEmit',
    invalid: 'tsc --noEmit || true',
  },
];

export const proseCases = [
  { valid: 'AGENTS.md', invalid: 'architecture/README.md' },
  { valid: '.github/PULL_REQUEST_TEMPLATE.md', invalid: 'apps/web/README.mdx' },
  {
    valid: '.agents/skills/web-verify/SKILL.md',
    invalid: 'apps/desktop/ARCHITECTURE.md',
  },
  {
    valid: 'architecture/policy.ts',
    invalid: 'packages/client/README.MARKDOWN',
  },
];

export const scriptEvasions = [
  ['node scripts/probes.ts --check', [['node', 'scripts/probes.ts']]],
  ['node other.ts scripts/probes.ts', [['node', 'scripts/probes.ts']]],
  ['tsc --noEmit false', [['tsc', '--noEmit']]],
  ['tsc --noEmit --noCheck', [['tsc', '--noEmit']]],
  [
    'vitest run --project wrong @porcelain/client',
    [['vitest', 'run', '--project', '@porcelain/client']],
  ],
  ['playwright test --list', [['playwright', 'test']]],
  ['turbo run test --dry-run', [['turbo', 'run', 'test']]],
];

export const externalCases = [
  { role: 'rule', valid: 'effect/DateTime', invalid: 'effect' },
  { role: 'kernel-test-kit', valid: 'effect/testing', invalid: 'node:fs' },
  { role: 'kernel-test-kit', valid: 'vitest', invalid: 'effect/http' },
  { role: 'mobile-config', valid: 'tsx/cjs', invalid: 'tsx' },
  { role: 'mobile-test-kit', valid: 'expo/fingerprint', invalid: 'expo' },
  ...['client-integration-test', 'client-test-kit'].map((role) => ({
    role,
    valid: 'effect/reactivity',
    invalid: 'effect/http',
  })),
  { role: 'process', valid: 'effect/process', invalid: 'node:child_process' },
  { role: 'config', valid: 'effect', invalid: 'effect/FileSystem' },
  { role: 'transport', valid: '@effect/platform-node', invalid: 'fastify' },
  { role: 'bootstrap', valid: '@effect/platform-node', invalid: 'effect/cli' },
];
