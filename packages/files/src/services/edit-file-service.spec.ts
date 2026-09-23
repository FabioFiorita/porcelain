import { describe, expect, it } from 'vitest';
import {
  ContentChangedError,
  EntryExistsError,
  FileTooLargeError,
  InvalidMoveError,
  PathNotFoundError,
  TrashUnavailableError,
} from '@porcelain/files/errors';
import { MemoryFiles } from '../../spec/fakes/memory-files.ts';
import { EditFileService } from './edit-file-service.ts';

const worktreeId = 'a'.repeat(32);
const oldFingerprint =
  '01d09d19c2139a46aebfb577780d123d7396e97201bc7ead210a2ebff8239dee';
const newFingerprint =
  '7aa7a5359173d05b63cfd682e3c38487f3cb4f7f1d60659fe59fab1505977d4c';

function setup(entries: Record<string, string> = { 'notes.md': 'old\n' }) {
  const files = new MemoryFiles(entries);
  return { files, service: new EditFileService(files, files) };
}

describe('EditFileService', () => {
  it('writes when the fingerprint matches the current content', async () => {
    const { files, service } = setup();
    await expect(
      service.execute({
        worktreeId,
        command: {
          kind: 'write',
          path: 'notes.md',
          text: 'new\n',
          expectedFingerprint: oldFingerprint,
        },
      }),
    ).resolves.toEqual({
      path: 'notes.md',
      contentFingerprint: newFingerprint,
    });
    expect(files.text('notes.md')).toBe('new\n');
  });

  it('refuses a write based on content that has since changed', async () => {
    const { files, service } = setup({ 'notes.md': 'edited elsewhere\n' });
    await expect(
      service.execute({
        worktreeId,
        command: {
          kind: 'write',
          path: 'notes.md',
          text: 'new\n',
          expectedFingerprint: oldFingerprint,
        },
      }),
    ).rejects.toThrow(ContentChangedError);
    expect(files.text('notes.md')).toBe('edited elsewhere\n');
  });

  it('refuses a write when the file changes between the check and the write', async () => {
    const { files, service } = setup();
    files.changeBeforeNextWrite('notes.md', 'raced\n');
    await expect(
      service.execute({
        worktreeId,
        command: {
          kind: 'write',
          path: 'notes.md',
          text: 'new\n',
          expectedFingerprint: oldFingerprint,
        },
      }),
    ).rejects.toThrow(ContentChangedError);
    expect(files.text('notes.md')).toBe('raced\n');
  });

  it('refuses to overwrite a file too large to compare', async () => {
    const files = new MemoryFiles({ 'big.md': 'x'.repeat(11) });
    const service = new EditFileService(files, files, { maxCurrentBytes: 10 });
    await expect(
      service.execute({
        worktreeId,
        command: {
          kind: 'write',
          path: 'big.md',
          text: 'small',
          expectedFingerprint: oldFingerprint,
        },
      }),
    ).rejects.toThrow(FileTooLargeError);
    expect(files.text('big.md')).toBe('x'.repeat(11));
  });

  it('refuses to write a file that does not exist', async () => {
    const { service } = setup();
    await expect(
      service.execute({
        worktreeId,
        command: {
          kind: 'write',
          path: 'missing.md',
          text: 'new\n',
          expectedFingerprint: oldFingerprint,
        },
      }),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('creates a folder and an empty file inside it', async () => {
    const { files, service } = setup();
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'create', path: 'docs', entryKind: 'directory' },
      }),
    ).resolves.toEqual({ path: 'docs' });
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'create', path: 'docs/draft.md', entryKind: 'file' },
      }),
    ).resolves.toEqual({ path: 'docs/draft.md' });
    expect(files.text('docs/draft.md')).toBe('');
  });

  it('refuses to create over an existing entry', async () => {
    const { files, service } = setup();
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'create', path: 'notes.md', entryKind: 'file' },
      }),
    ).rejects.toThrow(EntryExistsError);
    expect(files.text('notes.md')).toBe('old\n');
  });

  it('moves an entry and answers with its new path', async () => {
    const { files, service } = setup({ 'docs/a.md': 'a', 'b.md': 'b' });
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'move', path: 'docs', destination: 'docs-old' },
      }),
    ).resolves.toEqual({ path: 'docs-old' });
    expect(files.text('docs-old/a.md')).toBe('a');
    expect(files.has('docs')).toBe(false);
  });

  it('refuses to move an entry onto itself or into its own folder', async () => {
    const { files, service } = setup({ 'docs/a.md': 'a' });
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'move', path: 'docs', destination: 'docs' },
      }),
    ).rejects.toThrow(InvalidMoveError);
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'move', path: 'docs', destination: 'docs/inner' },
      }),
    ).rejects.toThrow(InvalidMoveError);
    expect(files.text('docs/a.md')).toBe('a');
  });

  it('reports a missing source as not found', async () => {
    const { service } = setup();
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'move', path: 'missing.md', destination: 'x.md' },
      }),
    ).rejects.toThrow(PathNotFoundError);
  });

  it('moves an entry to the trash', async () => {
    const { files, service } = setup();
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'trash', path: 'notes.md' },
      }),
    ).resolves.toEqual({ path: 'notes.md' });
    expect(files.has('notes.md')).toBe(false);
  });

  it('keeps the entry when the machine has no trash', async () => {
    const { files, service } = setup();
    files.trashAvailable = false;
    await expect(
      service.execute({
        worktreeId,
        command: { kind: 'trash', path: 'notes.md' },
      }),
    ).rejects.toThrow(TrashUnavailableError);
    expect(files.text('notes.md')).toBe('old\n');
  });
});
