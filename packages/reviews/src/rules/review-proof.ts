import type { ProofDraft, ProofMediaType } from '../models/review-proof.ts';

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

export function proofFilePaths(proof: ProofDraft | undefined): string[] {
  return [
    ...new Set(
      (proof?.assets ?? []).flatMap((asset) =>
        asset.kind === 'link' || asset.path === undefined ? [] : [asset.path],
      ),
    ),
  ];
}
