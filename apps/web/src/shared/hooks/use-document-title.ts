import { useAtomMount } from '@effect/atom-react';
import { documentTitle } from '../store';

export function useDocumentTitle(title: string) {
  useAtomMount(documentTitle(title));
}
