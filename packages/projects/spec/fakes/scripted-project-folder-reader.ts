import type {
  FolderSearch,
  FolderSearchResult,
  ProjectFolderContents,
} from '@porcelain/projects/models';
import type { ProjectFolderReader } from '@porcelain/projects/ports';

export class ScriptedProjectFolderReader implements ProjectFolderReader {
  private readonly folders = new Map<string, ProjectFolderContents>();
  private found: FolderSearchResult = { candidates: [], limited: false };
  searches: FolderSearch[] = [];

  folder(contents: ProjectFolderContents): void {
    this.folders.set(contents.path, contents);
  }

  searchFinds(result: FolderSearchResult): void {
    this.found = result;
  }

  async read(path: string): Promise<ProjectFolderContents> {
    const contents = this.folders.get(path);
    if (!contents) throw new Error(`Path not found: ${path}`);
    return contents;
  }

  async search(search: FolderSearch): Promise<FolderSearchResult> {
    this.searches.push(search);
    return this.found;
  }
}
