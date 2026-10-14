export type StatusActivity = {
  readonly isActive: () => boolean;
  readonly subscribe: (changed: () => void) => () => void;
};
