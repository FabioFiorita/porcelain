import { describe, expect, it } from 'vitest';
import { assetMediaType } from './asset-media-type.ts';

describe('assetMediaType', () => {
  it('names the media type of images, stylesheets, scripts and fonts', () => {
    expect(
      [
        'logo.png',
        'photo.jpeg',
        'icon.svg',
        'site.css',
        'app.js',
        'font.woff2',
      ].map(assetMediaType),
    ).toEqual([
      'image/png',
      'image/jpeg',
      'image/svg+xml',
      'text/css',
      'text/javascript',
      'font/woff2',
    ]);
  });

  it('ignores the case of the extension', () => {
    expect(assetMediaType('docs/Logo.PNG')).toBe('image/png');
  });

  it('reads only the last extension of the file name', () => {
    expect(assetMediaType('archive.md.png')).toBe('image/png');
    expect(assetMediaType('logo.png.md')).toBeUndefined();
  });

  it('refuses text documents that are not previewable assets', () => {
    expect(assetMediaType('README.md')).toBeUndefined();
    expect(assetMediaType('notes.txt')).toBeUndefined();
  });

  it('does not take a dot in a folder or a leading dot as an extension', () => {
    expect(assetMediaType('assets.png/logo')).toBeUndefined();
    expect(assetMediaType('images/.png')).toBeUndefined();
    expect(assetMediaType('logo.')).toBeUndefined();
  });
});
