import type { ChangeLineRange, ChangeLines } from './change-lines.ts';

export type ReadChangeLinesInput = ChangeLineRange & { text: string };

export type ReadChangeLinesResult = ChangeLines;

export type ReadChangeLinesOptions = { maxLines: number };
