import { ContentChangedError } from './content-changed-error.ts';
import { CrossDeviceMoveError } from './cross-device-move-error.ts';
import { EntryExistsError } from './entry-exists-error.ts';
import { PathNotFoundError } from './path-not-found-error.ts';
import { PathNotReadableError } from './path-not-readable-error.ts';
import { TrashUnavailableError } from './trash-unavailable-error.ts';
import { UnsupportedEntryNameError } from './unsupported-entry-name-error.ts';
import { UnsupportedTextError } from './unsupported-text-error.ts';

export function fileFailureError(
  failure:
    | 'missing'
    | 'unreadable'
    | 'changed'
    | 'unsupported-text'
    | 'unsupported-name'
    | 'exists'
    | 'cross-device'
    | 'trash-unavailable',
): Error {
  switch (failure) {
    case 'missing':
      return new PathNotFoundError();
    case 'unreadable':
      return new PathNotReadableError();
    case 'changed':
      return new ContentChangedError();
    case 'unsupported-text':
      return new UnsupportedTextError();
    case 'unsupported-name':
      return new UnsupportedEntryNameError();
    case 'exists':
      return new EntryExistsError();
    case 'cross-device':
      return new CrossDeviceMoveError();
    case 'trash-unavailable':
      return new TrashUnavailableError();
  }
}
