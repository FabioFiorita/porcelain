import type { Stream } from 'effect';

export type PreviewFileBytes = {
  readonly size: number;
  readonly revision: string;
  readonly bytes: (
    start: number,
    end: number,
  ) => Stream.Stream<Uint8Array, unknown>;
};

export type PreviewFile = PreviewFileBytes & { readonly mediaType: string };
