import { Atom } from 'effect/reactivity';
import type { TopBarAction } from '../../components/ui/top-bar-items';

export type TopBarOwner = 'document-pane' | 'files-create' | 'git-actions';

const ownerOrder: readonly TopBarOwner[] = [
  'document-pane',
  'files-create',
  'git-actions',
];

export function publishedTopBarActions(
  published: ReadonlyMap<TopBarOwner, readonly TopBarAction[]>,
): TopBarAction[] {
  const actions = ownerOrder.flatMap((owner) => published.get(owner) ?? []);
  return actions.filter(
    (action, index) =>
      actions.findIndex((other) => other.id === action.id) === index,
  );
}

export const topBarPublications = Atom.make<
  ReadonlyMap<TopBarOwner, readonly TopBarAction[]>
>(new Map()).pipe(Atom.keepAlive);

export const topBarPublication = Atom.family(
  ({
    owner,
    actions,
  }: {
    owner: TopBarOwner;
    actions: readonly TopBarAction[];
  }) =>
    Atom.make((get) => {
      if (actions.length === 0) return;
      get.set(
        topBarPublications,
        new Map(get.once(topBarPublications)).set(owner, actions),
      );
      const registry = get.registry;
      get.addFinalizer(() => {
        const current = registry.get(topBarPublications);
        if (current.get(owner) !== actions) return;
        const remaining = new Map(current);
        remaining.delete(owner);
        registry.set(topBarPublications, remaining);
      });
    }).pipe(Atom.setIdleTTL(0)),
);
