import type { CommitRef } from '@porcelain/client/history/rules';

const refKinds = {
  'local-branch': 'Branch',
  'remote-branch': 'Remote branch',
  tag: 'Tag',
  head: 'HEAD',
} satisfies Record<CommitRef['kind'], string>;

export function commitRefLabel(ref: CommitRef) {
  return ref.kind === 'head' ? ref.name : `${refKinds[ref.kind]} ${ref.name}`;
}
