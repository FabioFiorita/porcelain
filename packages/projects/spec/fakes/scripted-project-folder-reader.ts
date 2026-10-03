import type {
  ProjectFolderContents,
  ProjectFolderRead,
  ReadProjectFolderInput,
} from '../../src/models/project-folder.ts';
import type { ProjectFolderReader } from '../../src/ports/project-folder-reader.ts';

export class ScriptedProjectFolderReader implements ProjectFolderReader {
  private readonly reads = new Map<string, ProjectFolderRead>();

  folder(contents: ProjectFolderContents): void {
    this.reads.set(contents.path, { kind: 'read', contents });
  }

  failing(
    path: string,
    kind: 'missing' | 'unreadable' | 'unsupported-name',
  ): void {
    this.reads.set(path, { kind });
  }

  async read(input: ReadProjectFolderInput): Promise<ProjectFolderRead> {
    return this.reads.get(input.path) ?? { kind: 'missing' };
  }
}
