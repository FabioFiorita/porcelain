import { useEffect, useState } from 'react';
import { type ProofFile, proofFileBytes } from '../rules/proof';

export function useProofFileUrl(file: ProofFile | undefined) {
  const [shown, setShown] = useState<{ file: ProofFile; url: string }>();
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(
      new Blob([proofFileBytes(file)], { type: file.mediaType }),
    );
    setShown({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return shown !== undefined && shown.file === file ? shown.url : undefined;
}
