export type ReadFailure = 'missing' | 'unreadable' | 'changed';

export type TextFailure = ReadFailure | 'unsupported-text';

export type ListFailure = ReadFailure | 'unsupported-name';

export type WriteFailure =
  | ReadFailure
  | 'exists'
  | 'cross-device'
  | 'trash-unavailable';
