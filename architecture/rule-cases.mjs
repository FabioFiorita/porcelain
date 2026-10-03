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

const healthRoute = `import { readHealthResponseSchema } from '@porcelain/contracts/access';
export function readHealth(
) {
  api.get(
    '/health',
    {
      schema: {
        response: { 200: readHealthResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  );
}`;

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

const separateWorktreeLanes = `export class MarkCommentsSeenUseCase {
  async execute(
  ): Promise<MarkCommentsSeenResponse> {
    const { changed, ...seen } = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => this.markCommentsSeen.execute(input),
    );
  }
}`;

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
  {
    rule: 'spec-asserts',
    path: 'apps/server/src/http/status-policy.spec.ts',
    valid:
      "it('should return 200', () => { expect(readHealth().status).toBe('ok'); });",
    invalid: "it('should return 200', () => { expect(true).toBe(true); });",
    errors: 2,
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
    valid: "import { createStore } from 'zustand/vanilla';",
    invalid: "import { create } from 'zustand';",
    errors: 1,
  },
  {
    rule: 'client-platform-through-ports',
    path: 'packages/client/src/features/access/store.ts',
    valid: "import { shallow } from 'zustand/vanilla/shallow';",
    invalid: "import { useShallow } from 'zustand/react/shallow';",
    errors: 1,
  },
  {
    rule: 'spec-imports',
    path: 'packages/client/src/features/access/commands/pairing.spec.ts',
    valid:
      "import { createAccessStore } from '@porcelain/client/access'; import type { Remote } from '@porcelain/client/access/rules'; import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';",
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
    rule: 'client-platform-through-ports',
    path: 'packages/client/src/features/access/store.ts',
    valid: "import { createStore } from 'zustand/vanilla';",
    invalid: "import { useEffect } from 'react';",
    errors: 1,
  },
  {
    rule: 'web-store-owns-zustand',
    path: 'apps/mobile/src/features/access/commands/pairing.ts',
    valid: "import { accessStore } from '../store';",
    invalid: "import { createStore } from 'zustand/vanilla';",
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
    rule: 'web-store-owns-zustand',
    path: 'packages/client/src/features/access/commands/pairing.ts',
    valid: "import { accessStore } from '../store';",
    invalid: "import { create } from 'zustand';",
    errors: 1,
  },
  {
    rule: 'web-queries-export-reads',
    path: 'packages/client/src/features/access/queries/environments.ts',
    valid:
      "import { queryOptions } from '@tanstack/react-query'; export const environmentQueryOptions = () => queryOptions({ queryKey: ['environments'], queryFn: () => [] });",
    invalid: 'export const defaultEnvironment = "local";',
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'packages/client/src/features/access/commands/pairing.ts',
    valid: "import { ConnectionError } from '@porcelain/client/transport';",
    invalid: "import { requestJson } from '@porcelain/client/transport';",
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
      'import { parsePairingLink } from "@porcelain/client/access/rules"; export const readCode = parsePairingLink;',
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
    rule: 'adapters-report-facts',
    path: 'apps/server/src/adapters/files/filesystem-directory-reader.ts',
    valid: filesystemDirectoryReader,
    invalid: `export class FilesystemDirectoryReader implements DirectoryReader {
  async list(
  ): Promise<DirectoryRead> {
    try {
      for await (const entry of await opendir(before.path, {
      })) {
        if (['.git'].includes(name)) continue;
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
    valid: 'lstat(join(full, options.gitDirectoryName));',
    invalid: `lstat(join(full, '.git'))`,
    errors: 1,
  },
  {
    rule: 'bootstrap-constructs-only',
    path: 'apps/server/src/bootstrap/main.ts',
    valid: 'export const application = composeApplication();',
    invalid: `
if (import.meta.main) await cli.run();
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
    rule: 'events-after-lane',
    path: 'apps/server/src/use-cases/git-actions/run-git-action.ts',
    valid: `export class RunGitActionUseCase {
  private runInBackground(worktree: Worktree, run: GitActionRun): void {
    this.lanes.background(
      this.laneKeys.receipts(worktree),
      ({ signal }) => this.settle(run, signal),
    );
  }
  private async settle(run: GitActionRun, signal: AbortSignal): Promise<void> {
    const ran = await this.runGitAction.execute(
      {
        changes: await this.targetChanges(run, signal),
    });
  }
  private async targetChanges(
  ): Promise<FileChange[]> {
    if (run.target.kind === 'unchecked') return [];
  }
}`,
    invalid: `export class RunGitActionUseCase {
  private runInBackground(worktree: Worktree, run: GitActionRun): void {
    this.lanes.background(
      this.laneKeys.receipts(worktree),
      ({ signal }) => this.settle(run, signal),
    );
  }
  private async settle(run: GitActionRun, signal: AbortSignal): Promise<void> {
    const ran = await this.runGitAction.execute(
      {
        changes: await this.targetChanges(run, signal),
    });
  }
  private async targetChanges(
  ): Promise<FileChange[]> {
    this.events.worktreeChanged({ worktreeId: run.worktreeId, change: 'git' });
    if (run.target.kind === 'unchecked') return [];
  }
}`,
    errors: 1,
  },
  {
    rule: 'events-after-lane',
    path: 'apps/server/src/use-cases/reviews/list-reviewed-layers.ts',
    valid: `export class ListReviewedLayersUseCase {
  constructor(
  ) {
    return this.lanes.runConsistent(
      this.laneKeys.reviews(worktree),
      worktree,
      async ({ signal }) => {
        const { paths: marked } = this.listReviewedLayerPaths.execute({
        });
      },
    );
  }
}`,
    invalid: `export class ListReviewedLayersUseCase {
  constructor(
  ) {
    return this.lanes.runConsistent(
      this.laneKeys.reviews(worktree),
      worktree,
      async ({ signal }) => {
        this.events.inventoryChanged();
        const { paths: marked } = this.listReviewedLayerPaths.execute({
        });
      },
    );
  }
}`,
    errors: 1,
  },
  {
    rule: 'events-after-lane',
    path: 'apps/server/src/use-cases/git-actions/run-git-action.ts',
    valid: `import type { GitActionRun } from '@porcelain/git-actions/models';
import type { InterruptGitActionService } from '@porcelain/git-actions/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RunGitActionUseCase {
  private readonly interruptGitAction: InterruptGitActionService;
  private readonly lanes: Lanes;
  private readonly events: EventPublisher;

  constructor(interruptGitAction: InterruptGitActionService, lanes: Lanes, events: EventPublisher) {
    this.interruptGitAction = interruptGitAction;
    this.lanes = lanes;
    this.events = events;
  }

  private failed(run: GitActionRun, error: unknown): Promise<void> {
    return this.lanes.finish(async () => this.abandon(run, error), {});
  }

  private abandon(run: GitActionRun, error: unknown): void {
    this.events.gitActionChanged(this.interruptGitAction.execute({ requestId: run.requestId }));
  }
}
`,
    invalid: `import type { GitActionRun } from '@porcelain/git-actions/models';
import type { InterruptGitActionService } from '@porcelain/git-actions/services';
import type { EventPublisher } from '../../ports/event-publisher.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class RunGitActionUseCase {
  private readonly interruptGitAction: InterruptGitActionService;
  private readonly lanes: Lanes;
  private readonly events: EventPublisher;

  constructor(interruptGitAction: InterruptGitActionService, lanes: Lanes, events: EventPublisher) {
    this.interruptGitAction = interruptGitAction;
    this.lanes = lanes;
    this.events = events;
  }

  private failed(run: GitActionRun, error: unknown): Promise<void> {
    return this.lanes.finish(async () => this.announceAbandon(run, error), {});
  }

  private announceAbandon(run: GitActionRun, error: unknown): void {
    this.events.gitActionChanged(this.interruptGitAction.execute({ requestId: run.requestId }));
    this.abandon(run, error);
  }

  private abandon(run: GitActionRun, error: unknown): void {
    this.events.gitActionChanged(this.interruptGitAction.execute({ requestId: run.requestId }));
  }
}
`,
    errors: 1,
  },
  {
    rule: 'events-from-use-cases',
    path: 'apps/server/src/runtime/live-updates/watch-worktrees.ts',
    valid: `import type {
  AnnounceWorktreeChangeUseCasePort,
  WorktreeChange,
} from '../../ports/announce-worktree-change-use-case-port.ts';

export class WatchWorktrees {
  private readonly announceWorktreeChange: AnnounceWorktreeChangeUseCasePort;

  constructor(announceWorktreeChange: AnnounceWorktreeChangeUseCasePort) {
    this.announceWorktreeChange = announceWorktreeChange;
  }

  private announceChange(change: WorktreeChange): void {
    void this.announceWorktreeChange.execute(change, {});
  }
}
`,
    invalid: `import type { EventPublisher } from '../../ports/event-publisher.ts';
import type {
  AnnounceWorktreeChangeUseCasePort,
  WorktreeChange,
} from '../../ports/announce-worktree-change-use-case-port.ts';

export class WatchWorktrees {
  private readonly announceWorktreeChange: AnnounceWorktreeChangeUseCasePort;

  constructor(announceWorktreeChange: AnnounceWorktreeChangeUseCasePort) {
    this.announceWorktreeChange = announceWorktreeChange;
  }

  private publish(events: EventPublisher, worktreeId: string): void {
    events.worktreeChanged({ worktreeId, change: 'git' });
  }

  private announceChange(change: WorktreeChange): void {
    void this.announceWorktreeChange.execute(change, {});
  }
}
`,
    errors: 1,
  },
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
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
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
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid:
      'export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) { this.seen.set(input.worktreeId, input.seenThrough); } }',
    invalid:
      'export class InMemoryCommentSeenStore { private readonly seen = new Map<string, number>(); write(input: {worktreeId: string; seenThrough: number}) {     const current = this.seen.get(input.worktreeId) ?? 0;\n    this.seen.set(\n      input.worktreeId,\n      current > input.seenThrough ? current : input.seenThrough,\n    ); } }',
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();
  saves: { worktreeId: string; seenThrough: number }[] = [];

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.saves = [...this.saves, input];
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
    errors: 2,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    const stored = this.seen.get(input.worktreeId);
    (stored === undefined || stored < input.seenThrough) &&
      this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();
  #count = 0;
  readonly #calls = new Map<string, number>();

  calls(): number {
    return this.#count + this.#calls.size;
  }

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.#count++;
    this.#calls.set(\`save:\${this.#count}\`, input.seenThrough);
    const stored = this.seen.get(input.worktreeId);
    stored === undefined && this.seen.set(input.worktreeId, input.seenThrough);
    stored ?? this.seen.set(input.worktreeId, input.seenThrough);
    [stored ?? 0]
      .filter((known) => known < input.seenThrough)
      .forEach(() => this.seen.set(input.worktreeId, input.seenThrough));
  }
}
`,
    errors: 5,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    [this.seen.get(input.worktreeId) ?? 0]
      .filter((stored) => stored < input.seenThrough)
      .forEach(() => this.seen.set(input.worktreeId, input.seenThrough));
  }
}
`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();
  private readonly counter = { calls: 0 };

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.counter.calls = input.seenThrough;
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.seen.get(input.worktreeId) ??
      this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();
  readonly #calls = new Map<string, number>();

  calls(): number {
    return this.#calls.size;
  }

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.#calls.set(\`save:\${this.seen.size}\`, input.seenThrough);
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
    errors: 1,
  },
  {
    rule: 'fakes-store',
    path: 'packages/reviews/spec/fakes/in-memory-comment-seen-store.ts',
    valid: commentSeenStore,
    invalid: `import type { CommentSeenStore } from '../../src/ports/comment-seen-store.ts';

export class InMemoryCommentSeenStore implements CommentSeenStore {
  private readonly seen = new Map<string, number>();
  #count = 0;

  calls(): number {
    return this.#count;
  }

  seenThrough(input: { worktreeId: string }): number {
    return this.seen.get(input.worktreeId) ?? 0;
  }

  save(input: { worktreeId: string; seenThrough: number }): void {
    this.#count++;
    this.seen.set(input.worktreeId, input.seenThrough);
  }
}
`,
    errors: 1,
  },
  {
    rule: 'feature-route-handler',
    path: 'apps/server/src/http/routes/git-actions/run-git-action.ts',
    valid:
      "import {statusPolicy} from '../../status-policy.ts'; api.post('/run', {schema}, (request, reply) => reply.code(statusPolicy(receipt)).send(options.useCase.execute(request.body, request.context)));",
    invalid: `
reply.code(statusOf(receipt))

function statusOf(receipt: { state: string }): number {
  return receipt.state === 'rejected' ? 409 : 200;
}
`,
    errors: 1,
  },
  {
    rule: 'feature-route-handler',
    path: 'apps/server/src/http/routes/access/clear-browser-session.ts',
    valid: `export function clearBrowserSession(
) {
  api.delete(
    '/session',
    {
    },
    async (request, reply) =>
      reply
        .code(204)
        .send(await options.useCase.execute({ signal: request.disconnected })),
  );
}`,
    invalid: `export function clearBrowserSession(
) {
  api.delete(
    '/session',
    {
    },
    async (_request, reply) => reply.code(204).send(),
  );
}`,
    errors: 1,
  },
  {
    rule: 'feature-route-handler',
    path: 'apps/server/src/http/routes/changes/read-changes.ts',
    valid: `export function readChanges(
) {
  api.get(
    '/worktrees/:worktreeId/changes',
    {
    },
    async (request) =>
      options.useCase.execute(request.params, {
        signal: request.disconnected,
      }),
  );
}`,
    invalid: `export function readChanges(
) {
  api.get(
    '/worktrees/:worktreeId/changes',
    {
    },
    async (request) => {
      const { worktreeId } = request.params;
      return options.useCase.execute(
        { worktreeId },
        { signal: request.disconnected },
      );
    },
  );
}`,
    errors: 1,
  },
  {
    rule: 'feature-route-registrations',
    path: 'apps/server/src/http/routes/changes/read-changes.ts',
    valid: `export function readChanges(
  server: FastifyInstance,
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes',
    {
    },
      options.useCase.execute(request.params, {
      }),
  );
}`,
    invalid: `export function readChanges(
  server: FastifyInstance,
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.addHook('preHandler', async () => undefined);
  api.get(
    '/worktrees/:worktreeId/changes',
    {
    },
      options.useCase.execute(request.params, {
      }),
  );
}`,
    errors: 1,
  },
  {
    rule: 'feature-route-registrations',
    path: 'apps/server/src/http/routes/changes/read-changes.ts',
    valid: `export function readChanges(
  server: FastifyInstance,
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes',
    {
      schema: {
        params: worktreeParamsSchema,
      },
    },
      options.useCase.execute(request.params, {
      }),
  );
}`,
    invalid: `export function readChanges(
  server: FastifyInstance,
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/worktrees/:worktreeId/changes',
    {
      preHandler: async () => undefined,
      schema: {
        params: worktreeParamsSchema,
      },
    },
      options.useCase.execute(request.params, {
      }),
  );
}`,
    errors: 1,
  },
  {
    rule: 'feature-route-shape',
    path: 'apps/server/src/http/routes/access/read-health.ts',
    valid: healthRoute,
    invalid: `import { readHealthResponseSchema } from '@porcelain/contracts/access';
export function readHealth(
) {
  const METHOD = 'get';
  api[METHOD](
    '/health',
    {
      schema: {
        response: { 200: readHealthResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  );
}`,
    errors: 1,
  },
  {
    rule: 'feature-route-shape',
    path: 'apps/server/src/http/routes/access/read-health.ts',
    valid: healthRoute,
    invalid: `import { readHealthResponseSchema } from '@porcelain/contracts/access';
export function readHealth(
) {
  api['get'](
    '/health',
    {
      schema: {
        response: { 200: readHealthResponseSchema },
      },
    },
    async (request) =>
      options.useCase.execute({ signal: request.disconnected }),
  );
}`,
    errors: 1,
  },
  {
    rule: 'feature-route-shape',
    path: 'apps/server/src/http/routes/access/read-health.ts',
    valid:
      "import {readHealthResponseSchema} from '@porcelain/contracts/access'; api.get('/health', {schema: {response: {200: readHealthResponseSchema}}}, async (request) => options.useCase.execute(request.context));",
    invalid: `options: { service: Pick<ReadHealthUseCase, 'execute'> }
options.service.execute({ signal: request.disconnected })`,
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
    rule: 'implementation-port',
    path: 'packages/storage/src/repositories/reviews/sqlite-comment-seen-store.ts',
    valid: `import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { CommentSeenStore } from '@porcelain/reviews/ports';

export class SqliteCommentSeenStore implements CommentSeenStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
}
`,
    invalid: `import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { CommentSeenStore, CommentStore } from '@porcelain/reviews/ports';

export class SqliteCommentSeenStore implements CommentSeenStore, CommentStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
}
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
    valid:
      'export type StatusSummary = { changed: number }; export interface StatusReader { read(): StatusSummary; }',
    invalid: 'export function readStatus(): number { return 0; }',
    errors: 1,
  },

  {
    rule: 'kernel-is-types',
    path: 'packages/kernel/src/models/worktree.ts',
    valid: "export type WorktreeCheck = {kind: 'found'; worktreeId: string};",
    invalid: `
export function worktreeFound(check: WorktreeCheck): boolean {
  return check.kind === 'found';
}
`,
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
    path: 'apps/server/src/http/routes/files/edit-file.ts',
    valid: `import type { FastifyInstance } from 'fastify';
import type { Limits } from '../../../config/limits.ts';
import type { EditFileUseCase } from '../../../use-cases/files/edit-file.ts';

export function editFile(
  server: FastifyInstance,
  options: {
    useCase: Pick<EditFileUseCase, 'execute'>;
    limits: Limits['http'];
  },
) {
  server.post(
    '/worktrees/:worktreeId/files',
    { bodyLimit: options.limits.editFileBodyBytes },
    async (request) => options.useCase.execute(request.body, {}),
  );
}
`,
    invalid: `import type { FastifyInstance } from 'fastify';
import { LIMITS } from '../../../config/limits.ts';
import type { EditFileUseCase } from '../../../use-cases/files/edit-file.ts';

export function editFile(
  server: FastifyInstance,
  options: { useCase: Pick<EditFileUseCase, 'execute'> },
) {
  server.post(
    '/worktrees/:worktreeId/files',
    { bodyLimit: LIMITS.http.editFileBodyBytes },
    async (request) => options.useCase.execute(request.body, {}),
  );
}
`,
    errors: 1,
  },
  {
    rule: 'mcp-tool-handler',
    path: 'apps/server/src/http/mcp/review-server.ts',
    valid: `export function createReviewMcpServer(
) {
  server.registerTool(
    'read_review',
    {
    },
    ({ cwd }, { signal }) =>
      result(readPublishedReviewResponseSchema, async () =>
        useCases.reviews.readPublishedReviewAtPath.execute(
        ),
      ),
  );
}`,
    invalid: `export function createReviewMcpServer(
) {
  server.registerTool(
    'read_review',
    {
    },
    ({ cwd }, { signal }) =>
      result(readPublishedReviewResponseSchema, async () =>
        useCases.reviews.readPublishedReviewAtPath.run(
        ),
      ),
  );
}`,
    errors: 2,
  },
  {
    rule: 'models-are-types',
    path: 'packages/projects/src/models/probe/probe-model.ts',
    valid:
      "import type {ProjectKey} from '../project.ts'; export type ProbeResult = ProjectKey | undefined;",
    invalid: `import type { ProjectKey } from '../project.ts';

export type ProbeResult = ProjectKey | undefined;

export function probeKey(projectId: string): ProjectKey {
  return { projectId };
}
`,
    errors: 1,
  },

  {
    rule: 'no-blocking-child-process',
    path: 'packages/process/src/commands/read-command.ts',
    valid: `import { spawn } from 'node:child_process';

export function startCommand(command: string, args: readonly string[]) {
  return spawn(command, [...args], { stdio: ['ignore', 'pipe', 'ignore'] });
}
`,
    invalid: `import { execFileSync } from 'node:child_process';

export function readCommand(command: string, args: readonly string[]): string {
  return execFileSync(command, args, { encoding: 'utf8' });
}
`,
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
    rule: 'no-nested-lane',
    path: 'apps/server/src/use-cases/reviews/mark-comments-seen.ts',
    valid: separateWorktreeLanes,
    invalid: `export class MarkCommentsSeenUseCase {
  async execute(
  ): Promise<MarkCommentsSeenResponse> {
    const { changed, ...seen } = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () => {
        await this.checkWorktree.execute(
          { worktreeId, requireAvailableProject: false },
          context,
        );
        return this.markCommentsSeen.execute(input);
      },
    );
  }
}`,
    errors: 1,
  },
  {
    rule: 'no-nested-lane',
    path: 'apps/server/src/use-cases/reviews/mark-comments-seen.ts',
    valid: separateWorktreeLanes,
    invalid: `export class MarkCommentsSeenUseCase {
  async execute(
  ): Promise<MarkCommentsSeenResponse> {
    const { changed, ...seen } = await this.lanes.run(
      this.laneKeys.reviews(worktree),
      'write',
      async () =>
        this.lanes.run(this.laneKeys.reviews(worktree), 'write', async () =>
          this.markCommentsSeen.execute(input),
        ),
    );
  }
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
      "import type {OperationContext} from '../../ports/operation-context.ts'; export class ProbeEnvUseCase { constructor(private readonly reader: EnvironmentReader) {} execute(context: OperationContext): Promise<string> { return this.reader.read(context.signal); } }",
    invalid: `import type { OperationContext } from '../../ports/operation-context.ts';

export class ProbeEnvUseCase {
  async execute(context: OperationContext): Promise<string> {
    const fs = process.getBuiltinModule('node:fs');
    return fs.readFileSync(\`\${process.env.HOME ?? ''}/.gitconfig\`, 'utf8');
  }
}
`,
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
    valid: `export class ClaudeProvider implements Provider {
  async answer(
  ): Promise<unknown> {
    try {
      const output = await runProvider(
        {
          maxBytes: this.limits.claudeOutputBytes,
        },
      );
    } finally {
    }
  }
}`,
    invalid: `export class ClaudeProvider implements Provider {
  async answer(
  ): Promise<unknown> {
    try {
      const output = await runProvider(
        {
          maxBytes: 1024 * 1024,
        },
      );
    } finally {
    }
  }
}`,
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
    path: 'packages/process/src/commands/run-command.ts',
    valid: 'await delay(options.pollIntervalMs);',
    invalid: `await delay(10);`,
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
    invalid: `export class FilesystemDirectoryReader implements DirectoryReader {
  async list(
  ): Promise<DirectoryRead> {
    try {
      for await (const entry of await opendir(before.path, {
      })) {
        if (found.length >= 2000) {
        }
      }
    } catch (error) {
    }
  }
}`,
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
    rule: 'no-schema-parse-aliases',
    path: 'packages/files/src/rules/encode-base64.ts',
    valid:
      'export function byteLength(value: Uint8Array) { return value.byteLength; }',
    invalid: `
export function probeParser(value: object): unknown {
  return Reflect.get(value, "safeParse");
}
`,
    errors: 1,
  },
  {
    rule: 'no-schema-parse-in-typed-code',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: `import type { ListDirectoryInput } from '../models/list-directory.ts';

export class ListDirectoryService {
  execute(input: ListDirectoryInput): string {
    return input.path;
  }
}
`,
    invalid: `import { z } from 'zod/v4';
import type { ListDirectoryInput } from '../models/list-directory.ts';

export class ListDirectoryService {
  execute(input: ListDirectoryInput): string {
    z.string().parse(input.path);
    return input.path;
  }
}
`,
    errors: 1,
  },
  {
    rule: 'no-undefined-union-result',
    path: 'packages/git-actions/src/services/read-interrupted-git-action-service.ts',
    valid: `import type {
  ReadInterruptedGitActionInput,
  ReadInterruptedGitActionResult,
} from '../models/read-interrupted-git-action.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadInterruptedGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;

  constructor(gitActionReceipts: GitActionReceiptStore) {
    this.gitActionReceipts = gitActionReceipts;
  }

  execute(input: ReadInterruptedGitActionInput): ReadInterruptedGitActionResult {
    const receipt = this.gitActionReceipts.latestInterrupted(input);
    return receipt
      ? { kind: 'interrupted', receipt: gitActionReceiptView(receipt) }
      : { kind: 'none' };
  }
}
`,
    invalid: `import type { GitActionReceiptView } from '../models/git-action-receipt-view.ts';
import type { ReadInterruptedGitActionInput } from '../models/read-interrupted-git-action.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadInterruptedGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;

  constructor(gitActionReceipts: GitActionReceiptStore) {
    this.gitActionReceipts = gitActionReceipts;
  }

  execute(input: ReadInterruptedGitActionInput): GitActionReceiptView | undefined {
    const receipt = this.gitActionReceipts.latestInterrupted(input);
    return receipt && gitActionReceiptView(receipt);
  }
}
`,
    errors: 1,
  },
  {
    rule: 'no-void-statement',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid: `export class ListDirectoryService {
  async execute(
  ): Promise<ListDirectoryResult> {
    const read = await this.directoryReader.list(
    );
  }
}`,
    invalid: `export class ListDirectoryService {
  async execute(
  ): Promise<ListDirectoryResult> {
    void signal;
    const read = await this.directoryReader.list(
    );
  }
}`,
    errors: 1,
  },
  {
    rule: 'one-clock',
    path: 'packages/git-actions/src/services/accept-git-action-service.ts',
    valid: `export class AcceptGitActionService {
  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    const receipt: GitActionReceipt = {
      acceptedAt: this.clock.now(),
    }
  }
}`,
    invalid: `export class AcceptGitActionService {
  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    const receipt: GitActionReceipt = {
      acceptedAt: new Date(Date.parse(this.clock.now())).toISOString(),
    }
  }
}`,
    errors: 2,
  },
  {
    rule: 'operation-class-members',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid:
      "export class ReadHealthUseCase { execute(context: OperationContext): ReadHealthResponse { return { status: 'ok', environmentId: context.environmentId }; } }",
    invalid:
      "export async function fixture(input: Input, environmentId: string) {         return new HealthReply(\n          this.readEnvironment.execute().environmentId,\n        ).body();\n\nclass HealthReply {\n  private readonly environmentId: string;\n\n  constructor(environmentId: string) {\n    this.environmentId = environmentId;\n  }\n\n  body(): ReadHealthResponse {\n    return { status: 'ok', environmentId: this.environmentId };\n  }\n}\n }",
    errors: 1,
  },
  {
    rule: 'operation-class-members',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(readEnvironment: ReadEnvironmentService) {
    this.readEnvironment = readEnvironment;
  }

  async execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.respond(this.readEnvironment.execute().environmentId);
  }

  private respond(environmentId: string): ReadHealthResponse {
    return { status: 'ok', environmentId };
  }
}
`,
    invalid: `import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(readEnvironment: ReadEnvironmentService) {
    this.readEnvironment = readEnvironment;
  }

  async execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.respond(this.readEnvironment.execute().environmentId);
  }

  private readonly respond = (environmentId: string): ReadHealthResponse => ({
    status: 'ok',
    environmentId,
  });
}
`,
    errors: 1,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/projects/collect-absent-worktrees.ts',
    valid:
      'export class CollectAbsentWorktreesUseCase { execute(context: OperationContext): Promise<CollectAbsentWorktreesResult> { return this.listExpiredWorktrees.execute(context); } }',
    invalid:
      'export class CollectAbsentWorktreesUseCase { execute(input: Input): Promise<Result> { return this.listExpiredWorktrees.execute(input); } }',
    errors: 1,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/projects/collect-absent-worktrees.ts',
    valid:
      'export class CollectAbsentWorktreesUseCase { execute(context: OperationContext): Promise<CollectAbsentWorktreesResult> { return this.listExpiredWorktrees.execute(context); } }',
    invalid:
      'export class CollectAbsentWorktreesUseCase { execute(input: Input): Promise<Result> { return this.listExpiredWorktrees.execute(input); } }',
    errors: 1,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;
  private readonly lanes: Lanes;

  constructor(readEnvironment: ReadEnvironmentService, lanes: Lanes) {
    this.readEnvironment = readEnvironment;
    this.lanes = lanes;
  }

  execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.lanes.run('access', 'read', async () => {
      const { environmentId } = this.readEnvironment.execute();
      return { status: 'ok', environmentId };
    }, { callerSignal: context.signal });
  }
}
`,
    invalid: `import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { OperationContext } from '../../ports/operation-context.ts';
import type { Lanes } from '../../runtime/lanes.ts';

export class ReadHealthUseCase {
  private readEnvironmentService: ReadEnvironmentService;
  private readonly lanes: Lanes;

  constructor(readEnvironment: ReadEnvironmentService, lanes: Lanes) {
    this.readEnvironmentService = readEnvironment;
    this.lanes = lanes;
  }

  execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.lanes.run('access', 'read', async () => {
      const { environmentId } = this.readEnvironmentService.execute();
      return { status: 'ok', environmentId };
    }, { callerSignal: context.signal });
  }
}
`,
    errors: 1,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `export class ReadHealthUseCase {
  execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => {
        const { environmentId } = this.readEnvironment.execute();
        return { status: 'ok', environmentId };
      },
      { callerSignal: context.signal },
    );
  }
}`,
    invalid: `export class ReadHealthUseCase {
  readonly execute = (
    context: OperationContext,
  ): Promise<ReadHealthResponse> =>
    this.lanes.run(
      this.laneKeys.access(),
      'read',
      async () => {
        const { environmentId } = this.readEnvironment.execute();
        return { status: 'ok', environmentId };
      },
      { callerSignal: context.signal },
    );
}`,
    errors: 2,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { OperationContext } from '../../ports/operation-context.ts';

export class ReadHealthUseCase {
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(readEnvironment: ReadEnvironmentService) {
    this.readEnvironment = readEnvironment;
  }

  async execute(context: OperationContext): Promise<ReadHealthResponse> {
    const { environmentId } = this.readEnvironment.execute();
    return { status: 'ok', environmentId };
  }
}
`,
    invalid: `import type { ReadEnvironmentService } from '@porcelain/access/services';
import type { ReadHealthResponse } from '@porcelain/contracts/access';
import type { OperationContext } from '../../ports/operation-context.ts';
import { Operation } from '../../runtime/operation.ts';

export class ReadHealthUseCase extends Operation<ReadHealthResponse> {
  private readonly readEnvironment: ReadEnvironmentService;

  constructor(readEnvironment: ReadEnvironmentService) {
    super();
    this.readEnvironment = readEnvironment;
  }

  protected async run(context: OperationContext): Promise<ReadHealthResponse> {
    const { environmentId } = this.readEnvironment.execute();
    return { status: 'ok', environmentId };
  }
}
`,
    errors: 1,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid:
      "export class HealthReader { execute(context: OperationContext): ReadHealthResponse { return {status: 'ok', environmentId: context.environmentId}; } }",
    invalid:
      'export class HealthReader { read(context: OperationContext): ReadHealthResponse { return {status: "ok", environmentId: context.environmentId}; } }',
    errors: 2,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `export class ReadHealthUseCase {
  execute(context: OperationContext): Promise<ReadHealthResponse> {
  }
}`,
    invalid: `export class ReadHealthUseCase {
  executeForOwner(context: OperationContext): Promise<ReadHealthResponse> {
    return this.execute(context);
  }

  execute(context: OperationContext): Promise<ReadHealthResponse> {
  }
}`,
    errors: 1,
  },
  {
    rule: 'operation-class-shape',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid: `export class ReadHealthUseCase {
  execute(context: OperationContext): Promise<ReadHealthResponse> {
    return this.lanes.run(
    );
  }
}`,
    invalid: `export class ReadHealthUseCase {
  execute(context: OperationContext): Promise<ReadHealthResponse>;
  execute(
    context: OperationContext,
    verbose: boolean,
  ): Promise<ReadHealthResponse>;
  execute(
    context: OperationContext,
    verbose?: boolean,
  ): Promise<ReadHealthResponse> {
    if (verbose)
      return Promise.resolve({ status: 'ok', environmentId: 'verbose' });
    return this.lanes.run(
    );
  }
}`,
    errors: 1,
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
    context: OperationContext,
  ): Promise<ListedWorktree>;
}`,
    invalid: `export interface CheckWorktreeUseCasePort {
  execute(
    input: CheckWorktreeInput,
    context: OperationContext,
  ): Promise<ListedWorktree>;
  refresh(input: CheckWorktreeInput, context: OperationContext): Promise<void>;
}`,
    errors: 1,
  },
  {
    rule: 'port-shape',
    path: 'apps/server/src/ports/notice-port.ts',
    valid: 'export interface NoticeWriter { send(input: NoticeInput): void; }',
    invalid: `export interface NoticePort {
  send(worktreeId: string, kind: string, revision: number): void;
}
`,
    errors: 2,
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
    errors: 1,
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
      "import {z} from 'zod'; process.stdout.write(z.string().parse('value'));",
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
    valid: `export async function pairedScope(
  server: FastifyInstance,
) {
  server.addHook(
    authenticate(options.application, {
      cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
    }),
  );
  server.register(runGitAction, {
  });
}`,
    invalid: `export async function pairedScope(
  server: FastifyInstance,
) {
  server.addHook(
    authenticate(options.application, {
      cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
    }),
  );
  server.get('/debug/lanes', async () => ({ ok: true }));
  server.register(runGitAction, {
  });
}`,
    errors: 1,
  },
  {
    rule: 'signals-are-passed',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid:
      'export class ListDirectoryService { constructor(private readonly reader: DirectoryReader) {} execute(input: DirectoryInput, signal?: AbortSignal) { return this.reader.read(input, signal); } }',
    invalid: `    const { aborted } = signal ?? { aborted: false };
    if (aborted) throw new DirectoryTooLargeError();
    if (read.kind === 'failed') throw this.failure(read.failure);`,
    errors: 1,
  },
  {
    rule: 'signals-are-passed',
    path: 'packages/files/src/services/list-directory-service.ts',
    valid:
      'export class ListDirectoryService { constructor(private readonly reader: DirectoryReader) {} execute(input: DirectoryInput, signal?: AbortSignal) { return this.reader.read(input, signal); } }',
    invalid: `    signal?.throwIfAborted();
    if (read.kind === 'failed') throw this.failure(read.failure);`,
    errors: 1,
  },
  {
    rule: 'signals-are-passed',
    path: 'apps/server/src/use-cases/changes/read-changes.ts',
    valid: `export class ReadChangesUseCase {
  constructor(
  ) {
    return this.lanes.runConsistent<ReadChangesResponse>(
    );
  }
}`,
    invalid: `export class ReadChangesUseCase {
  constructor(
  ) {
    context.signal?.throwIfAborted();
    return this.lanes.runConsistent<ReadChangesResponse>(
    );
  }
}`,
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
    invalid: `import { describe, expect, it } from 'vitest';
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
    expect(remoteLink('http://192.0.2.10:4738/pair#c=b&e=env')).toEqual({
      address: 'http://192.0.2.10:4738',
      code: 'b',
      environmentId: 'env',
    });
  });
});
`,
    errors: 1,
  },
  {
    rule: 'spec-asserts',
    path: 'apps/web/src/features/access/rules/remotes.spec.ts',
    valid: `import { describe, expect, it } from 'vitest';
import { remoteLink } from './remotes.ts';

describe('remoteLink', () => {
  it('reads the address, code and environment of a pairing link', () => {
    expect(remoteLink('http://192.0.2.10:4738/pair#c=a&e=env')).toEqual({
      address: 'http://192.0.2.10:4738',
      code: 'a',
      environmentId: 'env',
    });
  });
});
`,
    invalid: `import { describe, expect, it } from 'vitest';
import { remoteLink } from './remotes.ts';

describe('remoteLink', () => {
  it('reads the address, code and environment of a pairing link', () => {
    expect(remoteLink('http://192.0.2.10:4738/pair#c=a&e=env')).toEqual({
      address: 'http://192.0.2.10:4738',
      code: 'a',
      environmentId: 'env',
    });
  });

  it('reads the same link the same way again', () => {
    expect(remoteLink('http://192.0.2.10:4738/pair#c=a&e=env')).toEqual({
      ...remoteLink('http://192.0.2.10:4738/pair#c=a&e=env'),
    });
  });
});
`,
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
      'export class FindWorktreeByPathUseCase { execute(input: FindWorktreeInput, context: OperationContext) { return this.findWorktree.execute(input, context.signal); } }',
    invalid:
      "import { NoWorktreeAtPathError } from '@porcelain/projects/errors';\n\n    export async function fixture(input: Input, environmentId: string) { if (input.path === '') return Promise.reject(new NoWorktreeAtPathError());\n    await this.refreshInventory.execute(context); }",
    errors: 2,
  },
  {
    rule: 'use-case-computes',
    path: 'apps/server/src/use-cases/changes/read-change-lines.ts',
    valid: `import type { ReadChangeLinesService } from '@porcelain/changes/services';
import type { ReadChangeLinesQuery } from '@porcelain/contracts/changes';

export class ReadChangeLinesUseCase {
  private readonly readChangeLines: ReadChangeLinesService;

  constructor(readChangeLines: ReadChangeLinesService) {
    this.readChangeLines = readChangeLines;
  }

  execute(input: ReadChangeLinesQuery & { text: string }) {
    const { path, from, to, at, text } = input;
    return this.readChangeLines.execute({ path, from, to, at, text });
  }
}
`,
    invalid: `import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type { ReadChangeLinesService } from '@porcelain/changes/services';
import type { ReadChangeLinesQuery } from '@porcelain/contracts/changes';

export class ReadChangeLinesUseCase {
  private readonly readChangeLines: ReadChangeLinesService;

  constructor(readChangeLines: ReadChangeLinesService) {
    this.readChangeLines = readChangeLines;
  }

  execute(input: ReadChangeLinesQuery & { text: string }) {
    const { path, from, to, at, text } = input;
    if (from > to) throw new InvalidLineRangeError();
    return this.readChangeLines.execute({ path, from, to, at, text });
  }
}
`,
    errors: 2,
  },
  {
    rule: 'use-case-imports',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid:
      "import type {ReadHealthResponse} from '@porcelain/contracts/access'; export class ReadHealthUseCase { execute(context: OperationContext): ReadHealthResponse { return {status: 'ok', environmentId: context.environmentId}; } }",
    invalid:
      "import {\n  readHealthResponseSchema,\n  type ReadHealthResponse,\n} from '@porcelain/contracts/access';\n    export async function fixture(input: Input, environmentId: string) { const check = readHealthResponseSchema.parse;\n    return check({ status: 'ok', environmentId }); }",
    errors: 1,
  },
  {
    rule: 'use-case-imports',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid:
      "import type {ReadHealthResponse} from '@porcelain/contracts/access'; export class ReadHealthUseCase { execute(context: OperationContext): ReadHealthResponse { return {status: 'ok', environmentId: context.environmentId}; } }",
    invalid:
      "import {\n  readHealthResponseSchema,\n  type ReadHealthResponse,\n} from '@porcelain/contracts/access';\n    export async function fixture(input: Input, environmentId: string) { const { parse: check } = readHealthResponseSchema;\n    return check({ status: 'ok', environmentId }); }",
    errors: 1,
  },
  {
    rule: 'use-case-imports',
    path: 'apps/server/src/use-cases/access/read-health.ts',
    valid:
      "import type {ReadHealthResponse} from '@porcelain/contracts/access'; export class ReadHealthUseCase { execute(context: OperationContext): ReadHealthResponse { return {status: 'ok', environmentId: context.environmentId}; } }",
    invalid:
      "import {\n  readHealthResponseSchema,\n  type ReadHealthResponse,\n} from '@porcelain/contracts/access';\n    export async function fixture(input: Input, environmentId: string) { const decoded = readHealthResponseSchema.safeDecode({ status: 'ok', environmentId });\n    return decoded.success ? decoded.data : { status: 'ok', environmentId }; }",
    errors: 1,
  },
  {
    rule: 'use-case-input-is-contract',
    path: 'apps/server/src/use-cases/reviews/rule-fixture.ts',
    valid: `import type {
  CommentAuthor,
  CreateCommentThreadRequest,
  CreateCommentThreadResponse,
} from '@porcelain/contracts/reviews';
import type { WorktreeParams } from '@porcelain/contracts/shared';
import type { CreateCommentThreadService } from '@porcelain/reviews/services';
import type { OperationContext } from '../../ports/operation-context.ts';

export class CreateCommentThreadUseCase {
  private readonly createCommentThread: CreateCommentThreadService;

  constructor(createCommentThread: CreateCommentThreadService) {
    this.createCommentThread = createCommentThread;
  }

  async execute(
    input: WorktreeParams & CreateCommentThreadRequest & CommentAuthor,
    context: OperationContext,
  ): Promise<CreateCommentThreadResponse> {
    return this.createCommentThread.execute(input);
  }
}
`,
    invalid: `import type { CreateCommentThreadResponse } from '@porcelain/contracts/reviews';
import type { CreateCommentThreadInput } from '@porcelain/reviews/models';
import type { CreateCommentThreadService } from '@porcelain/reviews/services';
import type { OperationContext } from '../../ports/operation-context.ts';

export class CreateCommentThreadUseCase {
  private readonly createCommentThread: CreateCommentThreadService;

  constructor(createCommentThread: CreateCommentThreadService) {
    this.createCommentThread = createCommentThread;
  }

  async execute(
    input: CreateCommentThreadInput,
    context: OperationContext,
  ): Promise<CreateCommentThreadResponse> {
    return this.createCommentThread.execute(input);
  }
}
`,
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'apps/web/src/features/access/queries/probe-query.ts',
    valid:
      "import {pairingApi} from '../api'; export const pairingQuery = () => pairingApi.read();",
    invalid: `import { requestJson } from '@/shared/api/request';

export const probeRequest = requestJson;
`,
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'apps/web/src/features/access/commands/pairing.ts',
    valid: "import { RequestError } from '@porcelain/client/transport';",
    invalid:
      "import { requestJson as read } from '@porcelain/client/transport';",
    errors: 1,
  },
  {
    rule: 'web-api-owns-request',
    path: 'apps/mobile/src/features/access/views/access-screen.tsx',
    valid:
      "import {useEnvironments} from '@porcelain/client/access'; export const Screen = () => <Text>{useEnvironments().length}</Text>;",
    invalid: "import * as client from '@porcelain/client/transport';",
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
  {
    rule: 'web-no-empty-catch',
    path: 'apps/web/src/features/files/views/file-editor.tsx',
    valid: 'export function probeEditor(run: () => void) { run(); }',
    invalid: `
export function probeSwallow(run: () => void) {
  try {
    run();
  } catch {}
}
`,
    errors: 1,
  },
  {
    rule: 'web-no-empty-catch',
    path: 'apps/web/src/features/access/queries/probe-query.ts',
    valid:
      'export function probeRead(run: () => void) { try { run(); } catch(error) { throw error; } }',
    invalid: `export function probeSwallow(run: () => void) {
  try {
    run();
  } catch {}
}
`,
    errors: 1,
  },
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
      "import {queryOptions} from '@tanstack/react-query'; export const pairingQueryOptions = () => queryOptions({queryKey: ['pairing'], queryFn: () => 'paired'});",
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
  {
    rule: 'web-rules-are-pure',
    path: 'apps/web/src/features/access/rules/probe-rule.ts',
    valid: 'export const probeLabel = (value: string) => value.trim();',
    invalid: `import { useState } from 'react';

export const probeHook = useState;
`,
    errors: 1,
  },
  {
    rule: 'web-rules-are-pure',
    path: 'apps/web/src/features/access/rules/probe-rule.ts',
    valid: 'export const probeWidth = (width: number) => width;',
    invalid: `export function probeWidth() {
  return window.innerWidth;
}
`,
    errors: 1,
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
    rule: 'web-store-owns-zustand',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid:
      "import {useAccessStore} from '../store'; export const ProbeView = () => <p>{useAccessStore().open}</p>;",
    invalid: `import { create } from 'zustand';

export const probeStore = create(() => ({ open: false }));
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
  {
    rule: 'web-views-no-promise-chains',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeSave(save: () => void) { save(); }',
    invalid: `export function probeSave(save: () => Promise<void>) {
  void save().catch(() => undefined);
}
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-promise-chains',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeSave(save: () => void) { save(); }',
    invalid: `export function probeSave(save: () => Promise<void>) {
  void save()['then'](() => undefined);
}
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-promise-chains',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeSave(save: () => void) { save(); }',
    invalid: `export function probeSave(save: () => Promise<void>) {
  void save().finally(() => undefined);
}
`,
    errors: 1,
  },
  {
    rule: 'web-views-no-promise-chains',
    path: 'apps/web/src/features/access/views/probe-view.tsx',
    valid: 'export function probeSave(save: () => void) { save(); }',
    invalid: `export function probeSave(save: () => Promise<void>) {
  void save().then(() => undefined);
}
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
    required: [
      ['drizzle-kit', 'check'],
      ['node', 'scripts/check-migrations.ts'],
    ],
    valid: 'drizzle-kit check && node "./scripts/check-migrations.ts"',
    invalid: 'drizzle-kit check',
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
