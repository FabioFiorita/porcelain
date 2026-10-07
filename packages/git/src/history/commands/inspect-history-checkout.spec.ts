import { NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  confirmHistoryCheckout,
  inspectHistoryCheckout,
} from './inspect-history-checkout.ts';

let root: string;
let checkout: Parameters<typeof confirmHistoryCheckout>[0];

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-history-checkout-'));
  execFileSync('git', ['init', '-q', '-b', 'main', root]);
  const directory = join(root, '.git');
  const info = statSync(directory, { bigint: true });
  const identity = `${info.dev}:${info.ino}:${info.birthtimeNs}`;
  checkout = {
    path: root,
    commonDirectory: directory,
    administrativeDirectory: directory,
    metadataIdentity: identity,
    repositoryIdentity: identity,
  };
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const refusal = () =>
  Effect.runPromise(
    Effect.flip(confirmHistoryCheckout(checkout)).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );

const snapshot = () =>
  Effect.runPromise(
    inspectHistoryCheckout(checkout, Buffer.from('git version')).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );

describe('history checkout', () => {
  it('reports the shallow boundary and changes the graph when it changes', async () => {
    const full = await snapshot();
    expect(full.shallow).toBe(false);
    writeFileSync(join(root, '.git', 'shallow'), `${'1'.repeat(40)}\n`);
    const shallow = await snapshot();
    expect(shallow.shallow).toBe(true);
    expect(shallow.graph).not.toBe(full.graph);
  });

  it('refuses a repository that replaced the recorded checkout', async () => {
    renameSync(join(root, '.git'), join(root, 'previous.git'));
    execFileSync('git', ['init', '-q', '-b', 'main', root]);
    expect(await refusal()).toMatchObject({
      name: 'HistoryWorktreeUnavailableError',
    });
  });

  it('reports missing checkout metadata as an unavailable worktree', async () => {
    rmSync(join(root, '.git'), { recursive: true });
    expect(await refusal()).toMatchObject({
      name: 'HistoryWorktreeUnavailableError',
    });
  });
});
