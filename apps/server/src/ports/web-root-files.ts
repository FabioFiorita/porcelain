export type WebRootFile = { path: string; size: number };

export interface WebRootFiles {
  readonly root: string;
  file(candidate: string): Promise<WebRootFile | undefined>;
  exists(candidate: string): Promise<boolean>;
  stream(path: string): NodeJS.ReadableStream;
}
