import { Stream } from 'effect';
import { describe, expect, it } from 'vite-plus/test';
import { byteRange, previewFileResponse } from './preview-file-response.ts';

const file = {
  mediaType: 'video/mp4',
  revision: 'one',
  size: 10,
  bytes: () => Stream.empty,
};

describe('preview file responses', () => {
  it('resolves closed, open-ended and suffix ranges within the byte length', () => {
    expect(byteRange('bytes=2-4', 10)).toEqual({ start: 2, end: 4 });
    expect(byteRange('bytes=6-', 10)).toEqual({ start: 6, end: 9 });
    expect(byteRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(byteRange('bytes=0-99', 10)).toEqual({ start: 0, end: 9 });
    expect(byteRange('bytes=-99', 10)).toEqual({ start: 0, end: 9 });
    expect(byteRange('bytes=10-', 10)).toBeNull();
    expect(byteRange('bytes=-0', 10)).toBeNull();
    expect(byteRange('bytes=5-2', 10)).toBeNull();
    expect(byteRange('bytes=0-', 0)).toBeNull();
    expect(byteRange('items=2-4', 10)).toBeUndefined();
    expect(byteRange('bytes=2-4,6-7', 10)).toBeUndefined();
    expect(byteRange('bytes=-', 10)).toBeUndefined();
  });

  it('returns validators, lengths, a single content range and active-content protection', () => {
    const full = previewFileResponse(file, {});
    expect(full.status).toBe(200);
    expect(full.headers).toMatchObject({
      'accept-ranges': 'bytes',
      'content-length': '10',
      'content-security-policy': "sandbox; default-src 'none'",
      'content-type': 'video/mp4',
      'x-content-type-options': 'nosniff',
      etag: '"one"',
    });

    const part = previewFileResponse(file, {
      range: 'bytes=2-4',
      'if-range': '"one"',
    });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe('bytes 2-4/10');
    expect(part.headers['content-length']).toBe('3');

    const unsatisfied = previewFileResponse(file, { range: 'bytes=10-' });
    expect(unsatisfied.status).toBe(416);
    expect(unsatisfied.headers['content-range']).toBe('bytes */10');

    const empty = previewFileResponse({ ...file, size: 0 }, {});
    expect(empty.headers['content-length']).toBe('0');
  });

  it('uses If-None-Match before ranges and ignores a range on an If-Range mismatch', () => {
    const notModified = previewFileResponse(file, {
      'if-none-match': '"another", W/"one"',
      range: 'bytes=10-',
    });
    expect(notModified.status).toBe(304);
    expect(notModified.headers.etag).toBe('"one"');
    expect(notModified.headers['content-range']).toBeUndefined();

    const stale = previewFileResponse(file, {
      range: 'bytes=2-4',
      'if-range': '"other"',
    });
    expect(stale.status).toBe(200);
    expect(stale.headers['content-range']).toBeUndefined();
    expect(stale.headers['content-length']).toBe('10');
  });
});
