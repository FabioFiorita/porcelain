import { Stream, type Effect } from 'effect';
import type { ReadPreviewFileUseCase } from '../../../use-cases/files/read-preview-file.ts';
import { HttpServerResponse } from 'effect/http';

type PreviewFile = NonNullable<
  Effect.Success<ReturnType<ReadPreviewFileUseCase['Service']['execute']>>
>;

export function byteRange(header: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return undefined;
  const [, first = '', last = ''] = match;
  if (!first && !last) return undefined;
  if (size === 0) return null;
  if (!first) {
    const count = Number(last);
    return count === 0
      ? null
      : { start: Math.max(0, size - count), end: size - 1 };
  }
  const start = Number(first);
  const end = last ? Math.min(size - 1, Number(last)) : size - 1;
  return start >= size || start > end ? null : { start, end };
}

export function previewFileResponse(
  file: PreviewFile,
  request: Readonly<Record<string, string | undefined>>,
) {
  const etag = `"${file.revision}"`;
  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Type': file.mediaType,
    'Content-Security-Policy': "sandbox; default-src 'none'",
    ETag: etag,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  };
  if (
    request['if-none-match']
      ?.match(/(?:W\/)?"[^"]*"|\*/g)
      ?.some((tag) => tag === '*' || tag.replace(/^W\//, '') === etag)
  )
    return HttpServerResponse.empty({ status: 304, headers });
  const range =
    request.range && (!request['if-range'] || request['if-range'] === etag)
      ? byteRange(request.range, file.size)
      : undefined;
  if (range === null)
    return HttpServerResponse.empty({
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${file.size}` },
    });
  if (range)
    return HttpServerResponse.stream(file.bytes(range.start, range.end), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${range.start}-${range.end}/${file.size}`,
      },
      contentLength: range.end - range.start + 1,
    });
  return HttpServerResponse.stream(
    file.size === 0 ? Stream.empty : file.bytes(0, file.size - 1),
    {
      headers: { ...headers, 'Content-Length': String(file.size) },
      contentLength: file.size,
    },
  );
}
