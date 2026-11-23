import { ContentChangedError } from '../errors/content-changed-error.ts';
import { CrossDeviceMoveError } from '../errors/cross-device-move-error.ts';
import { DiskFullError } from '../errors/disk-full-error.ts';
import { EntryExistsError } from '../errors/entry-exists-error.ts';
import { FileTooLargeError } from '../errors/file-too-large-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { TrashUnavailableError } from '../errors/trash-unavailable-error.ts';
import { UnsupportedEntryNameError } from '../errors/unsupported-entry-name-error.ts';
import { UnsupportedTextError } from '../errors/unsupported-text-error.ts';
import type {
  ListFailure,
  TextFailure,
  WriteFailure,
} from '../models/file-failure.ts';

export const fileFailure = {
  missing: () => new PathNotFoundError(),
  unreadable: () => new PathNotReadableError(),
  changed: () => new ContentChangedError(),
  'unsupported-text': () => new UnsupportedTextError(),
  'unsupported-name': () => new UnsupportedEntryNameError(),
  exists: () => new EntryExistsError(),
  'cross-device': () => new CrossDeviceMoveError(),
  'trash-unavailable': () => new TrashUnavailableError(),
  'too-large': () => new FileTooLargeError(),
  'no-space': () => new DiskFullError(),
} satisfies Record<ListFailure | TextFailure | WriteFailure, () => unknown>;
