import { createContext, useContext } from 'react';
import type { RevealComment } from '../../domain/comments';

export const DocumentInteraction = createContext<{
  active: boolean;
  storageKey?: string;
  reveal?: RevealComment | undefined;
}>({ active: false });
export const useDocumentInteraction = () => useContext(DocumentInteraction);
