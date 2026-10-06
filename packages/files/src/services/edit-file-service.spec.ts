import {
  FileReader,
  FileWriter,
  EditFileOptions,
} from '@porcelain/files/ports';
import { Effect } from 'effect';
import { withWriteLease } from '@porcelain/effects/worktree';
import { describe, expect, it } from 'vitest';
import {
  ContentChangedError,
  CrossDeviceMoveError,
  DiskFullError,
  EntryExistsError,
  FileTooLargeError,
  InvalidMoveError,
  PathNotFoundError,
  PathNotReadableError,
  TrashUnavailableError,
  UnsupportedTextError,
} from '@porcelain/files/errors';
import {
  type FileEdit,
  type FileWrite,
  type TextRead,
  type WriteFailure,
} from '@porcelain/files/models';
import { InMemoryFileReader } from '../../spec/fakes/in-memory-file-reader.ts';
import {
  InMemoryFileWriter,
  type StoredEntry,
} from '../../spec/fakes/in-memory-file-writer.ts';
import { ScriptedFileWriter } from '../../spec/fakes/scripted-file-writer.ts';
import { EditFileService } from './edit-file-service.ts';

const worktreeId = 'a'.repeat(32);
const roomy = { maxCurrentBytes: 1024, maxCopyBytes: 1024 };
const oldFingerprint =
  '01d09d19c2139a46aebfb577780d123d7396e97201bc7ead210a2ebff8239dee';
const newFingerprint =
  '7aa7a5359173d05b63cfd682e3c38487f3cb4f7f1d60659fe59fab1505977d4c';
const writeNew: FileEdit = {
  kind: 'write',
  path: 'notes.md',
  text: 'new\n',
  expectedFingerprint: oldFingerprint,
};

function text(content: string, revision: string): TextRead {
  return {
    kind: 'text',
    text: content,
    byteLength: new TextEncoder().encode(content).length,
    revision,
  };
}

function stored(content: string): StoredEntry {
  return { kind: 'file', text: content, basedOn: undefined };
}

function withDisk(
  texts: Record<string, TextRead>,
  entries: Record<string, StoredEntry>,
  options = roomy,
) {
  const writer = new InMemoryFileWriter(entries);
  return {
    writer,
    service: Effect.runSync(
      EditFileService.pipe(
        Effect.provide(EditFileService.layer),
        Effect.provideService(FileReader, new InMemoryFileReader({ texts })),
        Effect.provideService(FileWriter, writer),
        Effect.provideService(EditFileOptions, options),
      ),
    ),
  };
}

function failingWith(
  failure: WriteFailure,
  texts: Record<string, TextRead> = {},
) {
  const outcome: FileWrite = { kind: 'failed', failure };
  return Effect.runSync(
    EditFileService.pipe(
      Effect.provide(EditFileService.layer),
      Effect.provideService(FileReader, new InMemoryFileReader({ texts })),
      Effect.provideService(FileWriter, new ScriptedFileWriter(outcome)),
      Effect.provideService(EditFileOptions, roomy),
    ),
  );
}

describe('EditFileService', () => {
  it('writes over the revision it compared and answers the new fingerprint', async () => {
    const { writer, service } = withDisk(
      { 'notes.md': text('old\n', 'r7') },
      { 'notes.md': stored('old\n') },
    );
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({ worktreeId, command: writeNew }),
        ),
      ),
    ).resolves.toEqual({
      path: 'notes.md',
      contentFingerprint: newFingerprint,
    });
    expect(writer.entry('notes.md')).toEqual({
      kind: 'file',
      text: 'new\n',
      basedOn: 'r7',
    });
  });

  it('refuses a write based on content that has since changed', async () => {
    const { writer, service } = withDisk(
      { 'notes.md': text('edited elsewhere\n', 'r8') },
      { 'notes.md': stored('edited elsewhere\n') },
    );
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({ worktreeId, command: writeNew }),
        ),
      ),
    ).rejects.toThrow(ContentChangedError);
    expect(writer.entry('notes.md')).toEqual(stored('edited elsewhere\n'));
  });

  it('refuses a write when the file changes between the comparison and the write', async () => {
    const service = failingWith('changed', {
      'notes.md': text('old\n', 'r7'),
    });
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({ worktreeId, command: writeNew }),
        ),
      ),
    ).rejects.toThrow(ContentChangedError);
  });

  it('refuses to overwrite a file the reader stopped reading at the limit', async () => {
    const { service } = withDisk({ 'notes.md': { kind: 'too-large' } }, {});
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({ worktreeId, command: writeNew }),
        ),
      ),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('refuses to write a file that does not exist', async () => {
    const { writer, service } = withDisk({}, {});
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({ worktreeId, command: writeNew }),
        ),
      ),
    ).rejects.toThrow(PathNotFoundError);
    expect(writer.entry('notes.md')).toBeUndefined();
  });

  it('refuses to overwrite content that is not UTF-8 text', async () => {
    const { service } = withDisk(
      { 'notes.md': { kind: 'failed', failure: 'unsupported-text' } },
      {},
    );
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({ worktreeId, command: writeNew }),
        ),
      ),
    ).rejects.toThrow(UnsupportedTextError);
  });

  it('creates a folder or an empty file at the requested path', async () => {
    const { writer, service } = withDisk({}, {});
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({
            worktreeId,
            command: { kind: 'create', path: 'docs', entryKind: 'directory' },
          }),
        ),
      ),
    ).resolves.toEqual({ path: 'docs' });
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({
            worktreeId,
            command: {
              kind: 'create',
              path: 'docs/draft.md',
              entryKind: 'file',
            },
          }),
        ),
      ),
    ).resolves.toEqual({ path: 'docs/draft.md' });
    expect(writer.entry('docs')).toMatchObject({ kind: 'directory' });
    expect(writer.entry('docs/draft.md')).toMatchObject({
      kind: 'file',
      text: '',
    });
  });

  it('refuses to create over an existing entry', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('exists').execute({
            worktreeId,
            command: { kind: 'create', path: 'notes.md', entryKind: 'file' },
          }),
        ),
      ),
    ).rejects.toThrow(EntryExistsError);
  });

  it('refuses to create inside a folder that does not exist', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('missing').execute({
            worktreeId,
            command: {
              kind: 'create',
              path: 'nowhere/a.md',
              entryKind: 'file',
            },
          }),
        ),
      ),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('moves an entry beside a folder sharing its name prefix and answers with its new path', async () => {
    const { writer, service } = withDisk({}, { docs: stored('') });
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({
            worktreeId,
            command: { kind: 'move', path: 'docs', destination: 'docs-old' },
          }),
        ),
      ),
    ).resolves.toEqual({ path: 'docs-old' });
    expect(writer.entry('docs')).toBeUndefined();
    expect(writer.entry('docs-old')).toEqual(stored(''));
  });

  it('refuses to move an entry onto itself or into its own folder', async () => {
    const { writer, service } = withDisk({}, { docs: stored('') });
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({
            worktreeId,
            command: { kind: 'move', path: 'docs', destination: 'docs' },
          }),
        ),
      ),
    ).rejects.toThrow(InvalidMoveError);
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({
            worktreeId,
            command: { kind: 'move', path: 'docs', destination: 'docs/inner' },
          }),
        ),
      ),
    ).rejects.toThrow(InvalidMoveError);
    expect(writer.entry('docs')).toEqual(stored(''));
    expect(writer.entry('docs/inner')).toBeUndefined();
  });

  it('refuses to move onto an existing entry', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('exists').execute({
            worktreeId,
            command: { kind: 'move', path: 'a.md', destination: 'b.md' },
          }),
        ),
      ),
    ).rejects.toThrow(EntryExistsError);
  });

  it('refuses to move an entry to another filesystem', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('cross-device').execute({
            worktreeId,
            command: { kind: 'move', path: 'a.md', destination: 'mnt/a.md' },
          }),
        ),
      ),
    ).rejects.toThrow(CrossDeviceMoveError);
  });

  it('reports a missing move source as not found', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('missing').execute({
            worktreeId,
            command: { kind: 'move', path: 'missing.md', destination: 'x.md' },
          }),
        ),
      ),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('moves an entry to the trash', async () => {
    const { writer, service } = withDisk({}, { 'notes.md': stored('old\n') });
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({
            worktreeId,
            command: { kind: 'trash', path: 'notes.md' },
          }),
        ),
      ),
    ).resolves.toEqual({ path: 'notes.md' });
    expect(writer.entry('notes.md')).toBeUndefined();
  });

  it('refuses to delete when the machine has no trash', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('trash-unavailable').execute({
            worktreeId,
            command: { kind: 'trash', path: 'notes.md' },
          }),
        ),
      ),
    ).rejects.toThrow(TrashUnavailableError);
  });

  it('copies a file beside itself, keeps the original and answers with the copy', async () => {
    const { writer, service } = withDisk({}, { 'notes.md': stored('old\n') });
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          service.execute({
            worktreeId,
            command: {
              kind: 'copy',
              path: 'notes.md',
              destination: 'notes copy.md',
            },
          }),
        ),
      ),
    ).resolves.toEqual({ path: 'notes copy.md' });
    expect(writer.entry('notes.md')).toEqual(stored('old\n'));
    expect(writer.entry('notes copy.md')).toEqual(stored('old\n'));
  });

  it('refuses to copy onto an existing entry', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('exists').execute({
            worktreeId,
            command: { kind: 'copy', path: 'a.md', destination: 'b.md' },
          }),
        ),
      ),
    ).rejects.toThrow(EntryExistsError);
  });

  it('reports a missing copy source as not found', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('missing').execute({
            worktreeId,
            command: { kind: 'copy', path: 'missing.md', destination: 'x.md' },
          }),
        ),
      ),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('refuses to copy what is not a readable file', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('unreadable').execute({
            worktreeId,
            command: { kind: 'copy', path: 'docs', destination: 'docs copy' },
          }),
        ),
      ),
    ).rejects.toThrow(PathNotReadableError);
  });

  it('refuses a copy when the source changes while it is copied', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('changed').execute({
            worktreeId,
            command: { kind: 'copy', path: 'a.md', destination: 'b.md' },
          }),
        ),
      ),
    ).rejects.toThrow(ContentChangedError);
  });

  it('refuses to copy a file larger than the copy limit', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('too-large').execute({
            worktreeId,
            command: {
              kind: 'copy',
              path: 'big.bin',
              destination: 'big copy.bin',
            },
          }),
        ),
      ),
    ).rejects.toThrow(FileTooLargeError);
  });

  it('reports a full disk instead of failing without a reason', async () => {
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('no-space').execute({
            worktreeId,
            command: { kind: 'copy', path: 'a.md', destination: 'b.md' },
          }),
        ),
      ),
    ).rejects.toThrow(DiskFullError);
    await expect(
      Effect.runPromise(
        withWriteLease(
          worktreeId,
          failingWith('no-space').execute({
            worktreeId,
            command: { kind: 'create', path: 'c.md', entryKind: 'file' },
          }),
        ),
      ),
    ).rejects.toThrow(DiskFullError);
  });
});
