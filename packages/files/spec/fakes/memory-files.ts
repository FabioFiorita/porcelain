import type {
  DirectoryEntry,
  DirectoryRead,
  FileFailure,
  FileLocation,
  FileRead,
  FileWrite,
  TextRead,
} from '../../src/models/index.ts';
import type {
  DirectoryReader,
  FileReader,
  FileWriter,
} from '../../src/ports/index.ts';

type StoredFile = { bytes: Uint8Array; revision: number };

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export class MemoryFiles implements FileReader, FileWriter, DirectoryReader {
  private readonly files = new Map<string, StoredFile>();
  private readonly directories = new Set<string>(['']);
  private revisions = 0;
  private pendingChange: { path: string; text: string } | undefined;
  trashAvailable = true;

  constructor(entries: Record<string, string | Uint8Array> = {}) {
    for (const [path, content] of Object.entries(entries))
      this.put(path, content);
  }

  put(path: string, content: string | Uint8Array) {
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index += 1)
      this.directories.add(parts.slice(0, index).join('/'));
    this.revisions += 1;
    this.files.set(path, {
      bytes:
        typeof content === 'string'
          ? new TextEncoder().encode(content)
          : content,
      revision: this.revisions,
    });
  }

  addDirectory(path: string) {
    this.directories.add(path);
  }

  changeBeforeNextWrite(path: string, text: string) {
    this.pendingChange = { path, text };
  }

  text(path: string): string | undefined {
    const file = this.files.get(path);
    return file === undefined ? undefined : decoder.decode(file.bytes);
  }

  has(path: string) {
    return this.files.has(path) || this.directories.has(path);
  }

  read(location: FileLocation, maxBytes: number): Promise<FileRead> {
    const file = this.files.get(location.path);
    if (file === undefined) return Promise.resolve(this.absent(location.path));
    if (file.bytes.length > maxBytes)
      return Promise.resolve({ kind: 'too-large' });
    return Promise.resolve({
      kind: 'file',
      bytes: file.bytes,
      revision: String(file.revision),
    });
  }

  async readText(location: FileLocation, maxBytes: number): Promise<TextRead> {
    const read = await this.read(location, maxBytes);
    if (read.kind !== 'file') return read;
    if (read.bytes.includes(0))
      return { kind: 'failed', failure: 'unsupported-text' };
    try {
      return {
        kind: 'text',
        text: decoder.decode(read.bytes),
        byteLength: read.bytes.length,
        revision: read.revision,
      };
    } catch {
      return { kind: 'failed', failure: 'unsupported-text' };
    }
  }

  list(location: FileLocation, maxEntries: number): Promise<DirectoryRead> {
    if (!this.directories.has(location.path))
      return Promise.resolve(
        this.files.has(location.path)
          ? { kind: 'failed', failure: 'unreadable' }
          : { kind: 'failed', failure: 'missing' },
      );
    const entries = [
      ...[...this.directories]
        .filter((path) => this.isChild(location.path, path))
        .map((path): DirectoryEntry => ({
          name: this.name(path),
          kind: 'directory',
        })),
      ...[...this.files.keys()]
        .filter((path) => this.isChild(location.path, path))
        .map((path): DirectoryEntry => ({
          name: this.name(path),
          kind: 'file',
        })),
    ];
    if (entries.length > maxEntries)
      return Promise.resolve({ kind: 'too-large' });
    return Promise.resolve({ kind: 'directory', entries });
  }

  write(
    location: FileLocation,
    text: string,
    revision: string,
  ): Promise<FileWrite> {
    if (this.pendingChange?.path === location.path) {
      this.put(location.path, this.pendingChange.text);
      this.pendingChange = undefined;
    }
    const file = this.files.get(location.path);
    if (file === undefined) return Promise.resolve(this.absent(location.path));
    if (String(file.revision) !== revision)
      return Promise.resolve({ kind: 'failed', failure: 'changed' });
    this.put(location.path, text);
    return Promise.resolve({ kind: 'written' });
  }

  create(
    location: FileLocation,
    entryKind: 'file' | 'directory',
  ): Promise<FileWrite> {
    if (this.has(location.path))
      return Promise.resolve({ kind: 'failed', failure: 'exists' });
    if (!this.directories.has(this.parent(location.path)))
      return Promise.resolve({ kind: 'failed', failure: 'missing' });
    if (entryKind === 'directory') this.directories.add(location.path);
    else this.put(location.path, '');
    return Promise.resolve({ kind: 'written' });
  }

  move(location: FileLocation, destination: string): Promise<FileWrite> {
    if (!this.has(location.path))
      return Promise.resolve({ kind: 'failed', failure: 'missing' });
    if (this.has(destination))
      return Promise.resolve({ kind: 'failed', failure: 'exists' });
    if (!this.directories.has(this.parent(destination)))
      return Promise.resolve({ kind: 'failed', failure: 'missing' });
    const moved = (path: string) =>
      path === location.path || path.startsWith(`${location.path}/`)
        ? `${destination}${path.slice(location.path.length)}`
        : path;
    for (const path of [...this.directories]) {
      this.directories.delete(path);
      this.directories.add(moved(path));
    }
    for (const [path, file] of [...this.files]) {
      this.files.delete(path);
      this.files.set(moved(path), file);
    }
    return Promise.resolve({ kind: 'written' });
  }

  trash(location: FileLocation): Promise<FileWrite> {
    if (!this.has(location.path))
      return Promise.resolve({ kind: 'failed', failure: 'missing' });
    if (!this.trashAvailable)
      return Promise.resolve({ kind: 'failed', failure: 'trash-unavailable' });
    const inside = (path: string) =>
      path === location.path || path.startsWith(`${location.path}/`);
    for (const path of [...this.directories])
      if (inside(path)) this.directories.delete(path);
    for (const path of [...this.files.keys()])
      if (inside(path)) this.files.delete(path);
    return Promise.resolve({ kind: 'written' });
  }

  private absent(path: string): { kind: 'failed'; failure: FileFailure } {
    return this.directories.has(path)
      ? { kind: 'failed', failure: 'unreadable' }
      : { kind: 'failed', failure: 'missing' };
  }

  private parent(path: string) {
    return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  }

  private name(path: string) {
    return path.slice(path.lastIndexOf('/') + 1);
  }

  private isChild(directory: string, path: string) {
    return path !== '' && path !== directory && this.parent(path) === directory;
  }
}
