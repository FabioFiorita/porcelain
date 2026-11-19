import { useMountedRead } from '@/shared/query/mounted-read';
import { Option } from 'effect';
import { Atom, AsyncResult } from 'effect/reactivity';
import { readCommit } from '@porcelain/client/history';
import { useConfirmedRead } from '@/shared/query/confirmed-read';
import type { HistoryScope } from '@porcelain/client/history/rules';
import type { Connection } from '@/shared/workspace/connection';

export function useCommit(
  connection: Connection,
  scope: HistoryScope,
  oid: string,
  parent = 1,
) {
  return useConfirmedRead(readCommit({ connection, scope, oid, parent })).value;
}

const inactiveCommit = Atom.make(
  AsyncResult.initial<
    Atom.Success<ReturnType<typeof readCommit>>,
    Atom.Failure<ReturnType<typeof readCommit>>
  >(),
);

export function useCommitSubject(
  connection: Connection,
  scope: HistoryScope,
  oid: string,
  active: boolean,
) {
  const result = useMountedRead(
    active ? readCommit({ connection, scope, oid, parent: 1 }) : inactiveCommit,
  );
  return (
    result && Option.getOrUndefined(AsyncResult.value(result))?.commit.subject
  );
}
