import type { FileReader } from '@porcelain/files/ports';
import type {
  UntrackedFileRead,
  UntrackedFileRequest,
} from '@porcelain/git-actions/models';
import type { UntrackedFileReader } from '@porcelain/git-actions/ports';

export class FilesystemUntrackedFileReader implements UntrackedFileReader {
  private readonly files: Pick<FileReader, 'readText'>;

  constructor(files: Pick<FileReader, 'readText'>) {
    this.files = files;
  }

  async read(
    input: UntrackedFileRequest,
    signal?: AbortSignal,
  ): Promise<UntrackedFileRead> {
    const read = await this.files.readText(
      { worktreeId: input.worktreeId, path: input.path },
      input.maxBytes,
      signal,
    );
    switch (read.kind) {
      case 'text':
        return { kind: 'text', text: read.text, byteLength: read.byteLength };
      case 'too-large':
        return { kind: 'too-large' };
      case 'failed':
        return { kind: 'failed', failure: read.failure };
    }
  }
}
