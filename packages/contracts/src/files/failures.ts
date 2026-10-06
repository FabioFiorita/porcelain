import {
  ContentChangedError,
  CrossDeviceMoveError,
  DirectoryTooLargeError,
  DiskFullError,
  EntryExistsError,
  FileTooLargeError,
  InvalidMoveError,
  PathNotFoundError,
  PathNotReadableError,
  TrashUnavailableError,
  UnsupportedAssetTypeError,
  UnsupportedEntryNameError,
  UnsupportedTextError,
} from '@porcelain/files/errors';
import { httpFailure } from '../shared/http-failure.ts';
import { worktreeFailures } from '../shared/worktree-failures.ts';
export const invalidMove = httpFailure(InvalidMoveError, 'BadRequest', {
  message: 'Invalid request',
});
const pathNotFound = httpFailure(PathNotFoundError, 'NotFound');
const contentChanged = httpFailure(ContentChangedError, 'Conflict', {
  code: 'content_changed',
});
export const entryExists = httpFailure(EntryExistsError, 'Conflict');
const pathNotReadable = httpFailure(
  PathNotReadableError,
  'UnprocessableEntity',
);
export const unsupportedEntryName = httpFailure(
  UnsupportedEntryNameError,
  'UnprocessableEntity',
);
export const directoryTooLarge = httpFailure(
  DirectoryTooLargeError,
  'UnprocessableEntity',
);
export const crossDeviceMove = httpFailure(
  CrossDeviceMoveError,
  'UnprocessableEntity',
);
export const trashUnavailable = httpFailure(
  TrashUnavailableError,
  'UnprocessableEntity',
);
export const unsupportedAssetType = httpFailure(
  UnsupportedAssetTypeError,
  'UnprocessableEntity',
);
export const unsupportedText = httpFailure(
  UnsupportedTextError,
  'UnprocessableEntity',
  {
    code: 'unsupported_text',
  },
);
export const fileTooLarge = httpFailure(
  FileTooLargeError,
  'UnprocessableEntity',
  {
    code: 'file_too_large',
  },
);
export const diskFull = httpFailure(DiskFullError, 'UnprocessableEntity');

export const readFailures = [
  ...worktreeFailures,
  pathNotFound,
  pathNotReadable,
  contentChanged,
];

export const textReadFailures = [
  ...readFailures,
  unsupportedText,
  fileTooLarge,
];
