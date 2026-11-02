import { Atom } from 'effect/reactivity';
import {
  emptyNavigatorFilter,
  type NavigatorFilter,
  type NavigatorStatusNotice,
} from '../rules/worktree-navigator.ts';

export const worktreeNavigatorState = Atom.make<{
  readonly query: string;
  readonly filter: NavigatorFilter;
  readonly expanded: Readonly<Record<string, boolean>>;
}>({
  query: '',
  filter: emptyNavigatorFilter,
  expanded: {},
}).pipe(Atom.keepAlive);

export const worktreeStatusNotices = Atom.make<
  readonly NavigatorStatusNotice[]
>([]).pipe(Atom.keepAlive);
