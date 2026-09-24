import { createReadStream } from 'node:fs';
import { lstat, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type {
  WebRootFile,
  WebRootPath,
  WebRootReader,
} from '../../ports/web-root-reader.ts';

function pathIsWithin(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return (
    child === '' ||
    (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
  );
}

export class FilesystemWebRootReader implements WebRootReader {
  private readonly root: string | undefined;

  constructor(root: string | undefined) {
    this.root = root;
  }

  async find(input: WebRootPath): Promise<WebRootFile | undefined> {
    const candidate = this.inside(input.path);
    if (this.root === undefined || candidate === undefined) return undefined;
    let canonicalRoot: string;
    let canonicalCandidate: string;
    try {
      canonicalRoot = await realpath(this.root);
      canonicalCandidate = await realpath(candidate);
    } catch {
      return undefined;
    }
    if (!pathIsWithin(canonicalRoot, canonicalCandidate)) return undefined;
    try {
      const metadata = await stat(canonicalCandidate);
      return metadata.isFile()
        ? { path: canonicalCandidate, size: metadata.size }
        : undefined;
    } catch {
      return undefined;
    }
  }

  async exists(input: WebRootPath): Promise<boolean> {
    const candidate = this.inside(input.path);
    if (candidate === undefined) return false;
    try {
      await lstat(candidate);
      return true;
    } catch {
      return false;
    }
  }

  open(input: WebRootFile): ReadableStream<Uint8Array> {
    return Readable.toWeb(createReadStream(input.path));
  }

  private inside(path: string): string | undefined {
    if (this.root === undefined) return undefined;
    const root = resolve(this.root);
    const candidate = resolve(root, path);
    return pathIsWithin(root, candidate) ? candidate : undefined;
  }
}
