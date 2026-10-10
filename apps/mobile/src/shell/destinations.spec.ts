import { describe, expect, it } from 'vitest';
import { destinationForPath } from './destinations';

describe('mobile destination ownership', () => {
  it('keeps pushed screens in their parent destination on tablet', () => {
    expect(destinationForPath('/files').title).toBe('Files');
    expect(destinationForPath('/file').path).toBe('/files');
    expect(destinationForPath('/file-edit').path).toBe('/files');
    expect(destinationForPath('/file-action').path).toBe('/files');
    expect(destinationForPath('/review').title).toBe('Review');
    expect(destinationForPath('/review-file').path).toBe('/review');
    expect(destinationForPath('/review-comments').path).toBe('/review');
    expect(destinationForPath('/history/commit/abc123').title).toBe('History');
    expect(destinationForPath('/history/commit/abc123/diff').path).toBe(
      '/history',
    );
    expect(destinationForPath('/appearance').title).toBe('Settings');
    expect(destinationForPath('/component-preview').path).toBe('/settings');
  });

  it('does not treat similarly named routes as a destination', () => {
    expect(destinationForPath('/reviewer').path).toBe('/files');
    expect(destinationForPath('/history-other').path).toBe('/files');
    expect(destinationForPath('/settings-other').path).toBe('/files');
  });
});
