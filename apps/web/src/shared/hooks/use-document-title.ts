import { useAtomMount } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import { documentTitle } from '../store';

const untitled = Atom.make(undefined);

export function useDocumentTitle(title: string | undefined) {
  useAtomMount(title === undefined ? untitled : documentTitle(title));
}
