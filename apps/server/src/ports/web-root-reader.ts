export type WebRootPath = { path: string };

export type WebRootFile = { path: string; size: number };

export interface WebRootReader {
  find(input: WebRootPath): Promise<WebRootFile | undefined>;
  exists(input: WebRootPath): Promise<boolean>;
  open(input: WebRootFile): ReadableStream<Uint8Array>;
}
