import { readGitStatus, readCurrentGitStatus } from '@porcelain/client/changes';
import { useAtomValue, useAtomSet, useAtomRefresh } from '@effect/atom-react';
import { Atom, AsyncResult } from 'effect/reactivity';
import type { ReadGitStatusResponse } from '@porcelain/contracts/changes';
import type { ChangesScope } from '@porcelain/client/changes/rules';
import type { Connection } from '@/shared/workspace/connection';

const inactiveStatus = Atom.make<
  AsyncResult.AsyncResult<ReadGitStatusResponse>
>(AsyncResult.initial());

export function useGitStatus(
  scope: ChangesScope,
  connection: Connection,
  enabled = true,
) {
  const state = readGitStatus({ connection, scope });
  return {
    result: useAtomValue(enabled ? state : inactiveStatus),
    read: useAtomSet(readCurrentGitStatus({ connection, scope }), {
      mode: 'promise',
    }),
    refresh: useAtomRefresh(enabled ? state : inactiveStatus),
  };
}
