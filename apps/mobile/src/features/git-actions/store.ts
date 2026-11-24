import { Atom } from 'effect/reactivity';
import { watchNetworkSuccesses } from '@porcelain/client/git-actions';
import { remoteConnectionState } from '../../shared/application/store';
import { notify } from '../../shared/application/notify';

const connections = remoteConnectionState.map((entries) =>
  entries.map((entry) => entry.connection),
);

export const gitSuccessNotices = Atom.make((get) => {
  get.addFinalizer(
    watchNetworkSuccesses(connections, (action) =>
      get.set(notify, { kind: 'git', action }),
    ),
  );
});
