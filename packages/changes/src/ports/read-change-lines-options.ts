import { Context } from 'effect';
import type { ReadChangeLinesOptions as ReadChangeLinesOptionsShape } from '../models/read-change-lines.ts';
export const ReadChangeLinesOptions = Context.Service<
  '@porcelain/changes/ReadChangeLinesOptions',
  ReadChangeLinesOptionsShape
>('@porcelain/changes/ReadChangeLinesOptions');
