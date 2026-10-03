import type { ChangeLineRange } from './change-lines.ts';

export type ReadChangeLinesInput = ChangeLineRange & { text: string };

export type ReadChangeLinesOptions = { maxLines: number };
