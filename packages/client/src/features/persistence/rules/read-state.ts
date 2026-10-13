export type PersistedReadState = {
  readonly status: 'loading' | 'ready' | 'unreadable';
  readonly error: string | undefined;
};
