export type PageActivity = {
  readonly isActive: () => boolean;
  readonly subscribe: (changed: () => void) => () => void;
};
