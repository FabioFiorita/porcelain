import type { DiffReader } from './diff-reader.ts';
import type { StatusReader } from './status-reader.ts';

export type InspectionFactory = (
  checkout: string,
  metadataIdentity: string,
  repositoryIdentity: string,
) => StatusReader & DiffReader;
