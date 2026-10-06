import { effectRuleCases } from './effect-rule-cases.mjs';

const cases = [
  {
    rule: 'web-api-owns-request',
    path: 'apps/web/src/features/reviews/live.ts',
    valid: "import { RequestError } from '@porcelain/client/transport';",
    invalid: "import { HttpApiClient } from 'effect/http-api';",
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
    rule: 'root-scripts-import-no-package',
    path: 'scripts/read.ts',
    valid: "import { readFileSync } from 'node:fs';",
    invalid: "import { filesApi } from '@porcelain/client/files/api';",
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
    valid: `export class FilesystemDirectoryReader implements DirectoryReader {
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
}`,
    invalid: `export class FilesystemDirectoryReader implements DirectoryReader {
  async list(
  ): Promise<DirectoryRead> {
    try {
      for await (const entry of await opendir(before.path, {
      })) {
        if (name.toLowerCase() === '.git') continue;
        if (found.length === input.limit) {
        }
      }
    } catch (error) {
    }
  }
}`,
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
    valid: `import { Effect } from 'effect';
import { AnnounceWorktreeChangeUseCasePort } from '../../ports/announce-worktree-change-use-case-port.ts';
export const announce = Effect.flatMap(AnnounceWorktreeChangeUseCasePort, (operation) => operation.execute({ worktreeId: 'one', change: 'git' }));`,
    invalid: `import { Effect } from 'effect';
import { AnnounceWorktreeChangeUseCasePort } from '../../ports/announce-worktree-change-use-case-port.ts';
export const announce = Effect.flatMap(AnnounceWorktreeChangeUseCasePort, (operation) => operation.execute({ worktreeId: 'one', change: 'git' }));
import { EventPublisher } from '../../ports/event-publisher.ts';
export const direct = Effect.flatMap(EventPublisher, (events) => events.worktreeChanged({ worktreeId: 'one', change: 'git' }));`,
    errors: 1,
  },
  {
    rule: 'events-from-use-cases',
    path: 'apps/server/src/adapters/events/web-socket-event-publisher.ts',
    valid: `import { Layer as NativeLayer, Effect } from 'effect';
import { EventPublisher as Publisher } from '../../ports/event-publisher.ts';
export const publisherLayer = NativeLayer.effect(Publisher, Effect.succeed({ inventoryChanged: () => Effect.void }));`,
    invalid: `import { Layer as NativeLayer, Effect } from 'effect';
import { EventPublisher as Publisher } from '../../ports/event-publisher.ts';
export const publisherLayer = NativeLayer.effect(Publisher, Effect.succeed({ inventoryChanged: () => Effect.void }));export const direct = Effect.flatMap(Publisher, (events) => events.inventoryChanged());`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid:
      'export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) { this.seen.set(input.worktreeId, input.seenThrough); } }',
    invalid: `export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) {     if ((this.seen.get(input.worktreeId) ?? 0) > input.seenThrough) return;
    this.seen.set(input.worktreeId, input.seenThrough); } }`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();
  readonly saves: { worktreeId: string; seenThrough: number }[] = [];

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.saves.push(input);
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
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
    invalid: "import type { DirectoryEntry } from '@porcelain/files/models';",
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
    invalid:
      "import type { ProjectKey } from '../project.ts'; export type ProbeResult = ProjectKey | undefined; export function probeKey(projectId: string): ProjectKey { return { projectId }; }",
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
    errors: 1,
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
    rule: 'no-loose-equality-in-domain',
    path: 'packages/access/src/services/issue-pairing-service.ts',
    valid: 'if (value === undefined) throw new InvalidDeviceDetailsError();',
    invalid: '    if (value == null) throw new InvalidDeviceDetailsError();',
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
    invalid: `export async function fixture(input: Input, environmentId: string) {   const encoded = Buffer.from(secret).toString('base64url');
  return { id, secret, token: \`\${kind}_\${id}_\${encoded}\` }; }`,
    errors: 1,
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
    rule: 'one-clock',
    path: 'packages/git-actions/src/services/accept-git-action-service.ts',
    valid: 'export const acceptedAt = clock.now();',
    invalid:
      'export const acceptedAt = new Date(Date.parse(clock.now())).toISOString();',
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
    rule: 'spec-no-mocking',
    path: 'packages/reviews/src/services/mark-comments-seen-service.spec.ts',
    valid: `describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });
});
`,
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
    valid: `describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', () => {
    expect(seen.seenThrough({ worktreeId })).toBe(2);
  });
});
`,
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
    invalid:
      "export const theme = () => page.evaluateHandle('document.documentElement');",
    errors: 1,
  },
  {
    rule: 'use-case-imports',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `import { Effect } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(): Effect.Effect<
    ReadHealthResponse,
    MissingEnvironmentIdentityError
  > {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>
        Effect.gen({ self: this }, function* () {
          const { environmentId } = yield* this.readEnvironment.execute();
          return { status: 'ok' as const, environmentId };
        }),
      );
    });
  }
}
`,
    invalid: `import {
  readHealthResponseSchema,
  type ReadHealthResponse,
} from '@porcelain/contracts/access';
    export async function fixture(input: Input, environmentId: string) { const check = readHealthResponseSchema.parse;
    return check({ status: 'ok', environmentId }); }`,
    errors: 1,
  },
  {
    rule: 'use-case-imports',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `import { Effect } from 'effect';
import type { MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { LaneKeys } from '../../runtime/lane-keys.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;
  private readonly laneKeys: LaneKeys;

  constructor(
    readEnvironment: ReadEnvironmentService,
    lanes: Lanes,
    laneKeys: LaneKeys,
  ) {
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
    this.laneKeys = laneKeys;
  }

  execute(): Effect.Effect<
    ReadHealthResponse,
    MissingEnvironmentIdentityError
  > {
    return Effect.gen({ self: this }, function* () {
      return yield* this.lanes.run(this.laneKeys.access(), 'read', () =>
        Effect.gen({ self: this }, function* () {
          const { environmentId } = yield* this.readEnvironment.execute();
          return { status: 'ok' as const, environmentId };
        }),
      );
    });
  }
}
`,
    invalid: `import {
  readHealthResponseSchema,
  type ReadHealthResponse,
} from '@porcelain/contracts/access';
    export async function fixture(input: Input, environmentId: string) { const { parse: check } = readHealthResponseSchema;
    return check({ status: 'ok', environmentId }); }`,
    errors: 1,
  },
  {
    rule: 'use-case-input-is-contract',
    path: 'apps/server/src/use-cases/reviews/rule-fixture.ts',
    valid: `import { Effect } from 'effect';
import type {
  CommentAuthor,
  CreateCommentThreadRequest,
  CreateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CreateCommentThreadService } from '@porcelain/reviews/services';
export class CreateCommentThreadUseCase {
  private readonly createCommentThread: CreateCommentThreadService;

  constructor(createCommentThread: CreateCommentThreadService) {
    this.createCommentThread = createCommentThread;
  }

  execute(
    input: WorktreeParams & CreateCommentThreadRequest & CommentAuthor,
  ): Effect.Effect<CreateCommentThreadResponse, CreateCommentThreadError> {
    return this.createCommentThread.execute(input);
  }
}
`,
    invalid: `import { Effect } from 'effect';
import type { CreateCommentThreadResponse } from '@porcelain/contracts/reviews';
import type { CreateCommentThreadInput } from '@porcelain/reviews/models';
import type { CreateCommentThreadService } from '@porcelain/reviews/services';
export class CreateCommentThreadUseCase {
  private readonly createCommentThread: CreateCommentThreadService;

  constructor(createCommentThread: CreateCommentThreadService) {
    this.createCommentThread = createCommentThread;
  }

  execute(
    input: CreateCommentThreadInput,
  ): Effect.Effect<CreateCommentThreadResponse, CreateCommentThreadError> {
    return this.createCommentThread.execute(input);
  }
}
`,
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
    rule: 'web-no-empty-catch',
    path: 'apps/web/src/features/files/views/file-editor.tsx',
    valid:
      'export function read(run: () => void) { try { run(); } catch(error) { throw error; } }',
    invalid:
      'export function read(run: () => void) { try { run(); } catch {} }',
    errors: 1,
  },
  {
    rule: 'web-no-empty-catch',
    path: 'apps/web/src/features/access/queries/probe-query.ts',
    valid:
      'export function read(run: () => void) { try { run(); } catch(error) { throw error; } }',
    invalid:
      'export function read(run: () => void) { try { run(); } catch {} }',
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
    rule: 'spec-asserts',
    path: 'packages/projects/src/rules/read.spec.ts',
    valid:
      "import { it, expect } from 'vitest'; import { read } from './read.ts'; it('reads the exact result', () => { expect(read()).toEqual('read'); });",
    invalid:
      "import { it, expect } from 'vitest'; import { read } from './read.ts'; it('reads the exact result', () => { expect(read()); });",
    errors: 1,
  },
];

export default [...cases, ...effectRuleCases];

export const guardrailCases = [
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
  {
    rule: 'lane-per-table',
    files: {
      'packages/git-actions/src/ports/git-action-receipt-store.ts':
        "import { Context, type Effect } from 'effect'; export interface GitActionReceiptStore { claimExecution(): Effect.Effect<boolean>; } export const GitActionReceiptStore = Context.Service<'@porcelain/git-actions/GitActionReceiptStore', GitActionReceiptStore>('@porcelain/git-actions/GitActionReceiptStore');",
      'apps/server/src/runtime/lanes.ts':
        "import { Context, type Effect } from 'effect'; export class Lanes extends Context.Service<Lanes, { readonly commit: (key: string, work: () => Effect.Effect<boolean>) => Effect.Effect<boolean>; readonly run: (key: string, mode: string, work: () => Effect.Effect<boolean>) => Effect.Effect<boolean>; }>()('@porcelain/server/Lanes') {}",
      'apps/server/src/runtime/lane-keys.ts':
        "import { Context } from 'effect'; export class LaneKeys extends Context.Service<LaneKeys, { readonly receipts: () => string; readonly access: () => string; }>()('@porcelain/server/LaneKeys') {}",
    },
    valid: {
      'apps/server/src/runtime/git-action-workflow.ts':
        "import { Context, Effect, Layer } from 'effect'; import { GitActionReceiptStore } from '../../../../packages/git-actions/src/ports/git-action-receipt-store.ts'; import { Lanes } from './lanes.ts'; import { LaneKeys } from './lane-keys.ts'; export class GitActionWorkflow extends Context.Service<GitActionWorkflow, { readonly execute: () => Effect.Effect<boolean>; }>()('@porcelain/server/GitActionWorkflow') { static readonly layer = Layer.effect(GitActionWorkflow, Effect.gen(function* () { const receipts = yield* GitActionReceiptStore; const lanes = yield* Lanes; const keys = yield* LaneKeys; return { execute: Effect.fn('GitActionWorkflow.execute')(function* () { return yield* lanes.commit(keys.receipts(), () => receipts.claimExecution()); }), }; })); }",
    },
    invalid: {
      'apps/server/src/runtime/git-action-workflow.ts':
        "import { Context, Effect, Layer } from 'effect'; import { GitActionReceiptStore } from '../../../../packages/git-actions/src/ports/git-action-receipt-store.ts'; import { Lanes } from './lanes.ts'; import { LaneKeys } from './lane-keys.ts'; export class GitActionWorkflow extends Context.Service<GitActionWorkflow, { readonly execute: () => Effect.Effect<boolean>; }>()('@porcelain/server/GitActionWorkflow') { static readonly layer = Layer.effect(GitActionWorkflow, Effect.gen(function* () { const receipts = yield* GitActionReceiptStore; const lanes = yield* Lanes; const keys = yield* LaneKeys; return { execute: Effect.fn('GitActionWorkflow.execute')(function* () { return yield* lanes.commit(keys.access(), () => receipts.claimExecution()); }), }; })); }",
    },
    errors: ['lane-per-table'],
  },
  {
    rule: 'lane-mode-matches-service',
    files: {
      'packages/git-actions/src/ports/git-action-receipt-store.ts':
        "import { Context, type Effect } from 'effect'; export interface GitActionReceiptStore { claimExecution(): Effect.Effect<boolean>; } export const GitActionReceiptStore = Context.Service<'@porcelain/git-actions/GitActionReceiptStore', GitActionReceiptStore>('@porcelain/git-actions/GitActionReceiptStore');",
      'apps/server/src/runtime/lanes.ts':
        "import { Context, type Effect } from 'effect'; export class Lanes extends Context.Service<Lanes, { readonly commit: (key: string, work: () => Effect.Effect<boolean>) => Effect.Effect<boolean>; readonly run: (key: string, mode: string, work: () => Effect.Effect<boolean>) => Effect.Effect<boolean>; }>()('@porcelain/server/Lanes') {}",
      'apps/server/src/runtime/lane-keys.ts':
        "import { Context } from 'effect'; export class LaneKeys extends Context.Service<LaneKeys, { readonly receipts: () => string; readonly access: () => string; }>()('@porcelain/server/LaneKeys') {}",
    },
    valid: {
      'apps/server/src/runtime/git-action-workflow.ts':
        "import { Context, Effect, Layer } from 'effect'; import { GitActionReceiptStore } from '../../../../packages/git-actions/src/ports/git-action-receipt-store.ts'; import { Lanes } from './lanes.ts'; import { LaneKeys } from './lane-keys.ts'; export class GitActionWorkflow extends Context.Service<GitActionWorkflow, { readonly execute: () => Effect.Effect<boolean>; }>()('@porcelain/server/GitActionWorkflow') { static readonly layer = Layer.effect(GitActionWorkflow, Effect.gen(function* () { const receipts = yield* GitActionReceiptStore; const lanes = yield* Lanes; const keys = yield* LaneKeys; return { execute: Effect.fn('GitActionWorkflow.execute')(function* () { return yield* lanes.commit(keys.receipts(), () => receipts.claimExecution()); }), }; })); }",
    },
    invalid: {
      'apps/server/src/runtime/git-action-workflow.ts':
        "import { Context, Effect, Layer } from 'effect'; import { GitActionReceiptStore } from '../../../../packages/git-actions/src/ports/git-action-receipt-store.ts'; import { Lanes } from './lanes.ts'; import { LaneKeys } from './lane-keys.ts'; export class GitActionWorkflow extends Context.Service<GitActionWorkflow, { readonly execute: () => Effect.Effect<boolean>; }>()('@porcelain/server/GitActionWorkflow') { static readonly layer = Layer.effect(GitActionWorkflow, Effect.gen(function* () { const receipts = yield* GitActionReceiptStore; const lanes = yield* Lanes; const keys = yield* LaneKeys; return { execute: Effect.fn('GitActionWorkflow.execute')(function* () { return yield* lanes.run(keys.receipts(), 'read', () => receipts.claimExecution()); }), }; })); }",
    },
    errors: ['lane-mode-matches-service'],
  },
  {
    rule: 'no-undefined-union-result',
    valid: {
      'packages/projects/src/services/nested/read-label.ts':
        "import { Context, Effect, Layer } from 'effect'; export class ReadLabel extends Context.Service<ReadLabel, { readonly execute: (exists: boolean) => Effect.Effect<string> }>()('ReadLabel') { static readonly layer = Layer.succeed(ReadLabel, { execute: Effect.fn('ReadLabel.execute')(function* (exists: boolean) { if (!exists) return 'missing'; return 'label'; }) }); }",
    },
    invalid: {
      'packages/projects/src/services/nested/read-label.ts':
        "import { Context, Effect, Layer } from 'effect'; export class ReadLabel extends Context.Service<ReadLabel, { readonly execute: (exists: boolean) => Effect.Effect<string | undefined> }>()('ReadLabel') { static readonly layer = Layer.succeed(ReadLabel, { execute: Effect.fn('ReadLabel.execute')(function* (exists: boolean) { if (!exists) return undefined; return 'label'; }) }); }",
    },
    errors: ['no-undefined-union-result'],
  },
  {
    rule: 'models-file-shape',
    valid: {
      'packages/projects/src/models/nested/read-result.ts':
        "export type ReadResult = 'found' | 'missing';",
    },
    invalid: {
      'packages/projects/src/models/nested/read-result.ts':
        "type Missing = undefined; export type ReadResult = 'found' | Missing;",
    },
    errors: ['models-file-shape'],
  },
  {
    rule: 'lane-mode-matches-service',
    files: {
      'apps/server/src/ports/scheduled-task-runner.ts':
        "import {type Effect} from 'effect';\nexport interface ScheduledTaskRunner { execute(): Effect.Effect<void>; }",
      'packages/git-actions/src/ports/git-action-runner.ts':
        "import {type Effect} from 'effect';\nexport interface GitActionRunner { execute(): Effect.Effect<void>; }",
    },
    valid: {
      'apps/server/src/runtime/nested/schedule.ts':
        "import {Effect} from 'effect';\nimport {type ScheduledTaskRunner} from '../../ports/scheduled-task-runner.ts';\nexport const schedule = (task: ScheduledTaskRunner) => Effect.suspend(() => task.execute());",
    },
    invalid: {
      'apps/server/src/runtime/nested/schedule.ts':
        "import {Effect} from 'effect';\nimport {type GitActionRunner} from '../../../../../packages/git-actions/src/ports/git-action-runner.ts';\nexport const schedule = (task: GitActionRunner) => Effect.suspend(() => task.execute());",
    },
    errors: ['lane-mode-matches-service'],
  },
];
