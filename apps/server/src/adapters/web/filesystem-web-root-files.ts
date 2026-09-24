import { createReadStream, type ReadStream } from 'node:fs';
import { lstat, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import type { WebRootFile, WebRootFiles } from '../../ports/web-root-files.ts';

function pathIsWithin(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return (
    child === '' ||
    (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
  );
}

export class FilesystemWebRootFiles implements WebRootFiles {
  readonly root: string;
  private readonly served: boolean;

  constructor(root: string | undefined) {
    this.root = root ?? '';
    this.served = root !== undefined;
  }

  async file(candidate: string): Promise<WebRootFile | undefined> {
    if (!this.served) return undefined;
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
    if (!this.served) return false;
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
