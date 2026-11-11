import { useAtomMount, useAtomValue } from '@effect/atom-react';
import { useIsFocused } from 'expo-router';
import { Atom } from 'effect/reactivity';
import type { TopBarAction } from '../../components/ui/top-bar-items';
import {
  publishedTopBarActions,
  topBarPublication,
  topBarPublications,
  type TopBarOwner,
} from './top-bar-registry';

const nothing = Atom.make(undefined);

export function TopBarActions({
  owner,
  actions,
}: {
  owner: TopBarOwner;
  actions: readonly TopBarAction[];
}) {
  const focused = useIsFocused();
  useAtomMount(focused ? topBarPublication({ owner, actions }) : nothing);
  return null;
}

export function usePublishedTopBar(): TopBarAction[] {
  return publishedTopBarActions(useAtomValue(topBarPublications));
}
