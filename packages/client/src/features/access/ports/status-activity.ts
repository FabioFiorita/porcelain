export type StatusActivity = {
  readonly isActive: () => boolean;
  readonly subscribe: (
    changed: (event?: 'suspend' | 'resume') => void,
  ) => () => void;
};
