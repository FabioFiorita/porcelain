import type { CheckoutSession } from '../interfaces/git-session.ts';
import type { ChangeReader } from '../interfaces/change-reader.ts';
import type { DiffReader } from '../interfaces/diff-reader.ts';
import type { StatusReader } from '../interfaces/status-reader.ts';

export type InspectionReader = StatusReader & DiffReader & ChangeReader;

export type InspectionFactory = (session: CheckoutSession) => InspectionReader;
