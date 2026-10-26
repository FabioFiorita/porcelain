import { describe, expect, it } from 'vitest';
import { assetMediaType } from './asset-media-type.ts';

describe('assetMediaType', () => {
  it('ignores the case of the extension', () => {
    expect(assetMediaType('docs/Logo.PNG')).toBe('image/png');
  });
});
