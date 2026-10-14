import { Atom, AtomRef } from 'effect/reactivity';
import type { AccessPlatformValue } from '../ports/access-platform.ts';
import type { Remote } from '../rules/remotes.ts';

export const statusChanges = Atom.family((_send: AccessPlatformValue['send']) =>
  AtomRef.make<{ remote: Remote; revision: symbol } | undefined>(undefined),
);

export const statusRuntime = Atom.family((_platform: AccessPlatformValue) =>
  Atom.context(),
);
