export type FileDraftState = {
  text: string;
  savedText: string;
  fingerprint: string;
  saving: boolean;
  owner: string | null;
  error: unknown;
};

export class FileDraft {
  private state: FileDraftState;
  private readonly listeners = new Set<() => void>();
  private pending: Promise<boolean> | undefined;
  private readonly write: (
    text: string,
    expectedFingerprint: string,
  ) => Promise<string>;
  constructor(
    text: string,
    fingerprint: string,
    write: (text: string, expectedFingerprint: string) => Promise<string>,
  ) {
    this.state = {
      text,
      savedText: text,
      fingerprint,
      saving: false,
      owner: null,
      error: null,
    };
    this.write = write;
  }
  get observed() {
    return this.listeners.size > 0;
  }
  readonly snapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private update(change: Partial<FileDraftState>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
  claim(owner: string) {
    if (this.state.owner && this.state.owner !== owner) return false;
    this.update({ owner });
    return true;
  }
  release(owner: string) {
    if (this.state.owner === owner) this.update({ owner: null });
  }
  change(text: string) {
    this.update({ text });
  }
  sync(text: string, fingerprint: string) {
    if (
      this.state.owner === null &&
      !this.state.saving &&
      this.state.text === this.state.savedText &&
      (this.state.savedText !== text || this.state.fingerprint !== fingerprint)
    )
      this.update({ text, savedText: text, fingerprint, error: null });
  }
  reset(text: string, fingerprint: string) {
    if (!this.state.saving)
      this.update({ text, savedText: text, fingerprint, error: null });
  }
  save(): Promise<boolean> {
    if (this.pending) return this.pending;
    if (this.state.text === this.state.savedText) return Promise.resolve(true);
    this.update({ saving: true, error: null });
    const run = async () => {
      try {
        while (this.state.text !== this.state.savedText) {
          const text = this.state.text;
          const fingerprint = await this.write(text, this.state.fingerprint);
          this.update({ savedText: text, fingerprint });
        }
        this.update({ saving: false });
        return true;
      } catch (error) {
        this.update({ saving: false, error });
        return false;
      } finally {
        this.pending = undefined;
      }
    };
    this.pending = run();
    return this.pending;
  }
}
