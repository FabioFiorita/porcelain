import { Context } from 'effect';
import type { BrowseProjectFoldersOptions as BrowseProjectFoldersOptionsShape } from '../models/browse-project-folders.ts';
export const BrowseProjectFoldersOptions = Context.Service<
  '@porcelain/projects/BrowseProjectFoldersOptions',
  BrowseProjectFoldersOptionsShape
>('@porcelain/projects/BrowseProjectFoldersOptions');
