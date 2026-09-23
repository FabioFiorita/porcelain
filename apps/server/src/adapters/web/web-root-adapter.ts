import { createReadStream, type ReadStream } from 'node:fs';
import { lstat, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';

export type WebRootFile = { path: string; size: number };

function pathIsWithin(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return (
    child === '' ||
    (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
  );
}

export class WebRootAdapter {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async file(candidate: string): Promise<WebRootFile | undefined> {
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

  async exists(candidate: string): Promise<boolean> {
    try {
      await lstat(candidate);
      return true;
    } catch {
      return false;
    }
  }

  stream(path: string): ReadStream {
    return createReadStream(path);
  }
}
