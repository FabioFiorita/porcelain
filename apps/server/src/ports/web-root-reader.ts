import { Context, type Effect, type Stream } from 'effect';
export type WebRootPath = { path: string };
export type WebRootFile = { path: string; size: number };
export interface WebRootReader {
  find(input: WebRootPath): Effect.Effect<WebRootFile | undefined>;
  exists(input: WebRootPath): Effect.Effect<boolean>;
  open(input: WebRootFile): Stream.Stream<Uint8Array, Error>;
}
export const WebRootReader = Context.Service<WebRootReader>(
  '@porcelain/server/WebRootReader',
);
