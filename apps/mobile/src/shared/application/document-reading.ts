import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';

type Document = { workspace: string; document: string };

export const documentReadingLine = Atom.family((_: Document) =>
  Atom.make(1).pipe(Atom.keepAlive),
);

export const documentReadingStart = Atom.family(
  ({ workspace, document }: Document & { version: string }) =>
    Atom.make((get) =>
      get.once(documentReadingLine({ workspace, document })),
    ).pipe(Atom.setIdleTTL(0)),
);

export function useDocumentReadingLine(
  workspace: string,
  document: string,
  version: string,
) {
  return {
    initialLine: useAtomValue(
      documentReadingStart({ workspace, document, version }),
    ),
    onReadingLine: useAtomSet(documentReadingLine({ workspace, document })),
  };
}
