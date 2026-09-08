import type {
  DirectoryListing,
  FileTarget,
  TextContent,
} from '../../models/file-content.ts';
export interface FileReader {
  list(target: FileTarget, signal?: AbortSignal): Promise<DirectoryListing>;
  read(target: FileTarget, signal?: AbortSignal): Promise<TextContent>;
}
