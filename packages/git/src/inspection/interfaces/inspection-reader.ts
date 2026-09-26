import type { ChangeReader } from './change-reader.ts';
import type { DiffReader } from './diff-reader.ts';
import type { CheckoutSession } from './git-session.ts';
import type { StatusReader } from './status-reader.ts';

export interface InspectionReader
  extends StatusReader, DiffReader, ChangeReader {}

export interface InspectionFactory {
  (session: CheckoutSession): InspectionReader;
}
