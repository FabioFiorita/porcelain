import { describe, expect, it } from 'vitest';
import { proofFilePaths, proofMediaType } from './review-proof.ts';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === 'number'
        ? [value]
        : Array.from(value, (character) => character.charCodeAt(0)),
    ),
  );

describe('proofMediaType', () => {
  it.each([
    {
      mediaType: 'image/png',
      content: bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0),
    },
    { mediaType: 'image/jpeg', content: bytes(0xff, 0xd8, 0xff, 0xe0) },
    { mediaType: 'image/gif', content: bytes('GIF87a', 1) },
    { mediaType: 'image/gif', content: bytes('GIF89a', 1) },
    { mediaType: 'image/webp', content: bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8') },
    { mediaType: 'video/mp4', content: bytes(0, 0, 0, 0x20, 'ftypisom') },
    { mediaType: 'video/mp4', content: bytes(0, 0, 0, 0x1c, 'ftypmp42') },
    { mediaType: 'video/mp4', content: bytes(0, 0, 0, 0x20, 'ftypavc1') },
    { mediaType: 'video/webm', content: bytes(0x1a, 0x45, 0xdf, 0xa3, 0) },
  ])('names $mediaType from the file signature', ({ mediaType, content }) => {
    expect(proofMediaType(content)).toBe(mediaType);
  });

  it.each([
    { name: 'an SVG document', content: bytes('<svg></svg>') },
    { name: 'an HTML page', content: bytes('<!doctype html><script>') },
    {
      name: 'a RIFF file that is not WebP',
      content: bytes('RIFF', 0, 0, 0, 0, 'WAVE'),
    },
    { name: 'a PNG signature cut short', content: bytes(0x89, 'PNG') },
    { name: 'a HEIC photo', content: bytes(0, 0, 0, 0x18, 'ftypheic') },
    { name: 'an AVIF image', content: bytes(0, 0, 0, 0x1c, 'ftypavif') },
    { name: 'a QuickTime movie', content: bytes(0, 0, 0, 0x14, 'ftypqt  ') },
    { name: 'a 3GP video', content: bytes(0, 0, 0, 0x18, 'ftyp3gp4') },
    { name: 'an ftyp box without a brand', content: bytes(0, 0, 0, 8, 'ftyp') },
    { name: 'no bytes', content: bytes() },
  ])('names nothing for $name', ({ content }) => {
    expect(proofMediaType(content)).toBeUndefined();
  });
});

describe('proofFilePaths', () => {
  it('lists each attached file path once and no link', () => {
    expect(
      proofFilePaths({
        assets: [
          { kind: 'image', title: 'A', path: 'shots/a.png' },
          { kind: 'link', title: 'CI', url: 'https://ci.example/1' },
          { kind: 'video', title: 'B', path: 'run.webm' },
          { kind: 'image', title: 'A again', path: 'shots/a.png' },
          { kind: 'image', title: 'Kept', proofId: 'kept' },
        ],
      }),
    ).toEqual(['shots/a.png', 'run.webm']);
  });

  it('lists nothing for a review without proof', () => {
    expect(proofFilePaths(undefined)).toEqual([]);
  });
});
