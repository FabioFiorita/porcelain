import type {
  FolderSearch,
  FolderSearchResult,
  ProjectFolderContents,
  ProjectFolderRead,
} from '@porcelain/projects/models';
import type { ProjectFolderReader } from '@porcelain/projects/ports';

export class ScriptedProjectFolderReader implements ProjectFolderReader {
  private readonly folders = new Map<string, ProjectFolderContents>();
  private readonly failures = new Map<
    string,
    Exclude<ProjectFolderRead, { outcome: 'read' }>
  >();
  private found: FolderSearchResult = { candidates: [], limited: false };
  searches: FolderSearch[] = [];

  folder(contents: ProjectFolderContents): void {
    this.folders.set(contents.path, contents);
  }

  failing(
    path: string,
    outcome: 'missing' | 'unreadable' | 'unsupported-name',
  ): void {
    this.failures.set(path, { outcome });
  }

  searchFinds(result: FolderSearchResult): void {
    this.found = result;
  }

  async read(path: string): Promise<ProjectFolderRead> {
    const failure = this.failures.get(path);
    if (failure) return failure;
    const contents = this.folders.get(path);
    return contents ? { outcome: 'read', contents } : { outcome: 'missing' };
  }

  async search(search: FolderSearch): Promise<FolderSearchResult> {
    this.searches.push(search);
    return this.found;
  }
}
