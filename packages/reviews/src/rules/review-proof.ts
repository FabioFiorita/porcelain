import type {
  ProofDraft,
  ProofFileKind,
  ProofMediaType,
  ProofTarget,
} from '../models/review-proof.ts';
import type { FileChange } from '@porcelain/kernel/models';
import { sha256Hex } from '@porcelain/kernel/rules';
import type { LayerDraft } from '../models/review.ts';

const signatures: readonly {
  mediaType: ProofMediaType;
  start: RegExp | string;
}[] = [
  { mediaType: 'image/png', start: '\x89PNG\r\n\x1a\n' },
  { mediaType: 'image/jpeg', start: '\xff\xd8\xff' },
  { mediaType: 'image/gif', start: /^GIF8[79]a/ },
  { mediaType: 'image/webp', start: /^RIFF[\s\S]{4}WEBP/ },
  {
    mediaType: 'video/mp4',
    start: /^[\s\S]{4}ftyp(?:isom|iso[2-9]|mp41|mp42|avc1|dash|M4V )/,
  },
  { mediaType: 'video/webm', start: '\x1a\x45\xdf\xa3' },
];

export function proofMediaType(head: Uint8Array): ProofMediaType | undefined {
  const text = String.fromCharCode(...head);
  return signatures.find(({ start }) =>
    typeof start === 'string' ? text.startsWith(start) : start.test(text),
  )?.mediaType;
}

export function proofFileKind(mediaType: ProofMediaType): ProofFileKind {
  return mediaType.startsWith('image/') ? 'image' : 'video';
}

export function proofFilePaths(proof: ProofDraft | undefined): string[] {
  return [
    ...new Set(
      (proof?.assets ?? []).flatMap((asset) =>
        asset.kind === 'link' || asset.path === undefined ? [] : [asset.path],
      ),
    ),
  ];
}

export function proofTargetsKnown(
  proof: ProofDraft | undefined,
  layers: readonly LayerDraft[],
): boolean {
  const known = (target: ProofTarget) => {
    if (target.layerId === undefined) return target.stepId === undefined;
    const layer = layers.find((candidate) => candidate.id === target.layerId);
    if (layer === undefined) return false;
    return (
      target.stepId === undefined ||
      layer.steps.some((step) => step.id === target.stepId)
    );
  };
  return [...(proof?.checks ?? []), ...(proof?.assets ?? [])].every(known);
}

export function changesDigest(
  changes: readonly FileChange[],
  ignoredPaths: readonly string[],
): string {
  const ignored = new Set(ignoredPaths);
  return sha256Hex(
    changes
      .filter((change) => !ignored.has(change.path))
      .map((change) => `${change.path}\0${change.fingerprint ?? ''}`)
      .toSorted()
      .join('\n'),
  );
}
