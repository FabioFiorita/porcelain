import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { createMockStore, mockEnvironmentId } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import type { FileEdit } from '../domain/review';
import { createQueryClient } from './client';
import { retainedFileDrafts } from './file-drafts';
import { useEditFile } from './files';
import { queryKeys } from './keys';
import { useWorkspaceContext, WorkspaceProvider } from './workspace-provider';

/** A retained draft with nothing unsaved in it, as a move or trash sees one. */
const draft = () =>
  ({
    snapshot: () => ({ owner: null }),
    claim: () => {},
    release: () => {},
    save: async () => true,
  }) as never;

const scope = {
  projectId: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
  worktreeId: '629a86281cd6456281a29c05fba76b4b',
};

function ConnectionGate({ children }: { children: ReactNode }) {
  const { api, connection, beginConnection } = useWorkspaceContext();
  useEffect(() => {
    if (connection) return;
    const controller = new AbortController();
    void api.pairing
      .redeem({
        code: 'fixture-code',
        environmentId: mockEnvironmentId,
        signal: controller.signal,
      })
      .then((inventory) => beginConnection()?.(inventory));
    return () => controller.abort();
  }, [api, beginConnection, connection]);
  return connection ? children : <span>Connecting</span>;
}

/** Runs one edit and reports which query keys it asked to be read again. */
async function harnessFor() {
  const store = createMockStore();
  const api = createMockApi(store);
  const client = createQueryClient();
  const invalidated: string[] = [];
  const removed: string[] = [];
  const realInvalidate = client.invalidateQueries.bind(client);
  client.invalidateQueries = (filters) => {
    invalidated.push(JSON.stringify(filters?.queryKey));
    return realInvalidate(filters);
  };
  const realRemove = client.removeQueries.bind(client);
  client.removeQueries = (filters) => {
    removed.push(JSON.stringify(filters?.queryKey));
    return realRemove(filters);
  };
  let connection: object | undefined;
  let run: ((value: FileEdit) => Promise<unknown>) | undefined;
  function Harness() {
    const context = useWorkspaceContext();
    connection = context.connection ?? undefined;
    const write = useEditFile(scope);
    run = (value) => write.submit(value);
    return <span>ready</span>;
  }
  const screen = await render(
    <QueryClientProvider client={client}>
      <WorkspaceProvider api={api}>
        <ConnectionGate>
          <Harness />
        </ConnectionGate>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
  await expect.element(screen.getByText('ready')).toBeVisible();
  if (!run || !connection) throw new Error('Harness did not connect');
  const key = (surface: readonly unknown[]) =>
    JSON.stringify(queryKeys.reviewSurface(mockEnvironmentId, scope, surface));
  return {
    connection,
    key,
    invalidated,
    removed,
    /** Connecting invalidates things of its own; only the edit is measured. */
    async edit(input: FileEdit) {
      invalidated.length = 0;
      removed.length = 0;
      await run?.(input).catch(() => undefined);
    },
  };
}

describe('an edit reads back only what it changed', () => {
  it('reloads the written file and the change list, and nothing else', async () => {
    const harness = await harnessFor();
    await harness.edit({
      kind: 'write',
      path: 'README.md',
      text: 'next',
      expectedFingerprint: 'a'.repeat(64),
    });
    expect(new Set(harness.invalidated)).toEqual(
      new Set([harness.key(['changes']), harness.key(['text', 'README.md'])]),
    );
    // Diffs, layers, comments, history and artifacts say nothing about a save,
    // and neither does the list of names.
    expect(harness.invalidated).not.toContain(harness.key(['paths']));
  });

  it('reloads both folders once for a move, and forgets the old name', async () => {
    const harness = await harnessFor();
    const drafts = retainedFileDrafts(harness.connection);
    const held = draft();
    drafts.set(
      `${JSON.stringify([scope.projectId, scope.worktreeId])}/src/app.tsx`,
      held,
    );
    await harness.edit({
      kind: 'move',
      path: 'src/app.tsx',
      destination: 'src/renamed.tsx',
    });
    expect(new Set(harness.invalidated)).toEqual(
      new Set([
        harness.key(['changes']),
        harness.key(['directory', 'src']),
        harness.key(['paths']),
      ]),
    );
    // Both parents are the same folder here, and it is only read once.
    expect(
      harness.invalidated.filter(
        (entry) => entry === harness.key(['directory', 'src']),
      ),
    ).toHaveLength(1);
    expect(harness.removed).toContain(harness.key(['text', 'src/app.tsx']));
    // The draft went with the file rather than staying under the old name.
    const prefix = `${JSON.stringify([scope.projectId, scope.worktreeId])}/`;
    expect(drafts.has(`${prefix}src/app.tsx`)).toBe(false);
    expect(drafts.get(`${prefix}src/renamed.tsx`)).toBe(held);
  });

  it('reloads the parent for a trash, and drops the deleted file entirely', async () => {
    const harness = await harnessFor();
    const drafts = retainedFileDrafts(harness.connection);
    const prefix = `${JSON.stringify([scope.projectId, scope.worktreeId])}/`;
    drafts.set(`${prefix}src/app.tsx`, draft());
    await harness.edit({ kind: 'trash', path: 'src/app.tsx' });
    expect(new Set(harness.invalidated)).toEqual(
      new Set([
        harness.key(['changes']),
        harness.key(['directory', 'src']),
        harness.key(['paths']),
      ]),
    );
    expect(harness.removed).toContain(harness.key(['text', 'src/app.tsx']));
    // Nothing is kept for a file that is gone; recreating the name must not
    // hand back the old editor.
    expect(drafts.has(`${prefix}src/app.tsx`)).toBe(false);
  });

  it('reloads the containing folder for a create', async () => {
    const harness = await harnessFor();
    await harness.edit({
      kind: 'create',
      path: 'src/new.ts',
      entryKind: 'file',
    });
    expect(new Set(harness.invalidated)).toEqual(
      new Set([
        harness.key(['changes']),
        harness.key(['directory', 'src']),
        harness.key(['paths']),
      ]),
    );
    expect(harness.removed).toEqual([]);
  });
});
