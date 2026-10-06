import { Context } from 'effect';
import type { EditFileOptions as EditFileOptionsShape } from '../models/edit-file.ts';
export const EditFileOptions = Context.Service<
  '@porcelain/files/EditFileOptions',
  EditFileOptionsShape
>('@porcelain/files/EditFileOptions');
