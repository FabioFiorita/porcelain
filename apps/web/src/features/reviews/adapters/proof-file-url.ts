import { useAtomValue } from '@effect/atom-react';
import { Atom } from 'effect/reactivity';
import {
  type ProofFile,
  proofFileBytes,
} from '@porcelain/client/reviews/rules';

const proofFileUrl = Atom.family((file: ProofFile | undefined) =>
  Atom.make((get) => {
    if (!file) return undefined;
    const url = URL.createObjectURL(
      new Blob([proofFileBytes(file)], { type: file.mediaType }),
    );
    get.addFinalizer(() => URL.revokeObjectURL(url));
    return url;
  }),
);

export function useProofFileUrl(file: ProofFile | undefined) {
  return useAtomValue(proofFileUrl(file));
}
