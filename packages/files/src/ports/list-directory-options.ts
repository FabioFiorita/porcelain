import { Context } from 'effect';
import type { ListDirectoryOptions as ListDirectoryOptionsShape } from '../models/list-directory.ts';
export const ListDirectoryOptions = Context.Service<
  '@porcelain/files/ListDirectoryOptions',
  ListDirectoryOptionsShape
>('@porcelain/files/ListDirectoryOptions');
