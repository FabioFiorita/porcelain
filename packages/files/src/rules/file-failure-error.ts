import { ContentChangedError } from '../errors/content-changed-error.ts';
import { CrossDeviceMoveError } from '../errors/cross-device-move-error.ts';
import { EntryExistsError } from '../errors/entry-exists-error.ts';
import { PathNotFoundError } from '../errors/path-not-found-error.ts';
import { PathNotReadableError } from '../errors/path-not-readable-error.ts';
import { TrashUnavailableError } from '../errors/trash-unavailable-error.ts';
import { UnsupportedEntryNameError } from '../errors/unsupported-entry-name-error.ts';
import { UnsupportedTextError } from '../errors/unsupported-text-error.ts';
import type { FileFailure } from '../models/file-failure.ts';

export function fileFailureError(failure: FileFailure): Error {
  switch (failure) {
    case 'missing':
      return new PathNotFoundError();
    case 'unreadable':
      return new PathNotReadableError();
    case 'changed':
      return new ContentChangedError();
    case 'unsupported-name':
      return new UnsupportedEntryNameError();
    case 'unsupported-text':
      return new UnsupportedTextError();
    case 'exists':
      return new EntryExistsError();
    case 'cross-device':
      return new CrossDeviceMoveError();
    case 'trash-unavailable':
      return new TrashUnavailableError();
  }
}
