import type { CheckoutSession } from '../interfaces/git-session.ts';
import type { DiffReader } from './diff-reader.ts';
import type { StatusReader } from './status-reader.ts';

export type InspectionFactory = (
  session: CheckoutSession,
) => StatusReader & DiffReader;
