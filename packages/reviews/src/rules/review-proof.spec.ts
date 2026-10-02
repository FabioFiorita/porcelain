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
    {
      name: 'an SVG document',
      content: bytes('<svg></svg>'),
      neighbour: 'a PNG image',
      named: bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a, 0),
      mediaType: 'image/png',
    },
    {
      name: 'an HTML page',
      content: bytes('<!doctype html><script>'),
      neighbour: 'a WebM video',
      named: bytes(0x1a, 0x45, 0xdf, 0xa3, 0),
      mediaType: 'video/webm',
    },
    {
      name: 'a RIFF file that is not WebP',
      content: bytes('RIFF', 0, 0, 0, 0, 'WAVE'),
      neighbour: 'a RIFF file that is WebP',
      named: bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8'),
      mediaType: 'image/webp',
    },
    {
      name: 'a PNG signature cut short',
      content: bytes(0x89, 'PNG'),
      neighbour: 'the whole PNG signature',
      named: bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a),
      mediaType: 'image/png',
    },
    {
      name: 'a HEIC photo',
      content: bytes(0, 0, 0, 0x18, 'ftypheic'),
      neighbour: 'an ISO MP4 box of the same size',
      named: bytes(0, 0, 0, 0x18, 'ftypisom'),
      mediaType: 'video/mp4',
    },
    {
      name: 'an AVIF image',
      content: bytes(0, 0, 0, 0x1c, 'ftypavif'),
      neighbour: 'an MP4 version 2 box of the same size',
      named: bytes(0, 0, 0, 0x1c, 'ftypmp42'),
      mediaType: 'video/mp4',
    },
    {
      name: 'a QuickTime movie',
      content: bytes(0, 0, 0, 0x14, 'ftypqt  '),
      neighbour: 'an AVC MP4 box of the same size',
      named: bytes(0, 0, 0, 0x14, 'ftypavc1'),
      mediaType: 'video/mp4',
    },
    {
      name: 'a 3GP video',
      content: bytes(0, 0, 0, 0x18, 'ftyp3gp4'),
      neighbour: 'an ISO version 4 MP4 box of the same size',
      named: bytes(0, 0, 0, 0x18, 'ftypiso4'),
      mediaType: 'video/mp4',
    },
    {
      name: 'an ftyp box without a brand',
      content: bytes(0, 0, 0, 8, 'ftyp'),
      neighbour: 'the same box with the M4V brand',
      named: bytes(0, 0, 0, 8, 'ftypM4V '),
      mediaType: 'video/mp4',
    },
    {
      name: 'no bytes',
      content: bytes(),
      neighbour: 'a JPEG photo',
      named: bytes(0xff, 0xd8, 0xff, 0xe0),
      mediaType: 'image/jpeg',
    },
  ])(
    'names nothing for $name, but $mediaType for $neighbour',
    ({ content, named, mediaType }) => {
      expect(proofMediaType(content)).toBeUndefined();
      expect(proofMediaType(named)).toBe(mediaType);
    },
  );
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

  it('lists nothing for a review without proof, and the attached path once it has some', () => {
    expect(proofFilePaths(undefined)).toEqual([]);
    expect(
      proofFilePaths({
        assets: [{ kind: 'image', title: 'A', path: 'shots/a.png' }],
      }),
    ).toEqual(['shots/a.png']);
  });
});
