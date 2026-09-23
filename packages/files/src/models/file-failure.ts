export type FileFailure =
  | 'missing'
  | 'unreadable'
  | 'changed'
  | 'unsupported-name'
  | 'unsupported-text'
  | 'exists'
  | 'cross-device'
  | 'trash-unavailable';
