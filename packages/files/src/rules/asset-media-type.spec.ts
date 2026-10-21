import { describe, expect, it } from 'vitest';
import { assetMediaType } from './asset-media-type.ts';

describe('assetMediaType', () => {
  it('ignores the case of the extension', () => {
    expect(assetMediaType('docs/Logo.PNG')).toBe('image/png');
  });

  it('reads only the last extension of the file name', () => {
    expect(assetMediaType('archive.md.png')).toBe('image/png');
    expect(assetMediaType('logo.png.md')).toBeUndefined();
  });

  it('does not take a dot in a folder or a leading dot as an extension', () => {
    expect(assetMediaType('assets.png/logo')).toBeUndefined();
    expect(assetMediaType('images/.png')).toBeUndefined();
    expect(assetMediaType('logo.')).toBeUndefined();
  });
});
