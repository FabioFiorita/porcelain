import type {
  FolderSearch,
  FolderSearchResult,
  ProjectFolderContents,
  ProjectFolderRead,
  ReadProjectFolderInput,
} from '../../src/models/project-folder.ts';
import type { ProjectFolderReader } from '../../src/ports/project-folder-reader.ts';

const NOTHING_FOUND: FolderSearchResult = { candidates: [], limited: false };

export class ScriptedProjectFolderReader implements ProjectFolderReader {
  private readonly reads = new Map<string, ProjectFolderRead>();
  private readonly searches = new Map<string, FolderSearchResult>();

  folder(contents: ProjectFolderContents): void {
    this.reads.set(contents.path, { kind: 'read', contents });
  }

  failing(
    path: string,
    kind: 'missing' | 'unreadable' | 'unsupported-name',
  ): void {
    this.reads.set(path, { kind });
  }

  searchFinds(roots: string[], result: FolderSearchResult): void {
    this.searches.set(roots.join('\0'), result);
  }

  async read(input: ReadProjectFolderInput): Promise<ProjectFolderRead> {
    return this.reads.get(input.path) ?? { kind: 'missing' };
  }

  async search(input: FolderSearch): Promise<FolderSearchResult> {
    return this.searches.get(input.roots.join('\0')) ?? NOTHING_FOUND;
  }
}
